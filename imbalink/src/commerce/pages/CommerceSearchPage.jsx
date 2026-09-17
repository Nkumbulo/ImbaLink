import React, { useState } from "react";
import useMediaQuery from "../../hooks/useMediaQuery";
import CommerceExploreView from "../components/CommerceExploreView";
import CommerceMarketplaceGrid from "../components/CommerceMarketplaceGrid";
import CommerceProductDetailOverlay from "../components/CommerceProductDetailOverlay";

export default function CommerceSearchPage({
  onMessage,
  onSwitchMode,
  commerceSavedIds = new Set(),
  onToggleCommerceSave,
  followedSellers = new Set(),
  onToggleFollowSeller,
  commerceQuery,
  onCommerceQueryChange,
}) {
  const isDesktopLayout = useMediaQuery("(min-width: 1024px)");
  const [selectedProduct, setSelectedProduct] = useState(null);

  return (
    <div className="commerce-page commerce-search-page commerce-inner web-page">
      {/* Layout swap: desktop Explore shows the same bare Marketplace grid
          Shop Home shows on mobile (full CommerceCard — avatar, follow,
          Connect & Buy); Shop Home shows the Explore experience on desktop
          instead (see CommerceHomeFace in src/pages/HomePage.jsx). Mobile
          Explore keeps its own search + quick filters + grid tiles. */}
      {isDesktopLayout ? (
        <>
          <CommerceMarketplaceGrid
            commerceSavedIds={commerceSavedIds}
            onToggleCommerceSave={onToggleCommerceSave}
            followedSellers={followedSellers}
            onToggleFollowSeller={onToggleFollowSeller}
            onOpenDetails={setSelectedProduct}
            onAction={onMessage}
            gridClassName="web-search-grid"
          />
          {selectedProduct && (
            <CommerceProductDetailOverlay
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
              onConnectBuy={onMessage}
            />
          )}
        </>
      ) : (
        <CommerceExploreView onSwitchMode={onSwitchMode} onMessage={onMessage} query={commerceQuery} onQueryChange={onCommerceQueryChange} />
      )}
    </div>
  );
}
