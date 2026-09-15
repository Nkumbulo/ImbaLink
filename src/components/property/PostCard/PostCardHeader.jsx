import { MapPin } from "lucide-react";
import { T } from "../../../styles/tokens";
import Avatar from "../../common/Avatar";
import VerifiedBadge from "../../common/VerifiedBadge";
import { formatDaysAgo } from "../../../utils/formatters";

export default function PostCardHeader({ p, compactDesktop, showDistance, listingVerified, onHeaderClick }) {
  return (
    <div className={`flex items-center justify-between ${compactDesktop ? "px-3 py-1.5" : "px-3.5 py-2"}`}>
      <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={onHeaderClick}>
        <Avatar
          src={p.landlordAvatarUrl}
          grad={p.grad || ''}
          letter={(p.landlord?.[0] || '?')}
          ring={p.postedDaysAgo <= 1}
          alt={p.landlord ? `${p.landlord} profile picture` : ''}
        />
        <div className="min-w-0 leading-tight">
          <span className="f-body font-semibold truncate block" style={{ color: T.ink, fontSize: compactDesktop ? 12 : 13 }}>
            {p.landlord || ''}
          </span>
          <div className="flex items-center gap-1 f-body mt-0.5" style={{ color: T.ink60, fontSize: 11 }}>
            <MapPin size={10} />
            {p.suburb || ''}
            {showDistance && <span> · {p.distanceKm} km</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="f-body" style={{ color: T.ink60, fontSize: 11 }}>
          {formatDaysAgo(p.postedDaysAgo || 0)}
        </span>
        <VerifiedBadge status={listingVerified ? "verified" : "pending"} />
      </div>
    </div>
  );
}
