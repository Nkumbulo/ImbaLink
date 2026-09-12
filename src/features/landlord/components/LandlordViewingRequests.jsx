import { Clock3, Eye } from "lucide-react";
import { T } from "../../../styles/tokens";

export default function LandlordViewingRequests({ requests, onOpenMessages }) {
  return (
    <div>
      <div className="f-mono mb-2" style={{ color: T.ink60, fontSize: 10, letterSpacing: ".16em" }}>VIEWING REQUESTS</div>
      {requests.length === 0 ? (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: T.paperDim }}>
          <Clock3 size={17} style={{ color: T.ink60 }} />
          <span className="f-body" style={{ color: T.ink60, fontSize: 11.5 }}>No new viewing requests yet.</span>
        </div>
      ) : requests.slice(0, 4).map((r) => (
        <button type="button" key={r.id} onClick={() => onOpenMessages?.(r.propertyId, r.tenantUserId)} className="w-full text-left rounded-2xl p-3 mb-2 flex items-center gap-3" style={{ background: T.paperDim }}>
          <Eye size={17} style={{ color: T.jacaranda }} />
          <div className="flex-1 min-w-0">
            <div className="f-body font-semibold truncate" style={{ color: T.ink, fontSize: 12 }}>{r.propertyTitle}</div>
            <div className="f-body truncate" style={{ color: T.ink60, fontSize: 10.5 }}>{r.tenantName} requested a viewing</div>
          </div>
          <span className="f-body font-semibold" style={{ color: T.jacarandaDeep, fontSize: 10 }}>Review</span>
        </button>
      ))}
    </div>
  );
}
