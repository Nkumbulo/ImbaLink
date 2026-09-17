import { Search, ChevronDown, Bell, Bookmark, Mail, ShoppingBag, ShoppingCart } from "lucide-react";
import UserAvatar from "../components/common/UserAvatar";
import QuickFilterBar from "../components/property/QuickFilterBar";

function ResponsiveTopbar({
  tab,
  setTab,
  appMode = "property",
  onSwitchMode,
  city,
  setShowCityPicker,
  query,
  setQuery,
  commerceQuery,
  setCommerceQuery,
  user,
  unreadCount = 0,
  unreadNotifCount = 0,
  onOpenNotifications,
  showQuickFilters = false,
  quickFilterProperties,
  filters,
  setFilters,
  sort,
  setSort,
  isOnline = true,
}) {
  const isCommerce = appMode === "commerce";
  const isSearch = tab === "search";
  const avatarLabel = String(user?.name || user?.email || "U").trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="responsive-topbar desktop-light-header">
      <div className="responsive-topbar-inner">
        {/* Removed from every page's top topbar — the only remaining
            ImbaLink brand mark is the desktop sidebar's own (see
            .sidebar-brand in App.jsx / GlobalStyles.jsx), which is
            already desktop-only by its own CSS (only rendered at
            min-width:1100px) and untouched by this. */}

        <div className="topbar-search-wrap">
          <Search size={16} />
          {isCommerce ? (
            <input
              value={commerceQuery || ""}
              onChange={(e) => setCommerceQuery?.(e.target.value)}
              onFocus={() => { if (!isSearch) setTab("search"); }}
              placeholder="Search products, services or categories..."
              aria-label="Search marketplace listings"
            />
          ) : (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (!isSearch) setTab("search"); }}
              placeholder="Search City/Location..."
              aria-label="Search city or location"
            />
          )}
        </div>

        {showQuickFilters && (
          <QuickFilterBar
            cityProperties={quickFilterProperties}
            filters={filters}
            setFilters={setFilters}
            sort={sort}
            setSort={setSort}
          />
        )}

        {!isCommerce && (
          <button type="button" className="topbar-city" onClick={() => setShowCityPicker(true)}>
            <span>{city === "All" ? "All Zimbabwe" : city}</span>
            <ChevronDown size={14} />
          </button>
        )}

        <div className="topbar-actions">
          {isCommerce ? (
            <button type="button" className="topbar-mode-switch" onClick={onSwitchMode} aria-label="Switch to Property mode">
              <ShoppingBag size={16} />
              <span>Property</span>
            </button>
          ) : (
            <>
              <button type="button" className="topbar-icon-btn topbar-notify" onClick={onOpenNotifications} aria-label="Notifications">
                <Bell size={18} />
                {unreadNotifCount > 0 && <span>{unreadNotifCount > 9 ? "9+" : unreadNotifCount}</span>}
              </button>
              <button type="button" className="topbar-shop-switch" onClick={onSwitchMode} aria-label="Open Shop">
                <ShoppingCart size={16} strokeWidth={2.2} />
                <span>Shop</span>
              </button>
            </>
          )}
          <button type="button" className="topbar-icon-btn" onClick={() => setTab("saved")} aria-label="Saved listings">
            <Bookmark size={18} />
          </button>
          <button type="button" className="topbar-icon-btn topbar-notify" onClick={() => setTab("messages")} aria-label="Messages">
            <Mail size={18} />
            {unreadCount > 0 && <span>{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>
          <button type="button" className="topbar-profile" onClick={() => setTab("profile")} aria-label="Open profile">
            <UserAvatar
              size={34}
              className="topbar-avatar"
              fallback={<span className="topbar-avatar">{avatarLabel}</span>}
            />
            <span className="topbar-profile-copy">
              <b>{user?.name || "My Profile"}</b>
              <small className={isOnline ? "is-online" : "is-offline"}>{isOnline && <span className="online-status-dot" aria-hidden="true" />}{isOnline ? "Online" : "Offline"}</small>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default ResponsiveTopbar;
