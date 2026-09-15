import { Bell, X, Home, Eye, ShieldCheck, MessageCircle, CheckCheck, RotateCcw } from "lucide-react";
import { T } from "../../styles/tokens";
import { formatRelative } from "../../utils/formatters";

const ICON_BY_TYPE = {
  message: MessageCircle,
  viewing_request: Eye,
  viewing_status: MessageCircle,
  verification_update: ShieldCheck,
};

function NotificationRow({ notification, onOpen }) {
  const Icon = ICON_BY_TYPE[notification.type] || Home;
  const unread = !notification.readAt;
  const ts = notification.createdAt ? new Date(notification.createdAt).getTime() : Date.now();

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className="w-full text-left flex items-start gap-3 px-4 py-3.5 transition-all"
      style={{
        background: unread ? T.paperDim : "transparent",
        border: "none",
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      <span
        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: unread ? T.jacaranda : T.paperDim,
          color: unread ? T.paper : T.ink60,
          boxShadow: unread ? "0 4px 14px rgba(0,0,0,.08)" : "none",
        }}
      >
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="f-body font-semibold block truncate" style={{ color: T.ink, fontSize: 12.5 }}>
            {notification.title}
          </span>
          {unread && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: T.jacaranda }} />}
        </span>
        {notification.body && (
          <span className="f-body block mt-1 line-clamp-2" style={{ color: T.ink60, fontSize: 11, lineHeight: 1.4 }}>
            {notification.body}
          </span>
        )}
      </span>
      <span className="f-body shrink-0 pt-0.5" style={{ color: T.ink60, fontSize: 9.5 }}>
        {formatRelative(ts)}
      </span>
    </button>
  );
}

export default function NotificationsPanel({ notifications = [], onClose, onOpenNotification, onMarkAllRead, onResetNotifications }) {
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(20,32,26,.48)", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-b-[28px] sm:rounded-[28px] overflow-hidden"
        style={{
          background: T.paper,
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          border: `1px solid ${T.line}`,
          boxShadow: "0 28px 80px rgba(20,32,26,.22)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${T.line}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: T.paperDim, color: T.jacaranda }}>
                <Bell size={18} strokeWidth={2.2} />
              </span>
              <div>
                <div className="f-display font-bold" style={{ color: T.ink, fontSize: 17 }}>Notifications</div>
                <div className="f-body" style={{ color: T.ink60, fontSize: 10.5 }}>
                  {unreadCount ? `${unreadCount} unread` : "You're all caught up"}
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close notifications" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: T.ink60, background: T.paperDim, border: "none" }}>
              <X size={17} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-4">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1.5 f-body font-semibold"
                style={{ color: T.jacaranda, fontSize: 10.5, background: "transparent", border: "none" }}
              >
                <CheckCheck size={14} /> Mark all as read
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onResetNotifications}
                className="inline-flex items-center gap-1.5 f-body font-semibold"
                style={{ color: T.brick, fontSize: 10.5, background: "transparent", border: "none" }}
              >
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {notifications.length === 0 ? (
            <div className="text-center px-8 py-16 f-body" style={{ color: T.ink60, fontSize: 12.5 }}>
              <span className="mx-auto mb-3 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: T.paperDim, color: T.jacaranda }}>
                <Bell size={19} />
              </span>
              <div className="font-semibold" style={{ color: T.ink }}>No notifications yet</div>
              <div className="mt-1">Viewing requests, messages, verification updates and more will appear here.</div>
            </div>
          ) : (
            notifications.map((n) => <NotificationRow key={n.id} notification={n} onOpen={onOpenNotification} />)
          )}
        </div>
      </div>
    </div>
  );
}
