import { T } from "../../../styles/tokens";

export const TAP_HINT_STYLES = (
  <style>{`
    @keyframes tapHintFadeIn {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes tapHintFadeOut {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to   { opacity: 0; transform: translateX(-50%) translateY(-6px); }
    }
    @keyframes tapHintFloat {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50%      { transform: translateX(-50%) translateY(-5px); }
    }
    @keyframes tapHintRingPulse {
      0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.5); }
      70%  { box-shadow: 0 0 0 9px rgba(255,255,255,0); }
      100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
    }
    @keyframes skeletonPulse {
      0%, 100% { opacity: 0.35; }
      50%      { opacity: 0.7; }
    }
    @keyframes viewerFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes overlayFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes panelSlideUp {
      from {
        transform: translateY(40px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    @keyframes desktopCardIn {
      from {
        opacity: 0;
        transform: scale(0.96);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    @keyframes desktopPhotoFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    .tap-hint-wrap {
      animation:
        tapHintFadeIn .4s ease both,
        tapHintFloat 2.2s ease-in-out .4s infinite;
    }
    .tap-hint-wrap.leaving {
      animation: tapHintFadeOut .35s ease both;
    }
    .tap-hint-ring {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 9999px;
      background: rgba(255,255,255,0.16);
      animation: tapHintRingPulse 1.8s ease-out infinite;
    }
    .img-skeleton {
      animation: skeletonPulse 1.3s ease-in-out infinite;
    }
    .viewer-img-enter {
      animation: viewerFadeIn 0.3s ease;
    }

    .detail-photo-layer,
    .detail-photo-layer * {
      box-sizing: border-box;
    }
    .detail-photo-layer img {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      object-position: center !important;
    }
    .detail-photo-layer [style*="background-image"] {
      background-size: cover !important;
      background-position: center !important;
    }

    .detail-panel-scroll {
      scrollbar-width: thin;
      scrollbar-color: ${T.line} transparent;
    }
    .detail-panel-scroll::-webkit-scrollbar {
      width: 6px;
    }
    .detail-panel-scroll::-webkit-scrollbar-thumb {
      background: ${T.line};
      border-radius: 999px;
    }

    /* Mobile property sheet: motion/scroll only; no visual redesign. */
    @media (max-width: 767px) {
      .detail-panel-scroll {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;
        scroll-behavior: smooth;
        touch-action: pan-y;
      }
    }

    .desktop-overlay-fade { animation: overlayFadeIn 0.25s ease both; }
    .desktop-card-in { animation: desktopCardIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .desktop-photo-fade-in { animation: desktopPhotoFadeIn 0.4s 0.05s ease both; }

    @media (prefers-reduced-motion: reduce) {
      .tap-hint-wrap, .tap-hint-wrap.leaving, .tap-hint-ring, .img-skeleton, .viewer-img-enter,
      .overlay-fade-in, .panel-slide-up,
      .desktop-overlay-fade, .desktop-card-in, .desktop-photo-fade-in { animation: none !important; }
      .detail-panel-scroll { scroll-behavior: auto !important; }
    }
  `}</style>
);
