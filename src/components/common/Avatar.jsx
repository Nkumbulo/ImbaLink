import { useEffect, useState } from "react";
import { T, GRADIENT } from "../../styles/tokens";

const FALLBACK_GRAD = ["#6E63B8", "#3E3670"];

/**
 * Google serves profile pictures from lh3.googleusercontent.com with a size
 * hint on the end of the path (…=s96-c). Rewriting it to what we actually
 * render stops a 21px tab icon from pulling a 400px file, and stops an 84px
 * profile header from upscaling a 96px one. Any other host is left alone.
 */
export function sizedAvatarUrl(url, size) {
  if (!url) return "";
  if (!url.includes("googleusercontent.com")) return url;
  const px = Math.max(48, Math.round(size * 2)); // 2x so it stays sharp on phones
  return url.replace(/=s\d+(-c)?$/, `=s${px}-c`);
}

/**
 * `src` is optional. When it's set (a Google account picture, usually) the
 * photo fills the circle; when it's missing — or the request fails, which
 * happens with expired Google URLs and on flaky connections — it falls back
 * to the gradient-and-initial circle this component always drew.
 */
export default function Avatar({ src, grad, letter, size = 34, ring, alt = "" }) {
  const [failed, setFailed] = useState(false);

  // A new photo deserves a fresh attempt, otherwise one failure would keep the
  // fallback pinned for the rest of the session (e.g. after switching account).
  useEffect(() => { setFailed(false); }, [src]);

  const colors = Array.isArray(grad) && grad.length === 2 ? grad : FALLBACK_GRAD;
  const showPhoto = Boolean(src) && !failed;

  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center f-display font-semibold"
      style={{ width: size, height: size, padding: ring ? 2 : 0, background: ring ? GRADIENT : "transparent" }}
    >
      <div
        className="rounded-full w-full h-full flex items-center justify-center overflow-hidden"
        style={{
          background: showPhoto ? T.paperDim : `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
          border: ring ? `2px solid ${T.paper}` : "none",
        }}
      >
        {showPhoto ? (
          <img
            src={sizedAvatarUrl(src, size)}
            alt={alt}
            // Google returns 403 for these when a referrer is sent from an
            // origin it doesn't recognise, which is every dev and preview URL.
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span style={{ color: T.paper, fontSize: size * 0.36 }}>{letter}</span>
        )}
      </div>
    </div>
  );
}
