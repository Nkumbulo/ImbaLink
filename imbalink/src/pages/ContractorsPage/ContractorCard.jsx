import { Heart, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { T } from "../../styles/tokens";
import Avatar from "../../components/common/Avatar";

export default function ContractorCard({ contractor, liked, openContractorProfile, toggleLike, handleRequestQuote }) {
  const contractorKey = String(contractor.id);
  const isLiked = liked?.has(contractorKey);
  const displayedRating = Math.min(5, Number(contractor.rating || 0) + (isLiked ? 0.1 : 0));

  return (
    <div
      className="web-contractor-card rounded-2xl p-3.5"
      onClick={() => openContractorProfile(contractor)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openContractorProfile(contractor);
        }
      }}
      style={{ background: T.paperDim, cursor: "pointer" }}
    >
      <div className="flex gap-3">
        <Avatar
          src={contractor.avatarUrl}
          grad={["#6E63B8", "#3E3670"]}
          letter={(contractor.name?.[0] || contractor.business?.[0] || "?").toUpperCase()}
          size={48}
          alt={`${contractor.name || contractor.business} profile picture`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="f-body font-semibold truncate" style={{ color: T.ink, fontSize: 13 }}>
              {contractor.business || contractor.name || "Contractor"}
            </div>

            {contractor.verified && (
              <ShieldCheck size={13} style={{ color: T.msasa, flexShrink: 0 }} />
            )}
          </div>

          <div className="f-body mt-0.5" style={{ color: T.ink60, fontSize: 10.5 }}>
            {contractor.name || "Contractor"}
            {contractor.category ? ` · ${contractor.category}` : ""}
          </div>

          <div className="flex items-center gap-3 mt-1.5 f-body" style={{ color: T.ink60, fontSize: 10 }}>
            <span className="flex items-center gap-1">
              <MapPin size={10} />
              {contractor.area || "Zimbabwe"}
            </span>

            <span className="flex items-center gap-1">
              <Star size={10} fill={T.ochre} style={{ color: T.ochre }} />
              {displayedRating.toFixed(1)}
            </span>
          </div>
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation();
            toggleLike(contractor.id);
          }}
          aria-label={isLiked ? "Unlike contractor" : "Like contractor"}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90"
          style={{ background: T.paper, border: "none", cursor: "pointer" }}
        >
          <Heart
            size={18}
            color={isLiked ? T.brick : T.ink}
            fill={isLiked ? T.brick : "none"}
            strokeWidth={1.8}
          />
        </button>
      </div>

      <p
        className="f-body leading-relaxed mt-3"
        style={{
          color: T.ink60,
          fontSize: 11.5,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {contractor.description || `Professional ${contractor.category || "property"} services.`}
      </p>

      <div className="flex gap-2 mt-3" onClick={(event) => event.stopPropagation()}>
        <a
          href={contractor.phone ? `tel:${contractor.phone}` : undefined}
          onClick={(event) => {
            if (!contractor.phone) {
              event.preventDefault();
            }
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full f-body font-semibold"
          style={{
            background: T.ink,
            color: T.paper,
            fontSize: 11.5,
            textDecoration: "none",
            opacity: contractor.phone ? 1 : 0.5,
          }}
        >
          <Phone size={13} />
          Call
        </a>

        <button
          onClick={() => handleRequestQuote(contractor)}
          className="flex-1 px-3 py-2.5 rounded-full f-body font-semibold"
          style={{
            background: T.paper,
            color: T.ink,
            border: `1px solid ${T.line}`,
            fontSize: 11.5,
            cursor: "pointer",
          }}
        >
          Request quote
        </button>
      </div>
    </div>
  );
}
