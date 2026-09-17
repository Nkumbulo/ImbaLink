import React from "react";
import { demoProducts } from "../commerceData.json";
import CommerceCard from "./CommerceCard";

export default function CommerceMarketplaceGrid({
  commerceSavedIds = new Set(),
  onToggleCommerceSave,
  followedSellers = new Set(),
  onToggleFollowSeller,
  onOpenDetails,
  onAction,
  gridClassName = "commerce-home-listings",
}) {
  return (
    <main className={gridClassName} aria-label="Marketplace listings">
      {demoProducts.map((product) => (
        <CommerceCard
          key={product.id}
          product={product}
          saved={commerceSavedIds.has(product.id)}
          onToggleSave={onToggleCommerceSave}
          isFollowingSeller={followedSellers.has(product.seller)}
          onToggleFollow={(item) => onToggleFollowSeller?.(item.seller)}
          onOpenDetails={onOpenDetails}
          actionLabel="Connect & Buy"
          onAction={onAction}
        />
      ))}
    </main>
  );
}
