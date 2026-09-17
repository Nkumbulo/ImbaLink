export const T = {
  ink: "var(--theme-ink, #14201A)",
  paper: "var(--theme-surface, #FBF8F0)",
  paperDim: "var(--theme-surface-2, #F1EBDB)",
  paperDim2: "var(--theme-surface-3, #E9E1CB)",
  line: "var(--theme-line, #E7DFC9)",
  jacaranda: "#6E63B8",
  jacarandaDeep: "#544A96",
  brick: "#C1512F",
  msasa: "var(--theme-green, #2F7A55)",
  // Added alongside this pass: --theme-green-deep already exists as a CSS
  // var (set by main.jsx's applyStartupTheme, defined as a default in
  // ThemeStyles.css, and already used correctly via bare var(...) calls in
  // several places) but had no T.* entry, which is likely why components
  // reached for the literal hex "#204F3A" instead.
  msasaDeep: "var(--theme-green-deep, #204F3A)",
  ochre: "#B8842E",
  ink60: "var(--theme-muted, #62695F)",
  white: "#FFFFFF",
  // Fixed light text for hub banners that use the dark theme-green-deep accent.
  bannerText: "#FBF8F0",
  bannerTextMuted: "rgba(251,248,240,.62)",
  // Desktop light UI tokens are consumed by src/styles/desktop-light.css.
  // Keeping them here also makes the palette available to component-level styles.
  desktopPage: "var(--bg-page, #FDF6F0)",
  desktopSidebar: "var(--bg-sidebar, #FEFCF8)",
  desktopHeader: "var(--bg-header, #FFFFFF)",
  desktopCard: "var(--bg-card, #FFFFFF)",
  desktopFilter: "var(--bg-filter, #FFFFFF)",
  desktopBorder: "var(--border-soft, #F0E6E0)",
  desktopText: "var(--text-primary, #1A1A1A)",
  desktopMuted: "var(--text-muted, #6B5B5B)",
  desktopBurgundy: "var(--accent-burgundy, #7D3A4E)",
  desktopBlush: "var(--accent-blush, #F5E8EA)",
  desktopPendingBg: "var(--pending-bg, #FEF3C7)",
  desktopPendingText: "var(--pending-text, #92400E)",
  desktopShadow: "var(--shadow-soft, 0 4px 16px rgba(0,0,0,0.06))",
  desktopCardShadow: "var(--shadow-card, 0 8px 24px rgba(0,0,0,0.07))",
};
export const GRADIENT = `linear-gradient(135deg, ${T.jacaranda}, ${T.brick})`;
