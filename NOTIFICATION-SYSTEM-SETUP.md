# ImbaLink Notification System Setup

The notification layer is now wired for:

- In-app realtime notification rows from Supabase.
- Desktop/browser notifications with permission handling.
- Custom web notification sounds.
- Capacitor native local notifications with custom sound names.
- A native push-registration hook for background/killed-app delivery.
- Profile > Notification preferences with enable/sound/desktop/mobile toggles and a test button.

## Add custom sounds

Put these files in:

`public/sounds/`

Required names used by the current system:

- `notification-message.wav` — messages/viewing updates
- `notification-general.wav` — general/verification updates

You can replace these files with your own sounds without changing the React code, provided the filenames stay the same.

For web browsers, WAV/MP3 files can be played by the browser. The browser/OS still controls notification permission and may suppress sound when the browser or device is muted/focused according to its own policies.

## iOS / Android custom notification sounds

Native notification sounds are different from web audio. The sound file must be bundled into the native app and referenced by its filename.

### iOS

Add the sound file to the iOS app target in Xcode so it is copied into the application bundle. Keep the same filename, for example `notification-message.wav`.

### Android

Place the native sound file in:

`android/app/src/main/res/raw/`

Use lowercase filenames with underscores if needed. If you change the filename, update `SOUND_BY_TYPE` in `src/services/notifications/notificationEngine.js`.

## Native plugins

The React layer uses Capacitor's plugin registration API for:

- `LocalNotifications`
- `PushNotifications`

Install the native packages before syncing/building native platforms:

`npm install @capacitor/local-notifications @capacitor/push-notifications`

Then:

`npx cap sync`

## Background / killed-app delivery

Realtime Supabase subscriptions work while the JS runtime is alive. True delivery while iOS/Android has suspended or killed the app requires a push provider (APNs for iOS and FCM for Android) plus a backend sender.

The client is prepared for push registration, but provider credentials and a server-side push sender must be configured separately. Do not attempt to send APNs/FCM credentials from the React client.

## Message notifications

Incoming Supabase message events are now handled globally from the app messaging lifecycle, so a user can receive a notification while on Home, Explore, Profile, or another app page. The notification uses:

- **Title:** the other participant's display name
- **Body:** the exact incoming message text
- **Sound:** `notification-message.wav`
- **Type:** `message`

The listener ignores messages sent by the current user and deduplicates realtime replays by message id.

For browser/desktop sound, the user must first enable notifications from the Profile > Notifications control so the browser can grant notification permission and unlock audio playback. For native iOS/Android delivery while the app is backgrounded/killed, APNs/FCM push delivery must also be connected; the local notification path is already prepared.


## ImbaLink notification sound

The default notification sound is now the original **ImbaTone** signature: a short three-note chime designed specifically for ImbaLink. The same sound file is wired into web, Android, and iOS notification assets. It is intentionally short and recognizable so it can be heard repeatedly without becoming intrusive.
