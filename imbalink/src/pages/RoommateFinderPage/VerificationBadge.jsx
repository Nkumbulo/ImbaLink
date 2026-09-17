import { BadgeCheck, ShieldQuestion } from "lucide-react";

export function VerificationBadge({ status, size = 11 }) {
  if (status === "verified") {
    return (
      <span className="rf-badge rf-badge-verified">
        <BadgeCheck size={size} /> Verified Student
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="rf-badge rf-badge-pending">
        <ShieldQuestion size={size} /> Verification pending
      </span>
    );
  }
  return (
    <span className="rf-badge rf-badge-unverified">
      <ShieldQuestion size={size} /> Unverified
    </span>
  );
}
