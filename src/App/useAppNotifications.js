import { useEffect, useState, useRef } from "react";
import { backend } from "../application/backend/index.js";
import { notifyUser, prepareNotificationExperience, registerForPushNotifications, addPushTokenListener } from "../services/notifications/notificationEngine";

/**
 * Owns the app-wide notification lifecycle: initial hydration, realtime
 * updates, reconnect/visibility reconciliation, and read actions.
 *
 * Keeping this outside AppContent prevents the root shell from owning another
 * independent subscription/state machine and makes notification behavior
 * testable without rendering the entire application.
 */
export default function useAppNotifications({ hydrated, currentUserId, onOpenNotification, setShowNotifications }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const notificationsResetInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (!hydrated || !currentUserId) {
      setNotifications([]);
      setUnreadNotifCount(0);
      return undefined;
    }

    const notificationRepository = backend.notificationRepository;
    const refresh = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      Promise.all([notificationRepository.getNotifications(30), notificationRepository.getUnreadNotificationCount()]).then(([list, count]) => {
        if (!active) return;
        setNotifications(list);
        setUnreadNotifCount(count);
      }).catch(() => {});
    };

    refresh();
    const removePushTokenListener = addPushTokenListener((token) => {
      // Token persistence/backend delivery can be added without changing the UI.
      // Never log the token in production.
      void token;
    });

    const unsubscribe = notificationRepository.subscribeToNotifications(currentUserId, (row) => {
      if (!active) return;
      setNotifications((current) => [row, ...current].slice(0, 30));
      setUnreadNotifCount((current) => current + 1);
      notifyUser(row).catch(() => {});
    });

    if (typeof document !== "undefined") document.addEventListener("visibilitychange", refresh);
    if (typeof window !== "undefined") window.addEventListener("online", refresh);

    return () => {
      active = false;
      unsubscribe();
      removePushTokenListener();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", refresh);
      if (typeof window !== "undefined") window.removeEventListener("online", refresh);
    };
  }, [hydrated, currentUserId]);

  const markNotificationRead = (notificationId) => {
    setNotifications((current) => current.map((notification) => (
      notification.id === notificationId && !notification.readAt
        ? { ...notification, readAt: new Date().toISOString() }
        : notification
    )));
    setUnreadNotifCount((current) => Math.max(0, current - 1));
    notificationRepository.markNotificationRead(notificationId).catch(() => {});
  };

  const markAllNotificationsRead = () => {
    setNotifications((current) => current.map((notification) => (
      notification.readAt
        ? notification
        : { ...notification, readAt: new Date().toISOString() }
    )));
    setUnreadNotifCount(0);
    notificationRepository.markAllNotificationsRead().catch(() => {});
  };

  const resetAllNotifications = async () => {
    const previous = notifications;
    if (!previous.length) return;

    notificationsResetInFlightRef.current = true;
    setNotifications([]);
    setUnreadNotifCount(0);

    try {
      await notificationRepository.resetAllNotifications();
    } catch (error) {
      setNotifications(previous);
      setUnreadNotifCount(previous.filter((notification) => !notification.readAt).length);
      throw error;
    } finally {
      notificationsResetInFlightRef.current = false;
    }
  };

  const prepareNotifications = async () => {
    await prepareNotificationExperience();
    await registerForPushNotifications();
  };

  const openNotification = (notification) => {
    if (!notification) return;
    markNotificationRead(notification.id);
    setShowNotifications(false);
    onOpenNotification?.(notification);
  };

  return {
    notifications,
    unreadNotifCount,
    markNotificationRead,
    markAllNotificationsRead,
    resetAllNotifications,
    openNotification,
    prepareNotifications,
  };
}
