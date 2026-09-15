function MessageTicks({ status }) {
  if (status === "sending") {
    return (
      <svg viewBox="0 0 16 15" width="14" height="14" fill="none" aria-label="Sending">
        <path
          d="M7.5 1a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7 4v3.5l2.5 1.5"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const color = status === "read" ? "#53BDEB" : "#8696A0";
  const singleTick = status === "sent";

  return (
    <svg viewBox="0 0 16 15" width="16" height="15" fill="none" aria-label={status}>
      <path
        d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.39.166L4.443 8.616 2.79 6.963a.492.492 0 00-.35-.144.492.492 0 00-.35.144l-.478.478a.494.494 0 000 .698l2.14 2.14a.68.68 0 00.463.194h.005a.68.68 0 00.46-.222l6.415-8.523a.494.494 0 00-.024-.653v-.001z"
        fill={color}
      />
      {!singleTick && (
        <path
          d="M14.87.653a.457.457 0 00-.304-.102.493.493 0 00-.39.166L8.243 8.616l-.402-.402a.494.494 0 00-.698 0l-.478.478a.494.494 0 000 .698l1.187 1.187a.68.68 0 00.463.194h.005a.68.68 0 00.46-.222l6.415-8.523a.494.494 0 00-.024-.653v-.001z"
          fill={color}
        />
      )}
    </svg>
  );
}

export default MessageTicks;

export function getTickStatus(message, otherParticipant) {
  if (message?.status === "sending") return "sending";
  if (!message || message.status === "failed") return null;

  const createdAt = Number(message.ts);
  if (!Number.isFinite(createdAt)) return "sent";

  const readAt = otherParticipant?.lastReadAt
    ? new Date(otherParticipant.lastReadAt).getTime()
    : NaN;
  const deliveredAt = otherParticipant?.lastDeliveredAt
    ? new Date(otherParticipant.lastDeliveredAt).getTime()
    : NaN;

  if (Number.isFinite(readAt) && createdAt <= readAt) return "read";
  if (Number.isFinite(deliveredAt) && createdAt <= deliveredAt) return "delivered";
  return "sent";
}
