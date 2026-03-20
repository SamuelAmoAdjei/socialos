"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const POSTS = [
  { platforms: ["LI", "IG"], text: "Excited to share our Q1 results with the community...", client: "Acme Corp", time: "Today, 09:00", status: "published" },
  { platforms: ["LI", "X", "FB"], text: "Behind the scenes look at how we build our products...", client: "Nova Brands", time: "Tomorrow, 11:00", status: "scheduled" },
  { platforms: ["IG", "TT"], text: "Spring collection is here. Every piece tells a story...", client: "Petal Studio", time: "Awaiting approval", status: "pending" },
  { platforms: ["LI"], text: "Thoughts on the future of remote work and distributed teams...", client: "Acme Corp", time: "Mar 25, 14:00", status: "draft" },
];

const PLATFORMS = [
  { name: "LinkedIn",  pct: 82, color: "linear-gradient(90deg,#0077B5,#00A0DC)" },
  { name: "Instagram", pct: 67, color: "linear-gradient(90deg,#F58529,#DD2A7B)" },
  { name: "Facebook",  pct: 54, color: "linear-gradient(90deg,#1877F2,#42A5F5)" },
  { name: "X",         pct: 43, color: "linear-gradient(90deg,#555,#888)" },
  { name: "TikTok",    pct: 38, color: "linear-gradient(90deg,#010101,#69C9D0)" },
];

const STATS = [
  { icon: CalIcon,   label: "Posts Scheduled", value: "24", change: "+6 this week",   dir: "up", color: "#4F8EF7", bg: "rgba(79,142,247,0.12)" },
  { icon: CheckIcon, label: "Posts Published",  value: "148", change: "+12 this month", dir: "up", color: "#06D6A0", bg: "rgba(6,214,160,0.12)" },
  { icon: TrendIcon, label: "Avg Engagement",   value: "4.8%", change: "+0.3% vs last month", dir: "up", color: "#F7C948", bg: "rgba(247,201,72,0.12)" },
  { icon: UserIcon,  label: "Active Clients",   value: "3",    change: "All active",  dir: "up", color: "#FF4D6D", bg: "rgba(255,77,109,0.12)" },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-head)", fontSize: "1.4rem", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4 }}>
          Good morning, {firstName}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Here is what is happening across your clients today.
        </p>
      </div>

      {/* Stat cards */}
      <div style={S.statsGrid}>
        {STATS.map((s, i) => (
          <div key={i} style={S.statCard} className={`anim-fade-up stagger-${i + 1}`}>
            <div style={{ ...S.statIcon, background: s.bg, color: s.color }}>
              <s.icon />
            </div>
            <div style={S.statValue}>{s.value}</div>
            <div style={S.statLabel}>{s.label}</div>
            <div style={{ ...S.change, background: "rgba(6,214,160,0.1)", color: "var(--accent2)" }}>
              {s.change}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column grid */}
      <div style={S.grid2}>
        {/* Recent posts */}
        <div style={S.card} className="anim-fade-up stagger-2">
          <div style={S.cardHead}>
            <span style={S.cardTitle}>Recent Posts</span>
            <button style={S.cardAction} onClick={() => router.push("/dashboard/schedule")}>View all</button>
          </div>
          {POSTS.map((p, i) => (
            <div key={i} style={S.postRow}>
              <div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 2 }}>
                {p.platforms.map(plat => (
                  <div key={plat} style={{ ...S.platDot, ...PLAT_STYLES[plat] }}>{plat}</div>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.postText}>{p.text}</div>
                <div style={S.postMeta}>
                  <span>{p.client}</span>
                  <span>{p.time}</span>
                </div>
              </div>
              <div style={{ ...S.pill, ...PILL_STYLES[p.status] }}>{p.status}</div>
            </div>
          ))}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Platform bars */}
          <div style={S.card} className="anim-fade-up stagger-3">
            <div style={S.cardHead}>
              <span style={S.cardTitle}>Platform Performance</span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>This month</span>
            </div>
            {PLATFORMS.map((p, i) => (
              <div key={i} style={S.barRow}>
                <span style={S.barName}>{p.name}</span>
                <div style={S.barTrack}>
                  <div style={{ ...S.barFill, width: `${p.pct}%`, background: p.color }} />
                </div>
                <span style={S.barPct}>{p.pct}%</span>
              </div>
            ))}

            {/* Ops budget */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 500 }}>Make.com Operations</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>420 / 1,000</span>
              </div>
              <div style={S.barTrack}>
                <div style={{ ...S.barFill, width: "42%", background: "linear-gradient(90deg,var(--accent),var(--accent2))" }} />
              </div>
              <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 6 }}>580 operations remaining this month</p>
            </div>
          </div>

          {/* Quick compose CTA */}
          <button
            style={S.composeCta}
            onClick={() => router.push("/dashboard/compose")}
            className="anim-fade-up stagger-4"
          >
            <div style={S.ctaIcon}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
                <path d="M10 4v12M4 10h12"/>
              </svg>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 2 }}>Create a new post</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Draft, preview on all platforms, then schedule or publish instantly</div>
            </div>
            <svg style={{ marginLeft: "auto", color: "var(--text-muted)", flexShrink: 0 }}
              width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 10h12M12 6l4 4-4 4"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Platform dot styles ── */
