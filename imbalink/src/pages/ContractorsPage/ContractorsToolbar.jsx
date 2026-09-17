import { Briefcase, Search } from "lucide-react";
import { T } from "../../styles/tokens";

export default function ContractorsToolbar({
  isTabletOrDesktop,
  query,
  setQuery,
  category,
  setCategory,
  categories,
  results,
  registration,
  setShowRegistration,
}) {
  if (isTabletOrDesktop) {
    return (
      <div className="contractors-desktop-toolbar px-4 pt-4">
        <div className="contractors-desktop-search-row">
          <div className="contractors-desktop-search">
            <Search size={16} style={{ color: T.ink60, flexShrink: 0 }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search contractors or services"
              aria-label="Search contractors"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowRegistration(true)}
            className="contractors-desktop-register-btn"
          >
            <Briefcase size={15} />
            {registration ? "Manage registration" : "Register as a contractor"}
          </button>
        </div>

        {registration && (
          <div className="contractors-desktop-reg-status">
            Application status: {registration.verificationStatus || "pending"}
          </div>
        )}

        <div className="contractors-desktop-categories">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`contractors-desktop-category-pill ${category === item ? "is-active" : ""}`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="contractors-desktop-count">
          {results.length} contractor{results.length === 1 ? "" : "s"} found
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4" style={{ background: T.paper }}>
      <div
        className="flex items-center gap-2 h-10 px-3.5 rounded-full"
        style={{ background: T.paperDim, border: `1px solid ${T.line}` }}
      >
        <Search size={15} style={{ color: T.ink60, flexShrink: 0 }} />

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search contractors or services"
          aria-label="Search contractors"
          className="f-body bg-transparent outline-none flex-1"
          style={{ color: T.ink, fontSize: 16, minWidth: 0 }}
        />
      </div>

      <div className="flex gap-1.5 mt-3 overflow-x-auto noscroll pb-1" style={{ scrollbarWidth: "none" }}>
        {categories.map((item) => (
          <button
            key={item}
            onClick={() => setCategory(item)}
            className="f-body font-medium px-3 py-1.5 rounded-full whitespace-nowrap active:scale-95"
            style={{
              background: category === item ? T.jacaranda : T.paperDim,
              color: category === item ? T.paper : T.ink,
              fontSize: 10.5,
              border: "none",
              cursor: "pointer",
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
