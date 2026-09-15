import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import Avatar, { sizedAvatarUrl } from "./Avatar";

/**
 * The signed-in user's own picture, wherever the UI used to draw a generic
 * person icon or an initial. It reads the session directly so call sites don't
 * have to thread `user` down through props.
 *
 * `avatarUrl` comes from Google via supabaseAuthProvider. Accounts that signed
 * in with business credentials have no picture, so pass a `fallback` — the icon
 * or letter that was there before — and it renders that instead. The fallback
 * also covers a photo that fails to load.
 */
export default function UserAvatar({
  size = 34,
  className = "",
  ringColor = null,
  ringWidth = 2,
  muted = false,
  fallback = null,
}) {
  const { user } = useAuth();
  const url = user?.avatarUrl || "";
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [url]);

  if (!url || failed) {
    if (fallback) return fallback;
    const letter = String(user?.firstName || user?.name || user?.email || "U").trim().charAt(0).toUpperCase() || "U";
    return <Avatar grad={["#6E63B8", "#3E3670"]} letter={letter} size={size} />;
  }

  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        overflow: "hidden",
        flexShrink: 0,
        boxSizing: "border-box",
        border: ringColor ? `${ringWidth}px solid ${ringColor}` : "none",
        opacity: muted ? 0.72 : 1,
      }}
    >
      <img
        src={sizedAvatarUrl(url, size)}
        alt={user?.name ? `${user.name}'s profile picture` : "Your profile picture"}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </span>
  );
}
