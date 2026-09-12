// The bulk of this file's content moved to styles/GlobalStyles.css (a real,
// statically-imported stylesheet — imported from main.jsx, see that file's
// import order for why the position matters). This component now renders
// only the Google Fonts @import, kept here and kept inline deliberately:
// CSS requires @import to be the first rule in its stylesheet, and this
// file gets bundled together with the app's other CSS into one combined
// output where it would no longer be first — so it stays as its own tiny,
// separately-injected <style> tag exactly as it worked before the split.
export default function GlobalStyles() {
  return (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    `}</style>
  );
}
