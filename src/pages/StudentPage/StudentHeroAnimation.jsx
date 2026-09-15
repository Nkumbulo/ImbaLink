import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { T } from "../../styles/tokens";

// Enhanced animated hero card with larger size, CTA, and progress dots.
export default function StudentHeroAnimation({ isDesktop }) {
  const heroRef = useRef(null);
  const timerRef = useRef(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroInView, setHeroInView] = useState(false);

  const SLIDES = [
    {
      icon: "🏷️",
      title: "No agent fees. No hidden costs.",
      subtitle: "Student-friendly homes without the extra charges.",
      badge: "Save money",
      cta: "Browse homes",
      accent: "var(--theme-green, #2F7A55)",
      bg: "linear-gradient(135deg, color-mix(in srgb, var(--theme-green, #2F7A55) 18%, transparent), color-mix(in srgb, var(--theme-green, #2F7A55) 5%, transparent))",
      border: "color-mix(in srgb, var(--theme-green, #2F7A55) 35%, transparent)",
    },
    {
      icon: "🎓",
      title: "Built for students, by students.",
      subtitle: "Accommodation near campus, chosen by people like you.",
      badge: "Campus focused",
      cta: "Find accommodation",
      accent: "var(--theme-green, #2F7A55)",
      bg: "linear-gradient(135deg, color-mix(in srgb, var(--theme-green, #2F7A55) 18%, transparent), color-mix(in srgb, var(--theme-green, #2F7A55) 5%, transparent))",
      border: "color-mix(in srgb, var(--theme-green, #2F7A55) 35%, transparent)",
    },
    {
      icon: "💬",
      title: "Message owners directly.",
      subtitle: "No agents, no middlemen – talk straight to the landlord.",
      badge: "Direct contact",
      cta: "Start chatting",
      accent: "var(--theme-green, #2F7A55)",
      bg: "linear-gradient(135deg, color-mix(in srgb, var(--theme-green, #2F7A55) 18%, transparent), color-mix(in srgb, var(--theme-green, #2F7A55) 5%, transparent))",
      border: "color-mix(in srgb, var(--theme-green, #2F7A55) 35%, transparent)",
    },
    {
      icon: "🔑",
      title: "Share a home with roommates.",
      subtitle: "Split rent and utilities – find your perfect match.",
      badge: "Roommate ready",
      cta: "Find a roommate",
      accent: "rgba(201,162,75,0.8)",
      bg: "linear-gradient(135deg, rgba(201,162,75,0.18), rgba(201,162,75,0.05))",
      border: "rgba(222,197,164,0.35)",
    },
  ];

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroInView(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!heroInView) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % SLIDES.length);
    }, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [heroInView, SLIDES.length]);

  const slide = SLIDES[heroIndex];

  const scrollToHomes = () => {
    document.getElementById("student-homes")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      ref={heroRef}
      style={{
        marginTop: isDesktop ? 28 : 18,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes spSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spIconPop {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes spShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .sp-hero-card {
          animation: spSlideIn 600ms cubic-bezier(.22, 1, .36, 1) both;
          position: relative;
          overflow: hidden;
          border-radius: 18px;
          padding: ${isDesktop ? "18px 20px" : "14px 16px"};
          min-height: ${isDesktop ? "120px" : "104px"};
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        .sp-hero-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%);
          background-size: 200% 100%;
          animation: spShimmer 3s linear infinite;
          pointer-events: none;
        }
        .sp-hero-accent {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          border-radius: 0 4px 4px 0;
          background: ${slide.accent};
        }
        .sp-hero-icon {
          animation: spIconPop 500ms cubic-bezier(.22, 1, .36, 1) both;
          width: ${isDesktop ? "40px" : "34px"};
          height: ${isDesktop ? "40px" : "34px"};
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${isDesktop ? "20px" : "16px"};
          background: rgba(255,255,255,0.1);
          flex-shrink: 0;
        }
        .sp-hero-title {
          font-size: ${isDesktop ? "16px" : "14px"};
          line-height: 1.2;
          font-weight: 700;
          color: ${T.paper};
          letter-spacing: -0.01em;
        }
        .sp-hero-subtitle {
          font-size: ${isDesktop ? "11.5px" : "10.5px"};
          color: rgba(251,248,240,0.75);
          line-height: 1.4;
        }
        .sp-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: ${isDesktop ? "10px" : "9px"};
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: ${T.paper};
          white-space: nowrap;
        }
        .sp-hero-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: ${T.paper};
          color: ${T.ink};
          font-size: ${isDesktop ? "11px" : "10px"};
          font-weight: 700;
          border: none;
          border-radius: 8px;
          padding: 6px 12px;
          cursor: pointer;
          transition: transform 0.2s ease;
          align-self: flex-start;
        }
        .sp-hero-cta:hover {
          transform: translateY(-1px);
        }
        .sp-hero-dots {
          display: flex;
          gap: 6px;
          margin-top: 8px;
        }
        .sp-hero-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(251,248,240,0.3);
          transition: all 0.3s ease;
          cursor: pointer;
          border: none;
          padding: 0;
        }
        .sp-hero-dot.active {
          background: ${T.paper};
          width: 18px;
          border-radius: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          .sp-hero-card, .sp-hero-icon, .sp-hero-card::before {
            animation: none;
          }
        }
      `}</style>

      <div
        key={heroIndex}
        className="sp-hero-card"
        style={{
          background: slide.bg,
          border: `1px solid ${slide.border}`,
        }}
      >
        <div className="sp-hero-accent" />
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="sp-hero-icon">{slide.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sp-hero-title">{slide.title}</div>
            <div className="sp-hero-subtitle">{slide.subtitle}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span className="sp-hero-badge">✓ {slide.badge}</span>
          <button className="sp-hero-cta" onClick={scrollToHomes}>
            {slide.cta} <ArrowRight size={12} />
          </button>
        </div>
        <div className="sp-hero-dots">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              className={`sp-hero-dot ${idx === heroIndex ? "active" : ""}`}
              onClick={() => setHeroIndex(idx)}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
