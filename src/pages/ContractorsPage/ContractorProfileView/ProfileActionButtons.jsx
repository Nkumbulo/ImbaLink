import { MessageCircle, Phone } from "lucide-react";
import { T } from "../../../styles/tokens";

export default function ProfileActionButtons({ contractor, isTabletOrDesktop, onRequestQuote }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isTabletOrDesktop || !contractor.phone ? "1fr" : "1fr 1fr",
        gap: 10,
        position: isTabletOrDesktop ? "static" : "sticky",
        bottom: 12,
        zIndex: 5,
      }}
    >
      {contractor.phone && (
        <a
          href={`tel:${contractor.phone}`}
          className="flex items-center justify-center gap-2 rounded-full f-body font-semibold"
          style={{
            minHeight: 50,
            background: T.ink,
            color: T.paper,
            textDecoration: "none",
            fontSize: 12,
            boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
          }}
        >
          <Phone size={16} />
          Call contractor
        </a>
      )}

      <button
        onClick={() => onRequestQuote(contractor)}
        className="flex items-center justify-center gap-2 rounded-full f-body font-semibold active:scale-[0.98]"
        style={{
          minHeight: 50,
          background: T.jacaranda,
          color: T.paper,
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          boxShadow: "0 6px 20px rgba(108,56,255,0.25)",
        }}
      >
        <MessageCircle size={16} />
        Request a quote
      </button>
    </div>
  );
}
