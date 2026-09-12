import { useEffect, useState } from "react";
import { Plus, Home, UsersRound, MessageCircle, ShieldCheck, ChevronRight, Clock3, BarChart3, Download } from "lucide-react";
import useMediaQuery from "../../hooks/useMediaQuery";
import { T } from "../../styles/tokens";
import ListingForm from "../../components/landlord/ListingForm";
import CompanyRegistration from "../../components/company/CompanyRegistration";

// Media query hook (same pattern as used elsewhere)

// Simple donut chart using SVG
function DonutChart({ data, colors, size = 120, strokeWidth = 12 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#eee"
        strokeWidth={strokeWidth}
      />
      {data.map((item, i) => {
        const dash = (item.value / total) * circumference;
        const circle = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors[i]}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += dash;
        return circle;
      })}
    </svg>
  );
}

// Simple bar chart using divs
function BarChart({ data, height = 120 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height }}>
      {data.map((item, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              width: "100%",
              height: `${(item.value / max) * 100}%`,
              background: T.jacaranda,
              borderRadius: 4,
              minHeight: 4,
            }}
          />
          <span style={{ fontSize: 9, color: T.ink60, marginTop: 4, whiteSpace: "nowrap" }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CompanyHubPage({
  properties,
  teamMembers,
  threads,
  viewingRequested,
  onCreateListing,
  onOpenProperty,
  companyRegistration,
  onRegisterCompany,
  profile,
}) {
  const [showForm, setShowForm] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const isTabletOrDesktop = useMediaQuery("(min-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isMobile = !isTabletOrDesktop; // true if <768px

  const companyListings = properties.filter(
    (p) => String(p.companyId || "") === String(profile?.id || null)
  );
  const staff = teamMembers || [];
  const activeChats = Object.keys(threads).length;
  const verified = companyListings.filter((p) => p.verification === "verified").length;
  const pending = companyListings.length - verified;

  // Analytics data
  const verificationData = [
    { label: "Verified", value: verified, color: T.msasa },
    { label: "Pending", value: pending, color: T.ochre },
  ];

  // Viewing requests per listing (top 4)
  const barData = companyListings.slice(0, 4).map((p) => ({
    label: p.title?.slice(0, 8) || "Listing",
    value: viewingRequested?.[p.id] ? 1 : 0,
  }));

  const stats = [
    [companyListings.length, "Listings", Home],
    [staff.length, "Agents", UsersRound],
    [activeChats, "Messages", MessageCircle],
    [verified, "Verified", ShieldCheck],
  ];

  // Responsive styles
  const containerStyle = {
    maxWidth: isDesktop ? 1200 : "100%",
    margin: isDesktop ? "0 auto" : undefined,
    padding: isTabletOrDesktop ? "24px" : "0 20px 20px", // increased padding on mobile
  };

  const statsGridStyle = {
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: isTabletOrDesktop ? 16 : 12, // increased gap on mobile
  };

  const mainContentStyle = isDesktop
    ? {
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: 24,
        marginTop: 32,
      }
    : isTabletOrDesktop
    ? { marginTop: 24 }
    : { marginTop: 0 }; // mobile: top spacing comes from statsSectionWrapperProps below

  // On mobile the page sits on the app shell's dark background, so the
  // stats/listings section needs its own light card (as it always had)
  // for the muted ink60 labels inside it to stay readable. On tablet/
  // desktop the page background is already light, so no extra card is
  // needed there.
  const statsSectionWrapperProps = isTabletOrDesktop
    ? {}
    : {
        className: "web-surface",
        style: { background: T.paper, borderRadius: 18, margin: "0 -20px", padding: "8px 16px 24px" },
      };

  // Additional mobile-specific spacing for sections inside left column
  const leftColumnStyle = {
    display: "flex",
    flexDirection: "column",
    gap: isMobile ? 32 : 24, // more gap between listings and team on mobile
  };

  const rightColumnStyle = isDesktop
    ? { display: "flex", flexDirection: "column", gap: 24 }
    : {};

  // Header subtitle bottom margin for mobile
  const headerSubtitleStyle = {
    color: T.ink60,
    fontSize: 13,
    marginBottom: isMobile ? 8 : 0, // add some space below subtitle on mobile
  };

  return (
    <div className="pb-8 web-page">
      {/* Header — copied from ContractorsPage's working pattern: a plain
          light header on tablet/desktop, and a dedicated .web-sticky-header
          class (single, unconditional dark background rule) on mobile. */}
      {isTabletOrDesktop ? (
        <div className="px-4 pt-3" style={{ maxWidth: isDesktop ? 1200 : "100%", margin: isDesktop ? "0 auto" : undefined }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div className="f-display font-bold" style={{ color: T.ink, fontSize: 24 }}>
                Company Hub
              </div>
              <div className="f-body mt-1" style={headerSubtitleStyle}>
                Register first, then manage listings, your team, client conversations, and performance analytics.
              </div>
            </div>

            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => {
                  if (companyRegistration) {
                    setShowForm(true);
                  } else {
                    setShowRegistration(true);
                  }
                }}
                className="contractors-desktop-register-btn"
              >
                {companyRegistration ? <Plus size={15} /> : <ShieldCheck size={15} />}
                {companyRegistration ? "Add a property" : "Register a company"}
              </button>

              {companyRegistration && (
                <div className="contractors-desktop-reg-status" style={{ textAlign: "right" }}>
                  Status: {companyRegistration.verificationStatus || "pending"}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="web-hero web-sticky-header" style={{ position: "sticky", top: 0, zIndex: 10, width: "100%", paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div style={{ padding: "12px 16px 16px" }}>
            <div className="f-display font-bold" style={{ color: T.bannerText, fontSize: 19 }}>
              Company Hub
            </div>
            <div className="f-body" style={{ color: T.bannerTextMuted, fontSize: 11.5, marginTop: 4 }}>
              Register first, then manage listings, your team, client conversations, and performance analytics.
            </div>

            <button
              type="button"
              onClick={() => {
                if (companyRegistration) {
                  setShowForm(true);
                } else {
                  setShowRegistration(true);
                }
              }}
              className="w-full rounded-2xl p-3 text-left flex items-center justify-between"
              style={{ background: T.paper, color: T.ink, border: "none", cursor: "pointer", marginTop: 12 }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: companyRegistration ? T.brick : T.paperDim }}>
                  {companyRegistration ? <Plus size={17} /> : <ShieldCheck size={16} />}
                </span>
                <div className="min-w-0">
                  <div className="f-display font-semibold" style={{ fontSize: 12.5 }}>
                    {companyRegistration ? "Add a property" : "Register a company"}
                  </div>
                  <div className="f-body" style={{ fontSize: 10, color: T.ink60, marginTop: 2 }}>
                    {companyRegistration
                      ? "Publish a property under your registered account"
                      : "Complete company registration before publishing a listing."}
                  </div>
                </div>
              </div>
              <ChevronRight size={17} className="shrink-0" />
            </button>
          </div>
        </div>
      )}

      <div style={containerStyle}>
        {/* Stats grid + main content: on mobile, wrapped in a light card
            (statsSectionWrapperProps) since the page itself sits on a dark
            background there; on tablet/desktop the wrapper is a no-op
            because the page background is already light. */}
        <div {...statsSectionWrapperProps}>
        <div className="grid" style={statsGridStyle}>
          {stats.map(([n, label, Icon]) => (
            <div
              key={label}
              className="rounded-2xl p-2.5 text-center"
              style={{ background: T.paperDim }}
            >
              <Icon
                size={isDesktop ? 20 : 15}
                className="mx-auto mb-1"
                style={{ color: T.jacaranda }}
              />
              <div className="f-display font-bold" style={{ color: T.ink, fontSize: isDesktop ? 18 : 15 }}>
                {n}
              </div>
              <div className="f-body" style={{ color: T.ink60, fontSize: isDesktop ? 11 : 9.5 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Main content: listings + team left, analytics right (analytics hidden on mobile) */}
        <div style={mainContentStyle}>
          {/* Left column: listings and team */}
          <div style={leftColumnStyle}>
            {/* Company Listings */}
            <div>
              <div
                className="f-mono mb-2"
                style={{ color: T.ink60, fontSize: 10, letterSpacing: ".16em" }}
              >
                COMPANY LISTINGS
              </div>
              <div className="space-y-2">
                {companyListings.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onOpenProperty(p)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-2xl"
                    style={{ background: T.paperDim }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${
                          p.grad?.[0] || T.jacaranda
                        }, ${p.grad?.[1] || T.brick})`,
                      }}
                    >
                      <Home size={19} color={T.paper} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="f-body font-semibold truncate"
                        style={{ color: T.ink, fontSize: 12.5 }}
                      >
                        {p.title}
                      </div>
                      <div
                        className="f-body mt-0.5 truncate"
                        style={{ color: T.ink60, fontSize: 10.5 }}
                      >
                        {p.suburb} · ${p.rent}/mo
                      </div>
                    </div>
                    <span
                      className="f-body px-2 py-1 rounded-full shrink-0"
                      style={{
                        background:
                          p.verification === "verified"
                            ? "color-mix(in srgb, var(--theme-green) 12%, transparent)"
                            : "rgba(184,132,46,.13)",
                        color: p.verification === "verified" ? T.msasa : T.ochre,
                        fontSize: 9.5,
                      }}
                    >
                      {p.verification === "verified" ? "Verified" : "Pending"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Team Members */}
            <div>
              <div
                className="f-mono mb-2"
                style={{ color: T.ink60, fontSize: 10, letterSpacing: ".16em" }}
              >
                TEAM MEMBERS
              </div>
              {staff.length === 0 ? (
                <div
                  className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: T.paperDim }}
                >
                  <Clock3 size={17} style={{ color: T.ink60 }} />
                  <span className="f-body" style={{ color: T.ink60, fontSize: 11.5 }}>
                    No agents added to your team yet.
                  </span>
                </div>
              ) : (
                staff.slice(0, 4).map((member) => (
                  <div
                    key={member.id}
                    className="rounded-2xl p-3 mb-2 flex items-center gap-3"
                    style={{ background: T.paperDim }}
                  >
                    <UsersRound size={17} style={{ color: T.jacaranda }} />
                    <div className="flex-1">
                      <div className="f-body font-semibold" style={{ color: T.ink, fontSize: 12 }}>
                        {member.name}
                      </div>
                      <div className="f-body" style={{ color: T.ink60, fontSize: 10.5 }}>
                        {member.role || "Agent"}
                      </div>
                    </div>
                    <span
                      className="f-body font-semibold"
                      style={{ color: T.jacarandaDeep, fontSize: 10 }}
                    >
                      Manage
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right column: Analytics (only shown on tablet/desktop) */}
          {isTabletOrDesktop && (
            <div style={rightColumnStyle}>
              {/* Analytics card */}
              <div
                className="rounded-2xl p-4"
                style={{ background: T.paperDim, display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} style={{ color: T.jacaranda }} />
                  <span className="f-display font-semibold" style={{ color: T.ink, fontSize: 14 }}>
                    Performance Analytics
                  </span>
                </div>

                {/* Verification donut */}
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <DonutChart
                    data={verificationData}
                    colors={[T.msasa, T.ochre]}
                    size={100}
                    strokeWidth={10}
                  />
                  <div>
                    <div className="f-body" style={{ color: T.ink60, fontSize: 10 }}>
                      Verified
                    </div>
                    <div className="f-display font-bold" style={{ color: T.ink, fontSize: 16 }}>
                      {verified}
                    </div>
                    <div className="f-body mt-2" style={{ color: T.ink60, fontSize: 10 }}>
                      Pending
                    </div>
                    <div className="f-display font-bold" style={{ color: T.ink, fontSize: 16 }}>
                      {pending}
                    </div>
                  </div>
                </div>

                {/* Viewings bar chart */}
                <div>
                  <div className="f-body" style={{ color: T.ink60, fontSize: 10, marginBottom: 8 }}>
                    Viewing requests per listing
                  </div>
                  <BarChart data={barData} />
                </div>

                {/* Quick controls */}
                <button
                  type="button"
                  className="w-full rounded-xl p-2.5 flex items-center justify-center gap-2"
                  style={{ background: T.ink, color: T.paper, border: "none", cursor: "pointer" }}
                >
                  <Download size={14} />
                  <span className="f-body" style={{ fontSize: 11 }}>
                    Download Report
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {showForm && companyRegistration && (
        <ListingForm
          onClose={() => setShowForm(false)}
          onCreate={async (listing) => {
            await onCreateListing(listing);
            setShowForm(false);
          }}
        />
      )}
      {showRegistration && (
        <CompanyRegistration
          profile={profile}
          onClose={() => setShowRegistration(false)}
          onSubmit={async (data) => {
            try {
              await onRegisterCompany(data);
              setShowRegistration(false);
            } catch (error) {
              console.error("Company registration failed:", error);
            }
          }}
        />
      )}
    </div>
  );
}