import { HomeIcon, Compass, Mail, Wrench, User, GraduationCap, ShoppingBag, PlusCircle } from "lucide-react";
import { T } from "../styles/tokens";
import UserAvatar from "../components/common/UserAvatar";

function TabletBottomNav({ tab, setTab, unreadCount = 0, studentMode = false, appMode = "property", onSwitchMode: _onSwitchMode }) {
  const items = appMode === "commerce"
    ? [
        { id: "home", icon: ShoppingBag, label: "Shop" },
        { id: "search", icon: Compass, label: "Explore" },
        { id: "messages", icon: Mail, label: "Messages", badge: unreadCount },
        { id: "sell", icon: PlusCircle, label: "Sell" },
        { id: "profile", icon: User, label: "Profile", profile: true },
      ]
    : studentMode
    ? [
        { id: "home", icon: HomeIcon, label: "Home" },
        { id: "search", icon: Compass, label: "Explore" },
        { id: "messages", icon: Mail, label: "Messages", badge: unreadCount },
        { id: "services", icon: GraduationCap, label: "Roommates" },
        { id: "profile", icon: User, label: "Profile", profile: true },
      ]
    : [
        { id: "home", icon: HomeIcon, label: "Home" },
        { id: "search", icon: Compass, label: "Explore" },
        { id: "messages", icon: Mail, label: "Messages", badge: unreadCount },
        { id: "contractors", icon: Wrench, label: "Services" },
        { id: "profile", icon: User, label: "Profile", profile: true },
      ];

  return (
    <nav className="tablet-bottom-nav" aria-label="Main navigation">
      {items.map(({ id, icon: Icon, label, badge = 0, profile }) => (
        <button
          key={id}
          type="button"
          className={`tablet-bottom-item ${tab === id ? "is-active" : ""}`}
          aria-current={tab === id ? "page" : undefined}
          onClick={() => {
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            setTab(id);
          }}
        >
          <span className="tablet-bottom-icon">
            {profile ? (
              <UserAvatar size={24} ringColor={tab === id ? T.ink : "rgba(255,255,255,.55)"} ringWidth={tab === id ? 2 : 1.5} muted={tab !== id} fallback={<Icon size={21} strokeWidth={tab === id ? 2.4 : 2} />} />
            ) : (
              <Icon size={21} strokeWidth={tab === id ? 2.4 : 2} />
            )}
            {badge > 0 && <b>{badge > 9 ? "9+" : badge}</b>}
          </span>
          {!profile && <small>{label}</small>}
        </button>
      ))}
    </nav>
  );
}

export default TabletBottomNav;
