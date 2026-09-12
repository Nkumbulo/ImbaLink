import { Link2 } from "lucide-react";
import { T } from "../../styles/tokens";

export default function Splash() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: T?.ink || "#0c1713",
      }}
    >
      {/* Subtle glow behind the logo */}
      <div
        className="absolute h-72 w-72 rounded-full blur-3xl opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(229,205,164,0.55) 0%, rgba(12,23,19,0) 70%)",
        }}
      />

      {/* ImbaLink Logo — same link-icon mark and wordmark colors used in the
          nav header/sidebar, instead of the old static PNG. */}
      <div className="relative flex flex-col items-center justify-center gap-4">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: "#F1EBDB",
            color: T?.msasa || "#2F7A55",
            border: "1px solid rgba(251,248,240,0.14)",
          }}
        >
          <Link2 size={42} strokeWidth={2.2} />
        </div>
        <div className="f-display font-extrabold" style={{ fontSize: 34, letterSpacing: "-0.02em" }}>
          <span style={{ color: "#FFFFFF" }}>Imba</span>
          <span style={{ color: "#DEC5A4" }}>Link</span>
        </div>
      </div>

      {/* Magnetic loading pill */}
      <div className="relative mt-10 flex h-8 w-24 items-center justify-center">
        <div className="magnetic-loader">
          <span className="magnetic-pill magnetic-pill-light" />
          <span className="magnetic-pill magnetic-pill-gold" />
        </div>
      </div>

      {/* Loading text */}
      <div
        className="mt-3 text-[10px] font-medium tracking-[0.28em] uppercase"
        style={{
          color: T?.paper || "#f4efe3",
          opacity: 0.42,
        }}
      >
        Connecting spaces
      </div>

      <style>{`
        .magnetic-loader {
          position: relative;
          width: 82px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .magnetic-pill {
          position: absolute;
          width: 42px;
          height: 14px;
          border-radius: 999px;
          transform-origin: center;
          box-shadow:
            0 3px 10px rgba(0, 0, 0, 0.18),
            inset 0 1px 1px rgba(255, 255, 255, 0.55);
        }

        .magnetic-pill-light {
          left: 5px;
          background: linear-gradient(
            90deg,
            #fffaf0 0%,
            #eee5d4 100%
          );
          animation: magnetLeft 1.35s ease-in-out infinite;
        }

        .magnetic-pill-gold {
          right: 5px;
          background: linear-gradient(
            90deg,
            #d6b67a 0%,
            #f0d39d 100%
          );
          animation: magnetRight 1.35s ease-in-out infinite;
        }

        @keyframes magnetLeft {
          0%,
          100% {
            transform: translateX(0) scaleX(1);
          }

          45% {
            transform: translateX(13px) scaleX(0.88);
          }

          55% {
            transform: translateX(13px) scaleX(0.88);
          }
        }

        @keyframes magnetRight {
          0%,
          100% {
            transform: translateX(0) scaleX(1);
          }

          45% {
            transform: translateX(-13px) scaleX(0.88);
          }

          55% {
            transform: translateX(-13px) scaleX(0.88);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .magnetic-pill-light,
          .magnetic-pill-gold {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}