const PLAT_STYLES: Record<string, React.CSSProperties> = {
  LI: { background: "rgba(0,119,181,0.2)",  color: "#0077B5" },
  X:  { background: "rgba(255,255,255,0.1)", color: "var(--text-primary)" },
  IG: { background: "rgba(225,48,108,0.15)", color: "#E1306C" },
  FB: { background: "rgba(24,119,242,0.15)", color: "#1877F2" },
  TT: { background: "rgba(0,0,0,0.2)",       color: "var(--text-secondary)" },
};

const PILL_STYLES: Record<string, React.CSSProperties> = {
  published: { background: "rgba(6,214,160,0.12)",   color: "var(--accent2)" },
  scheduled: { background: "rgba(79,142,247,0.12)",  color: "var(--accent)" },
  pending:   { background: "rgba(247,201,72,0.12)",  color: "var(--accent3)" },
  draft:     { background: "rgba(255,255,255,0.07)", color: "var(--text-muted)" },
};

/* ── Icons ── */
const ico = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const };
function CalIcon()   { return <svg {...ico}><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M14 2v4M6 2v4M2 8h16"/></svg>; }
function CheckIcon() { return <svg {...ico}><path d="M4 10l4 4 8-8"/></svg>; }
function TrendIcon() { return <svg {...ico}><path d="M2 14l4-5 4 3 4-6 4 2"/></svg>; }
function UserIcon()  { return <svg {...ico}><circle cx="8" cy="6" r="3"/><path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/><path d="M14 8a3 3 0 010 5M17 18c0-2.5-1-4-3-5"/></svg>; }

/* ── Styles ── */
const S: Record<string, React.CSSProperties> = {
  statsGrid: {
    display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24,
  },
  statCard: {
    background: "var(--bg-card)", backdropFilter: "blur(16px)",
    border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 20, cursor: "default",
  },
  statIcon: {
    width: 38, height: 38, borderRadius: "var(--radius-sm)",
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  statValue: {
    fontFamily: "var(--font-head)", fontSize: "1.8rem", fontWeight: 700,
    letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4,
  },
  statLabel: { fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 500, marginBottom: 10 },
  change: {
    display: "inline-flex", alignItems: "center", gap: 4,
    fontSize: "0.72rem", fontWeight: 600,
    padding: "3px 7px", borderRadius: 20,
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  card: {
    background: "var(--bg-card)", backdropFilter: "blur(16px)",
    border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    overflow: "hidden", padding: 18,
  },
  cardHead: {
    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14,
  },
  cardTitle: { fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 600 },
  cardAction: {
    fontSize: "0.78rem", color: "var(--accent)", cursor: "pointer",
    background: "none", border: "none", fontFamily: "var(--font-body)",
  },
  postRow: {
    display: "flex", alignItems: "flex-start", gap: 12,
    padding: "12px 0", borderBottom: "1px solid var(--border)", cursor: "pointer",
  },
  platDot: {
    width: 22, height: 22, borderRadius: 6,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "0.6rem", fontWeight: 700,
  },
  postText: {
    fontSize: "0.83rem", whiteSpace: "nowrap", overflow: "hidden",
    textOverflow: "ellipsis", marginBottom: 4,
  },
  postMeta: {
    fontSize: "0.72rem", color: "var(--text-muted)",
    display: "flex", gap: 10,
  },
  pill: {
    fontSize: "0.68rem", fontWeight: 600,
    padding: "3px 9px", borderRadius: 20,
    whiteSpace: "nowrap", flexShrink: 0,
    textTransform: "capitalize",
  },
  barRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 },
  barName: { fontSize: "0.78rem", fontWeight: 500, width: 80, flexShrink: 0 },
  barTrack: {
    flex: 1, height: 6, background: "var(--bg-input)",
    borderRadius: 3, overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" },
  barPct: { fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", width: 34, textAlign: "right", flexShrink: 0 },
  composeCta: {
    display: "flex", alignItems: "center", gap: 16,
    padding: 18,
    background: "var(--bg-card)", backdropFilter: "blur(16px)",
    border: "1px dashed var(--border)", borderRadius: "var(--radius-lg)",
    cursor: "pointer", width: "100%", fontFamily: "var(--font-body)",
    transition: "all var(--t) var(--ease)",
  },
  ctaIcon: {
    width: 42, height: 42, borderRadius: "var(--radius-md)",
    background: "rgba(79,142,247,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
};
