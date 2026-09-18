import { ArrowLeft, Eye, Users, MessageCircle, ShieldCheck, Home, Download } from "lucide-react";
import useMediaQuery from "../../hooks/useMediaQuery";
import { T } from "../../styles/tokens";

// Local media query hook (same pattern used elsewhere)

// Donut chart with improved styling
function DonutChart({ data, colors, size = 140, strokeWidth = 14 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Cumulative offset per segment, computed as a pure derivation instead of
  // mutating a shared `offset` variable inside .map() below — each
  // segment's starting offset is the running total of every prior
  // segment's dash length. Same visual result, no render-time mutation.
  const dashes = data.map((item) => (item.value / total) * circumference);
  const offsets = dashes.reduce((acc, dash, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + dashes[i - 1]);
    return acc;
  }, []);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={T.paperDim}
        strokeWidth={strokeWidth}
      />
      {data.map((_item, i) => {
        const dash = dashes[i];
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors[i]}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offsets[i]}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".3em"
        style={{ fontSize: size / 5, fontWeight: 700, fill: T.ink }}
      >
        {Math.round((data[0]?.value / total) * 100)}%
      </text>
    </svg>
  );
}

// Bar chart with rounded corners and gradient
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
              background: `linear-gradient(180deg, ${T.jacaranda}, ${T.jacarandaDeep})`,
              borderRadius: 6,
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

