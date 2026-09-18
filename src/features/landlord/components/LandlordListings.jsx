import { Eye, MessageCircle, Pencil, Pause, Play, Trash2 } from "lucide-react";
import { T } from "../../../styles/tokens";
import PhotoUploadBanner from "../../../components/landlord/PhotoUploadBanner";

export default function LandlordListings({ listings, profile, enquiryCounts, togglingId, deletingId, onOpenProperty, onTogglePause, onEdit, onDelete }) {
  return (
    <div>
      <div className="f-mono mb-2" style={{ color: T.ink60, fontSize: 10, letterSpacing: ".16em" }}>YOUR LISTINGS</div>
      <PhotoUploadBanner listings={listings} ownerId={profile?.id} />
      <div className="space-y-2">
        {listings.length === 0 ? (
          <div className="rounded-2xl p-4" style={{ background: T.paperDim }}>
            <div className="f-body" style={{ color: T.ink60, fontSize: 11.5 }}>You have not listed any properties yet.</div>
          </div>
        ) : listings.slice(0, 8).map((p) => (
          <div key={p.id} className="w-full flex items-center gap-3 p-3 rounded-2xl" style={{ background: T.paperDim }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpenProperty(p)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenProperty(p);
                }
              }}
              className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
            >
              <button
                type="button"
                aria-label={p.isPaused ? `Resume ${p.title}` : `Pause ${p.title}`}
                title={p.isPaused ? "Resume listing" : "Pause listing"}
                disabled={togglingId === p.id}
                onClick={(event) => onTogglePause(event, p)}
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: p.isPaused ? "rgba(164,64,53,.12)" : `linear-gradient(135deg, ${p.grad?.[0] || T.jacaranda}, ${p.grad?.[1] || T.brick})`,
                  color: p.isPaused ? T.brick : T.paper,
                  border: "none",
                  cursor: togglingId === p.id ? "wait" : "pointer",
                  opacity: togglingId === p.id ? 0.6 : 1,
                }}
              >
                {p.isPaused ? <Play size={19} fill="currentColor" /> : <Pause size={19} fill="currentColor" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="f-body font-semibold truncate" style={{ color: T.ink, fontSize: 12.5 }}>{p.title}</div>
                <div className="f-body mt-0.5 truncate" style={{ color: T.ink60, fontSize: 10.5 }}>{p.suburb} · ${p.rent}/mo</div>
                {p.isPaused && <div className="f-body mt-0.5" style={{ color: T.brick, fontSize: 9.5, fontWeight: 600 }}>Paused · viewing requests unavailable</div>}
                <div className="f-body mt-0.5 flex items-center gap-2.5" style={{ color: T.ink60, fontSize: 10 }}>
                  <span className="flex items-center gap-1"><Eye size={11} /> {p.viewCount || 0} view{p.viewCount === 1 ? "" : "s"}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={11} /> {enquiryCounts.get(String(p.id)) || 0} enquir{(enquiryCounts.get(String(p.id)) || 0) === 1 ? "y" : "ies"}</span>
                </div>
              </div>
              <span className="f-body px-2 py-1 rounded-full shrink-0" style={{ background: p.verification === "verified" ? "color-mix(in srgb, var(--theme-green) 12%, transparent)" : "rgba(184,132,46,.13)", color: p.verification === "verified" ? T.msasa : T.ochre, fontSize: 9.5 }}>
                {p.verification === "verified" ? "Verified" : "Pending"}
              </span>
            </div>
            <button type="button" aria-label={`Edit ${p.title}`} onClick={(event) => onEdit(event, p)} className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(58,74,58,.08)", color: T.ink }}>
              <Pencil size={15} />
            </button>
            <button type="button" aria-label={`Delete ${p.title}`} disabled={deletingId === p.id} onClick={(event) => onDelete(event, p)} className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(164,64,53,.10)", color: T.brick, opacity: deletingId === p.id ? 0.5 : 1 }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
