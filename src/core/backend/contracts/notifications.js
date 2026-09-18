import { defineBackendContract } from "../contract";

export const NOTIFICATION_METHODS = [
  "getNotifications",
  "getUnreadNotificationCount",
  "markNotificationRead",
  "markAllNotificationsRead",
  "resetAllNotifications",
  "subscribeToNotifications",
];

export const notificationRepositoryContract = defineBackendContract(
  "NotificationRepository",
  NOTIFICATION_METHODS
);
