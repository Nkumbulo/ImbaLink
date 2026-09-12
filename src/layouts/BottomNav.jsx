import { HomeIcon, Search, MessageCircle, User, Wrench, GraduationCap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { T } from "../styles/tokens";
import UserAvatar from "../components/common/UserAvatar";

export default function BottomNav({ tab, setTab, unreadCount = 0, studentMode = false }) {
  const [collapsed, setCollapsed] = useState(false);
  const lastScrollY = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const ticking = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;
        if (currentY <= 12) setCollapsed(false);
        else if (delta > 8) setCollapsed(true);
        else if (delta < -8) setCollapsed(false);
        lastScrollY.current = currentY;
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const items = studentMode
    ? [
        { id: "home", icon: HomeIcon, label: "Home" },
        { id: "search", icon: Search, label: "Explore" },
        { id: "messages", icon: MessageCircle, label: "Messages", badge: unreadCount },
        { id: "services", icon: GraduationCap, label: "Roommates" },
        { id: "profile", icon: User, label: "Profile", profile: true },
      ]
    : [
        { id: "home", icon: HomeIcon, label: "Home" },
        { id: "search", icon: Search, label: "Explore" },
        { id: "messages", icon: MessageCircle, label: "Messages", badge: unreadCount },
        { id: "contractors", icon: Wrench, label: "Services" },
        { id: "profile", icon: User, label: "Profile", profile: true },
      ];

  const goTo = (id) => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    setTab(id);
  };

  return (
    <nav className={`app-nav mobile-floating-nav${collapsed ? " mobile-nav-collapsed" : ""}`} aria-label="Main navigation">
      <button
        type="button"
        className="mobile-nav-brand"
        onClick={() => { window.scrollTo({ top: 0, left: 0, behavior: "smooth" }); setCollapsed(false); }}
        aria-label="Back to top"
      >
        ImbaLink
      </button>
      <div className="app-nav-inner mobile-floating-nav-inner">
        {items.map(({ id, icon: Icon, label, badge = 0, profile }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => goTo(id)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`mobile-nav-item ${active ? "is-active" : ""} ${profile ? "is-profile" : ""}`}
            >
              <span className="mobile-nav-icon">
                {profile ? (
                  <UserAvatar
                    size={active ? 27 : 26}
                    ringColor={active ? T.ink : "#91A097"}
                    ringWidth={active ? 1.5 : 1}
                    muted={!active}
                    fallback={
                      <Icon
                        size={active ? 22 : 21}
                        color={active ? T.ink : "#B8C2BB"}
                        strokeWidth={active ? 2.4 : 2}
                      />
                    }
                  />
                ) : (
                  <Icon
                    size={active ? 22 : 21}
                    color={active ? T.ink : "#B8C2BB"}
                    strokeWidth={active ? 2.5 : 2}
                  />
                )}
                {badge > 0 && (
                  <span className="mobile-nav-badge" aria-label={`${badge} unread`}>
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              {!profile && <span className="mobile-nav-label">{label}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
