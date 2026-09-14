import React from "react";
import logoMark from "../../assets/imbalink-logo-mark.png";

/**
 * ImbaLink logo mark. Replaces the old `Link2` lucide-react icon that was
 * previously used as a stand-in brand mark across the splash screen, nav,
 * sidebar, and the "ImbaLink assistant" message bubble.
 */
export default function LogoMark({ size = 20, className = "", style = {}, alt = "ImbaLink" }) {
  return (
    <img
      src={logoMark}
      alt={alt}
      className={className}
      draggable={false}
      style={{
        width: size,
        height: "auto",
        objectFit: "contain",
        userSelect: "none",
        ...style,
      }}
    />
  );
}
