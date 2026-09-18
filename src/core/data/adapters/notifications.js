/** @deprecated Compatibility facade. Canonical notification repository lives in infrastructure. */
export {
  supabaseNotificationRepository,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  resetAllNotifications,
  subscribeToNotifications,
} from "../../../infrastructure/supabase/adapters/notifications";
