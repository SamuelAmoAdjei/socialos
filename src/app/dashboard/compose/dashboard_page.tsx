"use client";

import { useSession } from "next-auth/react";
import { useRouter }  from "next/navigation";

const STATS = [
  { label: "Posts Scheduled", value: "24",   chip: "+6 this week",   chipClass: "chip-nt",  icon: CalIco,   color: "var(--blue)",    bg: "var(--blue-dim)"    },
  { label: "Posts Published",  value: "148",  chip: "+12 this month", chipClass: "chip-up",  icon: CheckIco, color: "var(--success)",  bg: "var(--success-dim)" },
  { label: "Avg Engagement",   value: "4.8%", chip: "+0.3% vs last",  chipClass: "chip-up",  icon: TrendIco, color: "var(--accent)",   bg: "var(--accent-dim)"  },
  { label: "Active Clients",   value: "3",    chip: "All connected",  chipClass: "chip-nt",  icon: UserIco,  color: "var(--gold)",     bg: "var(--gold-dim)"    },
];

const POSTS = [
  { plats: ["li","ig"],     text: "Excited to share our Q1 results with the community. It has been an incredible journey...", client: "Acme Corp",   time: "Today, 09:00",  status: "published" },
  { plats: ["li","x","fb"], text: "Behind the scenes look at how we build our products this quarter...",                     client: "Nova Brands", time: "Tomorrow, 11:00", status: "scheduled" },
  { plats: ["ig"],          text: "Spring collection is here. Every piece tells a story of craftsmanship...",                 client: "Petal Studio",time: "Awaiting approval", status: "pending" },
  { plats: ["li"],          text: "Thoughts on the future of remote work and distributed teams worldwide...",                 client: "Acme Corp",   time: "Mar 25, 14:00", status: "draft" },
];

const PLATFORMS = [
  { name: "LinkedIn",  pct: 82, color: "linear-gradient(90deg,#0077B5,#00A0DC)" },
  { name: "Instagram", pct: 67, color: "linear-gradient(90deg,#F58529,#DD2A7B)" },
  { name: "Facebook",  pct: 54, color: "linear-gradient(90deg,#1877F2,#42A5F5)" },
  { name: "Buffer",    pct: 48, color: "linear-gradient(90deg,#00C2A8,#00A896)"  },
  { name: "X",         pct: 43, color: "linear-gradient(90deg,#555,#888)"       },
];

const PLAT_DOT: Record<string, { cls: string; label: string }> = {
  li: { cls: "pd-li", label: "LI" },
  x:  { cls: "pd-x",  label: "X"  },
  ig: { cls: "pd-ig", label: "IG" },
  fb: { cls: "pd-fb", label: "FB" },
  tt: { cls: "pd-tt", label: "TT" },
};

const PILL_CLS: Record<string, string> = {
  published: "pill-published",
  scheduled: "pill-scheduled",
  pending:   "pill-pending",
  draft:     "pill-draft",
  failed:    "pill-failed",
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div>
      {/* Greeting */}
      <div className="page-header">
        <h1 className="page-title">Good morning, {firstName}</h1>
        <p className="page-subtitle">Here is what is happening across your clients today.</p>
      </div>

      {/* Stat cards */}
      <div className="stats-row">
        {STATS.map((s, i) => (
          <div key={i} className={`card stat-card anim-${i}`}>
            <div className="stat-icon-wrap" style={{ background: s.bg, color: s.color }}>
              <s.icon />
            </div>
            <div className="stat-num">{s.value}</div>
            <div className="stat-lbl">{s.label}</div>
            <div className={`stat-chip ${s.chipClass}`}>{s.chip}</div>
          </div>
        ))}
      </div>

      {/* Two column */}
      <div className="grid-2" style={{ marginBottom: 16 }}>

        {/* Recent posts */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <div className="card-head">
              <span className="card-title">Recent Posts</span>
              <button className="card-action" onClick={() => router.push("/dashboard/schedule")}>View all</button>
            </div>
          </div>
          {POSTS.map((p, i) => (
            <div key={i} className="post-item" onClick={() => router.push("/dashboard/schedule")}>
              <div className="plat-dots">
                {p.plats.map(pl => (
                  <div key={pl} className={`plat-dot ${PLAT_DOT[pl].cls}`}>{PLAT_DOT[pl].label}</div>
                ))}
              </div>
              <div className="post-body">
                <div className="post-preview">{p.text}</div>
                <div className="post-meta">
                  <span>{p.client}</span>
                  <span>{p.time}</span>
                </div>
              </div>
              <div className={`pill ${PILL_CLS[p.status]}`}>{p.status}</div>
            </div>
          ))}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Platform performance */}
          <div className="card card-pad">
            <div className="card-head">
              <span className="card-title">Platform Performance</span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>This month</span>
            </div>
            {PLATFORMS.map((p, i) => (
              <div key={i} className="bar-row">
                <span className="bar-label">{p.name}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${p.pct}%`, background: p.color }} />
                </div>
                <span className="bar-pct">{p.pct}%</span>
              </div>
            ))}

            {/* Ops budget */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.78rem" }}>
                <span style={{ fontWeight: 500 }}>Buffer posts used</span>
                <span style={{ color: "var(--text-3)" }}>24 / 30 per channel</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: "80%", background: "linear-gradient(90deg,var(--accent),var(--blue))" }} />
              </div>
              <p style={{ fontSize: "0.70rem", color: "var(--text-3)", marginTop: 6 }}>
                6 posts remaining in free plan this month
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card card-pad">
            <div className="card-head" style={{ marginBottom: 12 }}>
              <span className="card-title">Quick Actions</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ width: "100%" }}
                onClick={() => router.push("/dashboard/compose")}
              >
                <PlusIco /> Compose New Post
              </button>
              <button
                className="btn btn-secondary"
                style={{ width: "100%" }}
                onClick={() => router.push("/dashboard/schedule")}
              >
                <CalIco /> View Schedule
              </button>
              <button
                className="btn btn-secondary"
                style={{ width: "100%" }}
                onClick={() => router.push("/dashboard/clients")}
              >
                <UserIco /> Manage Clients
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="card card-pad" style={{
        background: "var(--accent-dim)",
        border: "1px solid rgba(0,194,168,0.20)",
        display: "flex", alignItems: "center", gap: 16
      }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <BufferIco />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-head)", fontSize: "0.88rem", fontWeight: 600, marginBottom: 3 }}>
            Buffer is your publishing engine
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>
            Posts approved in SocialOS are scheduled through Buffer to LinkedIn, Instagram, and Facebook automatically.
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => router.push("/dashboard/settings")}>
          Configure
        </button>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ico = { width:20,height:20,viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const };
function CalIco()   { return <svg {...ico}><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M14 2v4M6 2v4M2 8h16"/></svg>; }
function CheckIco() { return <svg {...ico}><path d="M4 10l4 4 8-8"/></svg>; }
function TrendIco() { return <svg {...ico}><path d="M2 14l4-5 4 3 4-6 4 2"/><path d="M2 18h16"/></svg>; }
function UserIco()  { return <svg {...ico}><circle cx="8" cy="6" r="3"/><path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/><path d="M14 8a3 3 0 010 5M17 18c0-2.5-1-4-3-5"/></svg>; }
function PlusIco()  { return <svg {...ico}><path d="M10 4v12M4 10h12"/></svg>; }
function BufferIco(){ return <svg width="18" height="18" viewBox="0 0 20 20" fill="white"><path d="M10 2l8 4-8 4-8-4 8-4zM2 10l8 4 8-4M2 14l8 4 8-4"/></svg>; }
