import { CheckCircle2 } from "lucide-react";
import { T } from "../../../styles/tokens";

export default function LandlordHubToast({ message }) {
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className="fixed left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 rounded-full px-4 py-3 shadow-xl rise" style={{ bottom: "calc(24px + env(safe-area-inset-bottom, 0px))", background: message.includes("successfully") ? T.msasa : T.ink, color: T.paper, maxWidth: "calc(100vw - 32px)" }}>
      {message.includes("successfully") && <CheckCircle2 size={16} />}
      <span className="f-body font-semibold" style={{ fontSize: 11.5 }}>{message}</span>
    </div>
  );
}
