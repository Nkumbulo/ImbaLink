/** Infrastructure adapter: notification persistence and realtime boundary. */
import { supabase } from "../client";
import { activeUserKey } from "../../../core/data/domains/shared/identity";
import { createNotificationService } from "../../../core/data/implementations/notifications/notifications";

export const supabaseNotificationRepository = Object.freeze(
  createNotificationService({ supabase, activeUserKey })
);

export const {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  resetAllNotifications,
  subscribeToNotifications,
} = supabaseNotificationRepository;
