import { T } from "../../../styles/tokens";

export default function PostCardToast({ toastVisible, toastText }) {
  if (!toastVisible) return null;

  return (
    <div
      className="fixed left-1/2 z-[1100] fade"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
        transform: "translateX(-50%)",
        pointerEvents: "none",
      }}
    >
      <div
        className="rise flex items-center gap-2 px-4 py-2.5 rounded-full"
        style={{
          background: "rgba(20,32,26,0.92)",
          color: T.paper,
          fontSize: 12.5,
          fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.24)",
          whiteSpace: "nowrap",
        }}
      >
        {toastText}
      </div>
    </div>
  );
}
