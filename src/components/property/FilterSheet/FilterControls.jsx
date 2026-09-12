import { T } from "../../../styles/tokens";

// Previously defined INSIDE FilterSheet's render function, which meant a
// new Label/FilterOption function value was created on every single
// render of the sheet. Both are pure — no closure over FilterSheet's own
// state, only the `T` design-token import and their own props — so
// moving them to module scope changes nothing about what they render,
// just avoids recreating them needlessly.
export function Label({ children }) {
  return (
    <div
      className="f-body font-semibold mb-2"
      style={{ color: T.ink60, fontSize: 10.5, letterSpacing: "0.12em" }}
    >
      {children}
    </div>
  );
}

export function FilterOption({ value, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="f-body font-medium px-3 py-1.5 rounded-full active:scale-95"
      style={{
        background: selected ? T.jacaranda : T.paperDim,
        color: selected ? T.paper : T.ink,
        fontSize: 11.5,
        border: "none",
        cursor: "pointer",
        transition: "transform 0.12s ease, background 0.15s ease",
      }}
    >
      {value}
    </button>
  );
}
