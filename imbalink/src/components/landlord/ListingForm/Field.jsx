import { T } from "../../../styles/tokens";

export default function Field({ label, children }) {
  return (
    <label className="block">
      <span className="f-body font-semibold block mb-1.5" style={{ color: T.ink60, fontSize: 10 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
