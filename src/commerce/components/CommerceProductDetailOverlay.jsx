import { MapPin, MessageCircle, ShieldCheck, X } from "lucide-react";
import VerifiedBadge from "../../components/common/VerifiedBadge";

export default function CommerceProductDetailOverlay({ product, onClose, onConnectBuy }) {
  if (!product) return null;

  return (
    <div
      className="commerce-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${product.title} details`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
    >
      <article className="commerce-detail-postcard">
        <button type="button" className="commerce-detail-close" onClick={onClose} aria-label="Close details"><X size={18} /></button>
        <div className="commerce-detail-image-strip"><img src={product.image} alt={product.title} /></div>
        <div className="commerce-detail-body">
          <div className="commerce-detail-topline">
            <span>{product.condition}</span>
            <VerifiedBadge status={product.verified ? "verified" : "pending"} />
          </div>
          <h2>{product.title}</h2>
          <div className="commerce-detail-price">{product.currency} {Number(product.price || 0).toLocaleString()}</div>
          <div className="commerce-detail-meta"><MapPin size={14} /> {product.location} · {product.category} · {product.type}</div>
          <p>{product.description}</p>
          <div className="commerce-detail-seller">
            <span className="commerce-avatar">{product.initials}</span>
            <div><strong>{product.seller}</strong><span>Seller on ImbaLink</span></div>
            <VerifiedBadge status={product.verified ? "verified" : "pending"} compact size={20} />
          </div>
          <div className="commerce-detail-safety"><ShieldCheck size={15} /><span>Stay safe: inspect the item, verify payment and never share your OTP or PIN.</span></div>
          <div className="commerce-detail-actions">
            <button type="button" className="commerce-detail-secondary" onClick={onClose}>Close</button>
            <button type="button" className="commerce-detail-primary" onClick={() => { onClose?.(); onConnectBuy?.(product); }}><MessageCircle size={15} /> Connect & Buy</button>
          </div>
        </div>
      </article>
    </div>
  );
}
