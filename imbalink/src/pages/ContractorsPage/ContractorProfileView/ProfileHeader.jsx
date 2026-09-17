import { ArrowLeft, Heart } from "lucide-react";
import { T } from "../../../styles/tokens";

export default function ProfileHeader({ onClose, onToggleLike, contractorId, isLiked }) {
  return (
    <div
      className="contractor-detail-dark"
      style={{
        background: T.ink,
        color: T.paper,
        paddingTop: "env(safe-area-inset-top, 0px)",
        position: "sticky",
        top: 0,
        zIndex: 20,
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
      }}
    >
      <div style={{ height: 64, padding: "0 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onClose}
          aria-label="Back to contractors"
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90"
          style={{ background: "rgba(255,255,255,0.08)", border: "none", color: T.paper, cursor: "pointer" }}
        >
          <ArrowLeft size={21} />
        </button>

        <div className="f-display font-semibold truncate" style={{ fontSize: 17, color: T.paper, flex: 1 }}>
          Contractor profile
        </div>

        <button
          onClick={() => onToggleLike(contractorId)}
          aria-label={isLiked ? "Unlike contractor" : "Like contractor"}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90"
          style={{ background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer" }}
        >
          <Heart size={19} color={isLiked ? T.brick : T.paper} fill={isLiked ? T.brick : "none"} />
        </button>
      </div>
    </div>
  );
}