// Line chart for trends over time (smooth curve with area fill)
function LineChart({ data, labels, color = T.jacaranda, height = 160 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const min = 0;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((d.value - min) / (max - min)) * height,
  }));

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath = `${path} L 100 ${height} L 0 ${height} Z`;

  return (
    <div style={{ height }}>
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`lineGrad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#lineGrad-${color})`} stroke="none" />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {labels.map((label, i) => (
          <span key={i} style={{ fontSize: 9, color: T.ink60 }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PerformanceTrendsPage({
  properties,
  leads,
  threads,
  viewingRequested,
  onOpenProperty,
  onBack,
  ownerId,
}) {
  const isTabletOrDesktop = useMediaQuery("(min-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const myListings = properties.filter(
    (p) => String(p.agentId || p.companyId || "") === String(ownerId || null)
  );

  const listingMetrics = myListings.map((p) => {
    const views = Object.keys(viewingRequested || {}).filter(
      (id) => Number(id) === p.id && viewingRequested[id]
    ).length;
    const listingLeads = Object.keys(leads || {}).filter(
      (id) => Number(id) === p.id && leads[id]
    ).length;
    // `threads` is keyed by property id (see App.jsx's toLegacyThreadMessages
    // mirror) — the messages inside each thread don't carry their own
    // propertyId, so count by looking up this listing's own thread directly.
    const listingMessages = (threads?.[String(p.id)] || []).length;

    return { ...p, views, leads: listingLeads, messages: listingMessages };
  });

  const totalViews = listingMetrics.reduce((sum, p) => sum + p.views, 0);
  const totalLeads = listingMetrics.reduce((sum, p) => sum + p.leads, 0);
  const totalMessages = listingMetrics.reduce((sum, p) => sum + p.messages, 0);
  const verified = listingMetrics.filter((p) => p.verification === "verified").length;
  const pending = listingMetrics.length - verified;

  const verificationData = [
    { label: "Verified", value: verified, color: T.msasa },
    { label: "Pending", value: pending, color: T.ochre },
  ];

  const leadsByListing = listingMetrics.slice(0, 6).map((p) => ({
    label: p.title?.slice(0, 10) || "Listing",
    value: p.leads,
  }));

  const viewsByListing = listingMetrics.slice(0, 6).map((p) => ({
    label: p.title?.slice(0, 10) || "Listing",
    value: p.views,
  }));

  // Simulated trend data for last 6 months (replace with real data if available)
  const trendLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const viewsTrend = [12, 18, 15, 22, 28, 35].map((value) => ({ value }));
  const leadsTrend = [4, 6, 5, 9, 12, 15].map((value) => ({ value }));

  const containerStyle = {
    maxWidth: isDesktop ? 1200 : "100%",
    margin: isDesktop ? "0 auto" : undefined,
    padding: isTabletOrDesktop ? "24px" : "16px",
    background: T.paper,
    borderRadius: isTabletOrDesktop ? 24 : 0,
    boxShadow: isTabletOrDesktop ? "0 4px 20px rgba(0,0,0,0.06)" : "none",
  };

  const cardStyle = {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    border: `1px solid ${T.line}`,
  };

  const statCardStyle = {
    background: "#fff",
    borderRadius: 16,
    padding: "20px 12px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    border: `1px solid ${T.line}`,
  };

  const gridStyle = isDesktop
    ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }
    : { display: "flex", flexDirection: "column", gap: 16, marginTop: 16 };

  return (
    <div className="pb-8 web-page" style={{ background: T.paper, minHeight: "100vh" }}>
      <div style={containerStyle}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            onClick={onBack}
            style={{
              background: T.paperDim,
              border: `1px solid ${T.line}`,
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
            }}
            aria-label="Back"
          >
            <ArrowLeft size={18} color={T.ink} />
          </button>
          <div>
            <div className="f-display font-bold" style={{ color: T.ink, fontSize: isDesktop ? 24 : 19 }}>
              Performance Analytics
            </div>
            <div className="f-body" style={{ color: T.ink60, fontSize: isDesktop ? 13 : 11.5 }}>
              Insights and trends for your listings
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: isTabletOrDesktop ? 16 : 8 }}>
          {[
            [totalViews, "Views", Eye],
            [totalLeads, "Leads", Users],
            [totalMessages, "Messages", MessageCircle],
            [verified, "Verified", ShieldCheck],
          ].map(([n, label, Icon]) => (
            <div key={label} style={statCardStyle}>
              <Icon size={isDesktop ? 22 : 18} style={{ color: T.jacaranda, margin: "0 auto 8px" }} />
              <div className="f-display font-bold" style={{ color: T.ink, fontSize: isDesktop ? 20 : 16 }}>{n}</div>
              <div className="f-body" style={{ color: T.ink60, fontSize: isDesktop ? 11 : 9.5 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Charts area */}
        <div style={gridStyle}>
          {/* Verification donut */}
          <div style={cardStyle}>
            <div className="f-display font-semibold" style={{ color: T.ink, fontSize: 16, marginBottom: 16 }}>
              Verification Status
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DonutChart data={verificationData} colors={[T.msasa, T.ochre]} size={160} strokeWidth={16} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: T.msasa }} />
                <span style={{ fontSize: 11, color: T.ink }}>Verified ({verified})</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: T.ochre }} />
                <span style={{ fontSize: 11, color: T.ink }}>Pending ({pending})</span>
              </div>
            </div>
          </div>

          {/* Leads bar chart */}
          <div style={cardStyle}>
            <div className="f-display font-semibold" style={{ color: T.ink, fontSize: 16, marginBottom: 16 }}>
              Leads by Listing
            </div>
            <BarChart data={leadsByListing} />
          </div>

          {/* Line chart for trends */}
          <div style={cardStyle}>
            <div className="f-display font-semibold" style={{ color: T.ink, fontSize: 16, marginBottom: 16 }}>
              Performance Trend (6 months)
            </div>
            <LineChart data={viewsTrend} labels={trendLabels} color={T.jacaranda} height={160} />
          </div>

          {/* Views bar chart */}
          <div style={cardStyle}>
            <div className="f-display font-semibold" style={{ color: T.ink, fontSize: 16, marginBottom: 16 }}>
              Viewing Requests by Listing
            </div>
            <BarChart data={viewsByListing} />
          </div>
        </div>

        {/* Export and listing performance */}
        <div style={{ marginTop: 32 }}>
          <div className="f-mono mb-2" style={{ color: T.ink60, fontSize: 10, letterSpacing: ".16em" }}>
            LISTING PERFORMANCE
          </div>
          <div className="space-y-3">
            {listingMetrics.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpenProperty(p)}
                className="w-full text-left flex items-center gap-3 p-4 rounded-2xl"
                style={{ background: "#fff", border: `1px solid ${T.line}`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${p.grad?.[0] || T.jacaranda}, ${p.grad?.[1] || T.brick})`,
                  }}
                >
                  <Home size={19} color={T.paper} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="f-body font-semibold truncate" style={{ color: T.ink, fontSize: 13 }}>
                    {p.title}
                  </div>
                  <div className="f-body mt-0.5 truncate" style={{ color: T.ink60, fontSize: 11 }}>
                    {p.suburb} · ${p.rent}/mo
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Eye size={15} color={T.ink60} />
                    <span style={{ fontSize: 11, color: T.ink }}>{p.views}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Users size={15} color={T.ink60} />
                    <span style={{ fontSize: 11, color: T.ink }}>{p.leads}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <MessageCircle size={15} color={T.ink60} />
                    <span style={{ fontSize: 11, color: T.ink }}>{p.messages}</span>
                  </div>
                </div>
                <span
                  className="f-body px-2 py-1 rounded-full shrink-0"
                  style={{
                    background: p.verification === "verified" ? "color-mix(in srgb, var(--theme-green) 12%, transparent)" : "rgba(184,132,46,.13)",
                    color: p.verification === "verified" ? T.msasa : T.ochre,
                    fontSize: 10,
                  }}
                >
                  {p.verification === "verified" ? "Verified" : "Pending"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Download Report button */}
        <div style={{ marginTop: 24 }}>
          <button
            className="w-full rounded-xl p-3 flex items-center justify-center gap-2"
            style={{
              background: T.ink,
              color: T.paper,
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <Download size={16} />
            Download Full Report
          </button>
        </div>
      </div>
    </div>
  );
}