// The compact-desktop card shell + its hover/selected detail overlay.
// Depends on theme tokens (T.paper / T.line), so it's a function rather
// than a plain string constant — same reason LIKE_ANIM_STYLES in
// animationStyles.js doesn't need to be (it has no token references).
export const getCompactCardStyles = (T) => `
  .post-card-compact {
    position: relative;
    isolation: isolate;
    overflow: visible;
    min-width: 0;
  }
  .post-card-compact[data-property-card-selected="true"] {
    z-index: 100 !important;
  }
  .post-card-compact .desktop-detail-overlay {
    position: absolute;
    inset: 0;
    z-index: 30;
    box-sizing: border-box;
    overflow: hidden;
    border-radius: 18px;
    background: ${T.paper};
    border: 1px solid ${T.line};
    box-shadow: 0 18px 40px rgba(20, 32, 26, 0.16);
    opacity: 0;
    transform: translateY(-18px) scale(0.985);
    transform-origin: top center;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    pointer-events: none;
    transition: opacity 220ms ease, transform 280ms cubic-bezier(.22,1,.36,1);
  }
  .post-card-compact .desktop-detail-overlay.is-open {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }
  @media (prefers-reduced-motion: reduce) {
    .post-card-compact .desktop-detail-overlay { transition: none; }
  }
`;
