import { Check, Clock3, MessageCircle } from "lucide-react";
import { T } from "../../../styles/tokens";

export default function PostCardCTAButtons({
  p,
  compactDesktop,
  viewingRequested,
  onOpenMessage,
  sentFlash,
  requestingViewing,
  handleRequestViewing,
  onSelectCard,
  openSheet,
}) {
  return (
    <div className={`flex items-center gap-2 ${compactDesktop ? "mt-2" : "mt-3"}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (p?.isPaused) return;
          if (viewingRequested) {
            if (typeof onOpenMessage === "function") onOpenMessage(p.id);
          } else {
            handleRequestViewing();
          }
        }}
        disabled={p?.isPaused || sentFlash || requestingViewing}
        className="flex-1 flex items-center justify-center gap-1.5 f-body font-semibold rounded-full active:scale-95 transition-transform"
        style={{
          background: p?.isPaused ? T.ink60 : (viewingRequested || sentFlash ? T.msasa : T.brick),
          color: T.paper,
          fontSize: compactDesktop ? 10.5 : 12.5,
          paddingTop: compactDesktop ? 7 : 10,
          paddingBottom: compactDesktop ? 7 : 10,
          opacity: p?.isPaused ? 0.75 : (sentFlash || requestingViewing ? 0.9 : 1),
          boxShadow: p?.isPaused || viewingRequested || sentFlash ? "none" : `0 6px 16px -4px ${T.brick}66`,
        }}
      >
        {p?.isPaused ? (
          <>Viewing paused by owner</>
        ) : sentFlash ? (
          <><Check size={14} /> Message sent</>
        ) : requestingViewing ? (
          "Sending…"
        ) : viewingRequested ? (
          <><MessageCircle size={14} /> Open message</>
        ) : (
          <><Clock3 size={14} strokeWidth={2} /> Request a viewing</>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (compactDesktop) {
            onSelectCard?.(p);
          } else {
            openSheet();
          }
        }}
        className="flex items-center justify-center f-body font-semibold rounded-full active:scale-95 transition-transform"
        style={{ background: T.paperDim, color: T.ink, fontSize: compactDesktop ? 10.5 : 12.5, paddingTop: compactDesktop ? 7 : 10, paddingBottom: compactDesktop ? 7 : 10, paddingLeft: compactDesktop ? 11 : 16, paddingRight: compactDesktop ? 11 : 16, border: `1px solid ${T.line}` }}
      >
        Details
      </button>
    </div>
  );
}
