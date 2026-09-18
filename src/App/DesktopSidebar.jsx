import { Link2, HomeIcon, Compass, Mail, Bookmark, Wrench, GraduationCap, User, ShoppingBag, PlusCircle } from "lucide-react";
import UserAvatar from "../components/common/UserAvatar";

function DesktopSidebar({ tab, setTab, unreadCount = 0, studentMode = false, appMode = "property", onSwitchMode: _onSwitchMode }) {
  const items = appMode === "commerce"
    ? [
        { id: "home", label: "Marketplace", icon: ShoppingBag },
        { id: "search", label: "Explore", icon: Compass },
        { id: "messages", label: "Messages", icon: Mail, badge: unreadCount },
        { id: "saved", label: "Saved", icon: Bookmark },
        { id: "sell", label: "Sell", icon: PlusCircle },
      ]
    : studentMode
    ? [
        { id: "home", label: "Home", icon: HomeIcon },
        { id: "search", label: "Explore", icon: Compass },
        { id: "messages", label: "Messages", icon: Mail, badge: unreadCount },
        { id: "services", label: "Roommates", icon: GraduationCap },
        { id: "saved", label: "Saved Listings", icon: Bookmark },
        { id: "contractors", label: "Services", icon: Wrench },
      ]
    : [
        { id: "home", label: "Home", icon: HomeIcon },
        { id: "search", label: "Explore", icon: Compass },
        { id: "messages", label: "Messages", icon: Mail, badge: unreadCount },
        { id: "saved", label: "Saved Listings", icon: Bookmark },
        { id: "contractors", label: "Services", icon: Wrench },
        { id: "services", label: "Student", icon: GraduationCap },
      ];

  return (
    <aside className="desktop-sidebar desktop-light-sidebar">
      <button type="button" className="sidebar-brand" onClick={() => setTab("home")}>
        <span className="sidebar-brand-mark"><Link2 size={20} strokeWidth={2.2} /></span>
        <span><b>Imba</b><em>Link</em></span>
      </button>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {items.map(({ id, label, icon: Icon, badge, disabled }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            className={`sidebar-item ${tab === id ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
            onClick={() => !disabled && setTab(id)}
          >
            <span className="sidebar-icon">
              {id === "profile"
                ? <UserAvatar size={20} fallback={<Icon size={18} />} />
                : <Icon size={18} />}
            </span>
            <span>{label}</span>
            {badge > 0 && <b className="sidebar-badge">{badge > 9 ? "9+" : badge}</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          type="button"
          className={`sidebar-item ${tab === "profile" ? "is-active" : ""}`}
          onClick={() => setTab("profile")}
        >
          <span className="sidebar-icon"><UserAvatar size={20} fallback={<User size={18} />} /></span><span>Profile</span>
        </button>
        <div className="sidebar-help">No agent fees.<br />No hidden costs.</div>
      </div>
    </aside>
  );
}

export default DesktopSidebar;
