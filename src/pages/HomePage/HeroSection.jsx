import React, { useEffect, useRef } from "react";
import { T } from "../../styles/tokens";

// Previously defined inline inside HomePage.jsx. Genuinely self-contained
// already (its own state via heroRef/heroTimerRef/heroIndex/heroInView,
// only ever takes `isDesktop` as a prop) — confirmed via grep that it
// references nothing else from HomePage's own scope before extracting.

const HeroSection = React.memo(function HeroSection({ isDesktop = false }) {
  const heroRef = useRef(null);
  const heroTimerRef = useRef(null);
  const [heroIndex, setHeroIndex] = React.useState(0);
  const [heroInView, setHeroInView] = React.useState(false);

  const HERO_SLIDE_COUNT = 4;

  useEffect(() => {
    if (isDesktop) return;
    const el = heroRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setHeroInView(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isDesktop]);

  useEffect(() => {
    if (isDesktop) return;
    if (!heroInView) {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
      heroTimerRef.current = null;
      return;
    }

    heroTimerRef.current = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % HERO_SLIDE_COUNT);
    }, 5500);

    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
      heroTimerRef.current = null;
    };
  }, [heroInView, isDesktop]);

  if (isDesktop) {
    return null;
  }

  return (
    <div
      ref={heroRef}
      className="web-subhero px-4"
      style={{
        paddingTop: 0,
        height: 64,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes hpHeroIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hpHeroIconIn {
          from { opacity: 0; transform: scale(0.88) translateY(5px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .hp-hero-message { animation: hpHeroIn 520ms cubic-bezier(.22, 1, .36, 1) both; }
        .hp-hero-icon { animation: hpHeroIconIn 520ms cubic-bezier(.22, 1, .36, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .hp-hero-message, .hp-hero-icon { animation: none; }
        }
      `}</style>

      {heroIndex === 0 ? (
        <div
          key="no-agent-fees"
          className="hp-hero-message flex flex-col justify-center gap-1"
          style={{
            width: "100%",
            padding: "8px 11px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(67,143,105,0.14), rgba(255,255,255,0.03))",
            border: "1px solid rgba(114,183,141,0.22)",
          }}
        >
          <div
            className="f-display font-bold"
            style={{
              color: T.paper,
              fontSize: 12.5,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              width: "100%",
            }}
          >
            No agent fees. No hidden costs.
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
              <div className="hp-hero-icon flex items-center justify-center shrink-0" style={{ width: 20, height: 20, borderRadius: "50%", background: "#CFEAD9" }}>
                <span style={{ fontSize: 10 }}>🏷️</span>
              </div>
              <div className="f-body" style={{ color: "rgba(251,248,240,0.62)", fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Find your next home for less.
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(67,143,105,0.22)", border: "1px solid rgba(114,183,141,0.3)" }}>
              <span style={{ fontSize: 8, color: "#9AD4B3" }}>❤️</span>
              <span className="f-body font-semibold" style={{ color: "#9AD4B3", fontSize: 8, whiteSpace: "nowrap" }}>
                That's ImbaLink
              </span>
            </div>
          </div>
        </div>
      ) : heroIndex === 1 ? (
        <div key="find-home" className="hp-hero-message" style={{ width: "100%" }}>
          <div className="f-display font-bold" style={{ color: T.paper, fontSize: 21, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Find your next home
          </div>
          <div className="f-body mt-1" style={{ color: "rgba(251,248,240,0.62)", fontSize: 12, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            Find rooms, houses and apartments that fit your needs.
          </div>
        </div>
      ) : heroIndex === 2 ? (
        <div
          key="direct-messaging"
          className="hp-hero-message flex flex-col justify-center gap-1"
          style={{
            width: "100%",
            padding: "8px 11px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(67,143,105,0.14), rgba(255,255,255,0.03))",
            border: "1px solid rgba(114,183,141,0.22)",
          }}
        >
          <div
            className="f-display font-bold"
            style={{
              color: T.paper,
              fontSize: 12.5,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              width: "100%",
            }}
          >
            Message owners directly.
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
              <div className="hp-hero-icon flex items-center justify-center shrink-0" style={{ width: 20, height: 20, borderRadius: "50%", background: "#CFEAD9" }}>
                <span style={{ fontSize: 10 }}>💬</span>
              </div>
              <div className="f-body" style={{ color: "rgba(251,248,240,0.62)", fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                No agents, no middlemen.
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(67,143,105,0.22)", border: "1px solid rgba(114,183,141,0.3)" }}>
              <span style={{ fontSize: 8, color: "#9AD4B3" }}>❤️</span>
              <span className="f-body font-semibold" style={{ color: "#9AD4B3", fontSize: 8, whiteSpace: "nowrap" }}>
                That's ImbaLink
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div
          key="landlord-onboarding"
          className="hp-hero-message flex flex-col justify-center gap-1"
          style={{
            width: "100%",
            padding: "8px 11px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(67,143,105,0.14), rgba(255,255,255,0.03))",
            border: "1px solid rgba(114,183,141,0.22)",
          }}
        >
          <div
            className="f-display font-bold"
            style={{
              color: T.paper,
              fontSize: 12.5,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              width: "100%",
            }}
          >
            Landlords list free on ImbaLink.
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
              <div className="hp-hero-icon flex items-center justify-center shrink-0" style={{ width: 20, height: 20, borderRadius: "50%", background: "#CFEAD9" }}>
                <span style={{ fontSize: 10 }}>🔑</span>
              </div>
              <div className="f-body" style={{ color: "rgba(251,248,240,0.62)", fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Reach renters directly, no agent cut.
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(67,143,105,0.22)", border: "1px solid rgba(114,183,141,0.3)" }}>
              <span style={{ fontSize: 8, color: "#9AD4B3" }}>❤️</span>
              <span className="f-body font-semibold" style={{ color: "#9AD4B3", fontSize: 8, whiteSpace: "nowrap" }}>
                That's ImbaLink
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default HeroSection;
