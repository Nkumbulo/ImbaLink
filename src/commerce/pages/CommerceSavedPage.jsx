import React from "react";
import { Heart } from "lucide-react";
import { demoProducts } from "../commerceData.json";
import CommerceCard from "../components/CommerceCard";

export default function CommerceSavedPage({ savedIds, onToggleSave, followedSellers = new Set(), onToggleFollowSeller, onMessage }) {
  const items = demoProducts.filter((p) => savedIds.has(p.id));
  return (
    <div className="commerce-page web-page commerce-inner">
      <span className="commerce-eyebrow">Your marketplace</span>
      <h1>Saved listings</h1>
      {items.length ? (
        <div className="commerce-grid">
          {items.map((p) => (
            <CommerceCard
              key={p.id}
              product={p}
              saved
              onToggleSave={onToggleSave}
              isFollowingSeller={followedSellers.has(p.seller)}
              onToggleFollow={(item) => onToggleFollowSeller?.(item.seller)}
              onAction={onMessage}
            />
          ))}
        </div>
      ) : (
        <div className="commerce-empty">
          <Heart size={28} />
          <h2>No saved listings yet</h2>
          <p>Save items you may want to come back to.</p>
        </div>
      )}
    </div>
  );
}
