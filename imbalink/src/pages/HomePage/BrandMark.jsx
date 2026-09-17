import { Link2 } from "lucide-react";

// The "ImbaLink" wordmark colors (white "Imba" + tan "Link") and the icon
// glyph are brand constants, not per-mode styling — kept in one place so
// Property Home and Commerce Home render the identical brand mark instead
// of each re-typing the two-tone text and icon separately.
const WORDMARK_WHITE = "#FFFFFF";
const WORDMARK_TAN = "#DEC5A4";

export default function BrandMark({
  iconAs: IconWrapper = "span",
  iconClassName,
  iconStyle,
  iconSize = 15,
  wordmarkAs: WordmarkWrapper = "span",
  wordmarkClassName,
  wordmarkStyle,
}) {
  return (
    <>
      <IconWrapper className={iconClassName} style={iconStyle}>
        <Link2 size={iconSize} strokeWidth={2.2} />
      </IconWrapper>
      <WordmarkWrapper className={wordmarkClassName} style={wordmarkStyle}>
        <span style={{ color: WORDMARK_WHITE }}>Imba</span>
        <span style={{ color: WORDMARK_TAN }}>Link</span>
      </WordmarkWrapper>
    </>
  );
}
