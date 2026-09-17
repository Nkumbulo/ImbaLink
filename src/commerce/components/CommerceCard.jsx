import React from "react";
import { Heart, MapPin, Link2, MessageCircle } from "lucide-react";
import VerifiedBadge from "../../components/common/VerifiedBadge";

export default React.memo(function CommerceCard({ product, saved, onToggleSave, onOpenDetails, actionLabel = "Connect & Buy", onAction, isFollowingSeller, onToggleFollow }) {
  const openDetails = () => onOpenDetails?.(product);
  const posted = product.postedAt || "2d ago";

  return (
    <article className="commerce-card" aria-label={product.title}>
      <div className="commerce-card-header imba2-f13-header">
        <div className="commerce-seller-identity">
          <span className="commerce-avatar">{product.initials}</span>
          <div className="commerce-seller-copy">
            <strong>{product.seller}</strong>
            <button
              type="button"
              className={`commerce-seller-follow-btn ${isFollowingSeller ? "is-following" : ""}`}
              onClick={(e) => { e.stopPropagation(); onToggleFollow?.(product); }}
              aria-pressed={!!isFollowingSeller}
              aria-label={isFollowingSeller ? `Unfollow ${product.seller}` : `Follow ${product.seller}`}
            >
              {isFollowingSeller ? "Following" : "Follow"}
            </button>
            <span><MapPin size={11} /> {product.location}</span>
          </div>
        </div>
        <div className="commerce-card-header-right">
          <div className="commerce-card-time">{posted}</div>
          <span className="commerce-card-verified">
            <VerifiedBadge status={product.verified ? "verified" : "pending"} />
          </span>
        </div>
      </div>

      <button type="button" className="commerce-card-image-button" onClick={openDetails} aria-label={`View ${product.title}`}>
        <div className="commerce-card-image-wrap">
          <img src={product.image} alt={product.title} className="commerce-card-image" loading="lazy" />
          <span className="commerce-condition-badge">{product.condition}</span>
        </div>
      </button>

      <div className="commerce-card-content imba2-f13-content">
        <div className="commerce-card-title-row">
          <h3>{product.title}</h3>
          <strong className="commerce-price">{product.currency} {Number(product.price || 0).toLocaleString()}</strong>
        </div>
        <div className="commerce-card-actions-top">
          <button type="button" className={`commerce-save-inline ${saved ? "is-saved" : ""}`} onClick={() => onToggleSave?.(product.id)} aria-label={saved ? "Remove from saved" : "Save listing"}>
            <Heart size={15} fill={saved ? "currentColor" : "none"} /> <span>Save</span>
          </button>
          <button type="button" className="commerce-link-button" onClick={openDetails}><Link2 size={14} /> Link</button>
        </div>
        <p className="commerce-description">{product.description || "Connect with the seller to ask questions, confirm details and arrange the transaction."}</p>
        <div className="commerce-card-bottom-actions">
          <button type="button" className="commerce-connect-buy" onClick={() => onAction?.(product)}>
            <MessageCircle size={14} /> {actionLabel}
          </button>
          <button type="button" className="commerce-details-button" onClick={openDetails}>Detail</button>
        </div>
      </div>
    </article>
  );
});
