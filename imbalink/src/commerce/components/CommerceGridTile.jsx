import { T } from "../../styles/tokens";
import VerifiedBadge from "../../components/common/VerifiedBadge";

export default function CommerceGridTile({ product, onOpen, compactDesktop = false }) {
  return (
    <button
      onClick={() => onOpen(product)}
      className="rise text-left rounded-2xl overflow-hidden active:scale-95 transition-transform"
      style={{
        background: T.paper,
        border: `1px solid ${T.line}`,
        width: "100%",
        minWidth: 0,
        display: "block",
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{ background: T.paperDim, aspectRatio: compactDesktop ? "4 / 3" : "4 / 5" }}
      >
        <img
          src={product.image}
          alt={product.title}
          className="w-full h-full object-cover"
          draggable={false}
          loading="lazy"
          decoding="async"
        />

        <div className="absolute top-2 right-2">
          <VerifiedBadge status={product.verified ? "verified" : "pending"} />
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-1">
          <span
            className="f-mono font-semibold px-2 py-1 rounded-full shrink-0"
            style={{
              background: "rgba(20,32,26,0.82)",
              color: T.white,
              fontSize: 11,
            }}
          >
            {product.currency}{Number(product.price || 0).toLocaleString()}
          </span>

          <span
            className="f-body truncate px-2 py-1 rounded-full"
            style={{
              background: "rgba(251,248,240,0.92)",
              color: T.ink,
              fontSize: 9.5,
            }}
          >
            {product.location}
          </span>
        </div>
      </div>
      <div className="px-2.5 pt-2 pb-2.5">
        <div
          className="f-body font-semibold truncate"
          style={{ color: T.ink, fontSize: 12 }}
          title={product.title}
        >
          {product.title}
        </div>
        <div
          className="f-body mt-0.5 truncate"
          style={{ color: T.ink60, fontSize: 10.5 }}
        >
          {product.type} · {product.condition}
        </div>
      </div>
    </button>
  );
}
