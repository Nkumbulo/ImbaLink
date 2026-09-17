/** Infrastructure adapter: canonical notification persistence boundary. */
import { supabase } from '../../../services/supabase';
import { activeUserKey } from '../domains/shared/identity';
import { createNotificationService } from '../implementations/notifications/notifications';

export const {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  resetAllNotifications,
  subscribeToNotifications,
} = createNotificationService({ supabase, activeUserKey });
