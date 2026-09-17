import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const LocalNotifications = registerPlugin("LocalNotifications");
const PushNotifications = registerPlugin("PushNotifications");

const DEFAULTS = {
  enabled: true,
  sound: true,
  desktop: true,
  mobile: true,
};

const SOUND_BY_TYPE = {
  message: "notification-message.wav",
  viewing_request: "notification-message.wav",
  viewing_status: "notification-message.wav",
  verification_update: "notification-general.wav",
  default: "notification-general.wav",
};

const AUDIO_UNLOCK_KEY = "imbalink-notification-audio-unlocked";
let audioUnlocked = false;
let audioContext = null;

export async function getNotificationPreferences() {
  const { value } = await Preferences.get({ key: "imbalink-notification-preferences" });
  try {
    return { ...DEFAULTS, ...(value ? JSON.parse(value) : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setNotificationPreferences(next) {
  const value = { ...DEFAULTS, ...(next || {}) };
  await Preferences.set({ key: "imbalink-notification-preferences", value: JSON.stringify(value) });
  return value;
}

export async function requestDesktopNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

/**
 * Call from a real user gesture (e.g. Profile > Notifications). This unlocks
 * web audio where the browser requires a gesture before sound can play.
 */
export async function prepareNotificationExperience() {
  if (typeof window !== "undefined") {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") await audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      gain.gain.value = 0.00001;
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.01);
      audioUnlocked = true;
      await Preferences.set({ key: AUDIO_UNLOCK_KEY, value: "true" });
    } catch {
      // Browser audio is best-effort; native notification sound is handled below.
    }
  }
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.requestPermissions();
    } catch {}
    try {
      await PushNotifications.requestPermissions();
    } catch {}
  } else {
    await requestDesktopNotificationPermission();
  }
}

async function playWebSound(filename) {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(`/sounds/${filename}`);
    audio.preload = "auto";
    audio.volume = 0.8;
    await audio.play();
    return;
  } catch {
    // If autoplay policy blocks the custom file, use the unlocked WebAudio beep
    // as a graceful fallback while the user can still configure native sounds.
  }
  if (!audioUnlocked || !audioContext) return;
  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch {}
}

export async function notifyUser(notification) {
  if (!notification) return;
  const prefs = await getNotificationPreferences();
  if (!prefs.enabled) return;

  const title = notification.title || "ImbaLink notification";
  const body = notification.body || "You have a new update.";
  const sound = SOUND_BY_TYPE[notification.type] || SOUND_BY_TYPE.default;

  if (prefs.sound) await playWebSound(sound);

  if (Capacitor.isNativePlatform()) {
    if (!prefs.mobile) return;
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.abs(hashCode(String(notification.id || Date.now()))),
          title,
          body,
          sound: prefs.sound ? sound : undefined,
          extra: { notificationId: notification.id, type: notification.type },
        }],
      });
    } catch (error) {
      console.warn("Local notification failed:", error?.message || error);
    }
    return;
  }

  if (prefs.desktop && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      const n = new Notification(title, { body, tag: String(notification.id || "imbalink") });
      n.onclick = () => window.focus();
    } catch {}
  }
}

export async function registerForPushNotifications() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") return null;
    await PushNotifications.register();
    return true;
  } catch (error) {
    console.warn("Push registration is not available yet:", error?.message || error);
    return null;
  }
}

export function addPushTokenListener(onToken) {
  if (!Capacitor.isNativePlatform()) return () => {};
  let registration;
  try {
    registration = PushNotifications.addListener("registration", onToken);
  } catch {
    return () => {};
  }
  return () => registration?.remove?.();
}

function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash) + value.charCodeAt(i) | 0;
  return hash || 1;
}

export { SOUND_BY_TYPE };
