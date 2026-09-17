export function formatDaysAgo(n){ if(n===0) return "Today"; if(n===1) return "1d ago"; return `${n}d ago`; }
export function formatRelative(ts){ const diff=Date.now()-ts; const min=Math.floor(diff/60000); if(min<1) return "Just now"; if(min<60) return `${min}m`; const hr=Math.floor(min/60); if(hr<24) return `${hr}h`; return `${Math.floor(hr/24)}d`; }

// "Last active" line shown under a chat contact's name (see
// MessagesPage.jsx) for whenever they are NOT currently online — the
// caller already shows a plain "Online" itself while presence says they
// are, so this only ever needs to answer "how long ago". Presence is
// scoped to the Messages page itself (see useGlobalPresence.js), so
// leaving Messages — even while staying signed into the rest of the app —
// should read as offline right away, with an accurate elapsed time from
// the very first second, not a several-minute "Online" grace window.
// Returns null when there's no real timestamp to base this on, so the
// caller can render nothing rather than a made-up default.
//
// A message/timestamp can only be as old as this app itself. Any
// timestamp that lands before this (e.g. a corrupted or wrongly-scaled DB
// value landing near the Unix epoch) is impossible data, not a real "last
// active" — showing "was online 689 months ago" for it is worse than
// showing nothing, so this clamps to null (the caller already renders
// nothing for null) instead of ever displaying an implausible duration.
// Set generously early so it never clips a genuinely old but real value.
const EARLIEST_PLAUSIBLE_MS = Date.UTC(2020, 0, 1);
export function formatLastActive(ts) {
  const raw = ts instanceof Date ? ts.getTime() : Number(ts);
  const n = Number.isFinite(raw) ? raw : Date.parse(ts);
  if (!Number.isFinite(n) || n < EARLIEST_PLAUSIBLE_MS) return null;
  const diffMs = Math.max(0, Date.now() - n);

  const seconds = Math.max(1, Math.floor(diffMs / 1000));
  if (seconds < 60) return `was online ${seconds} second${seconds === 1 ? "" : "s"} ago`;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `was online ${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `was online ${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `was online ${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  return `was online ${months} month${months === 1 ? "" : "s"} ago`;
}
