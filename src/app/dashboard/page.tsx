"use client";

import { useSession } from "next-auth/react";
import { useRouter }  from "next/navigation";

const STATS = [
  { label:"Posts Scheduled", value:"24",   chip:"+6 this week",   chipClass:"chip-nt", Icon:CalIco,   color:"var(--blue)",    bg:"var(--blue-dim)"    },
  { label:"Posts Published",  value:"148",  chip:"+12 this month", chipClass:"chip-up", Icon:CheckIco, color:"var(--success)",  bg:"var(--success-dim)" },
  { label:"Avg Engagement",   value:"4.8%", chip:"+0.3% vs last",  chipClass:"chip-up", Icon:TrendIco, color:"var(--accent)",   bg:"var(--accent-dim)"  },
  { label:"Active Clients",   value:"3",    chip:"All connected",  chipClass:"chip-nt", Icon:UserIco,  color:"var(--gold)",     bg:"var(--gold-dim)"    },
];

const POSTS = [
  { plats:["li","ig"],     text:"Excited to share our Q1 results with the community — incredible journey so far…", client:"Acme Corp",    time:"Today, 09:00",    status:"published" },
  { plats:["li","fb"],     text:"Behind the scenes look at how we build our products this quarter…",               client:"Nova Brands",  time:"Tomorrow, 11:00", status:"scheduled" },
  { plats:["ig"],          text:"Spring collection is here. Every piece tells a story of craftsmanship…",          client:"Petal Studio", time:"Awaiting approval", status:"pending" },
  { plats:["li"],          text:"Thoughts on the future of remote work and distributed teams worldwide…",          client:"Acme Corp",    time:"Mar 25, 14:00",   status:"draft"     },
];

const PLATFORMS = [
  { name:"LinkedIn",  pct:82, color:"linear-gradient(90deg,#0077B5,#00A0DC)" },
  { name:"Instagram", pct:67, color:"linear-gradient(90deg,#F58529,#DD2A7B)" },
  { name:"Facebook",  pct:54, color:"linear-gradient(90deg,#1877F2,#42A5F5)" },
  { name:"Buffer",    pct:48, color:"linear-gradient(90deg,var(--accent),#00A896)" },
];

const PLAT: Record<string,{cls:string;label:string}> = {
  li:{ cls:"pd-li", label:"LI" },
  x: { cls:"pd-x",  label:"X"  },
  ig:{ cls:"pd-ig", label:"IG" },
  fb:{ cls:"pd-fb", label:"FB" },
  tt:{ cls:"pd-tt", label:"TT" },
};

const PILL: Record<string,string> = {
  published:"pill-published", scheduled:"pill-scheduled",
  pending:"pill-pending",     draft:"pill-draft", failed:"pill-failed",
};

export default function DashboardPage() {
  const { data:session } = useSession();
  const router = useRouter();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Good morning, {firstName}</h1>
        <p className="page-subtitle">Here is what is happening across your clients today.</p>
      </div>

      {/* Stat cards */}
      <div className="stats-row">
        {STATS.map((s,i) => (
          <div key={i} className="card stat-card anim-fade-up">
            <div className="stat-icon-wrap" style={{background:s.bg,color:s.color}}>
              <s.Icon/>
            </div>
            <div className="stat-num">{s.value}</div>
            <div className="stat-lbl">{s.label}</div>
            <span className={`stat-chip ${s.chipClass}`}>{s.chip}</span>
          </div>
        ))}
      </div>

      {/* 2 column */}
      <div className="grid-2" style={{marginBottom:"var(--radius-md)"}}>

        {/* Recent posts */}
        <div className="card" style={{overflow:"hidden"}}>
          <div style={{padding:"var(--radius-md) var(--radius-md) 0"}}>
            <div className="card-head">
              <span className="card-title">Recent Posts</span>
              <button className="card-action"
                onClick={() => router.push("/dashboard/schedule")}>View all</button>
            </div>
          </div>
          {POSTS.map((p,i) => (
            <div key={i} className="post-item"
              onClick={() => router.push("/dashboard/schedule")}>
              <div className="plat-dots">
                {p.plats.map(pl => (
                  <div key={pl} className={`plat-dot ${PLAT[pl].cls}`}>
                    {PLAT[pl].label}
                  </div>
                ))}
              </div>
              <div className="post-body">
                <div className="post-preview">{p.text}</div>
                <div className="post-meta">
                  <span>{p.client}</span><span>{p.time}</span>
                </div>
              </div>
              <span className={`pill ${PILL[p.status]}`}>{p.status}</span>
            </div>
          ))}
        </div>

        {/* Right column */}
        <div style={{display:"flex",flexDirection:"column",gap:"var(--radius-sm)"}}>

          {/* Platform bars */}
          <div className="card card-pad">
            <div className="card-head">
              <span className="card-title">Platform Performance</span>
              <span style={{fontSize:"0.72rem",color:"var(--text-3)"}}>This month</span>
            </div>
            {PLATFORMS.map((p,i) => (
              <div key={i} className="bar-row">
                <span className="bar-label">{p.name}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{width:`${p.pct}%`,background:p.color}}/>
                </div>
                <span className="bar-pct">{p.pct}%</span>
              </div>
            ))}
            <div style={{marginTop:"var(--radius-md)",paddingTop:"var(--radius-md)",borderTop:"1px solid var(--border)"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:"0.78rem"}}>
                <span style={{fontWeight:500,color:"var(--text-2)"}}>Buffer posts used</span>
                <span style={{color:"var(--text-3)"}}>24 / 30 per channel</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{width:"80%",background:"linear-gradient(90deg,var(--accent),var(--blue))"}}/>
              </div>
              <p style={{fontSize:"0.70rem",color:"var(--text-3)",marginTop:6}}>
                6 posts remaining in free plan this month
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card card-pad">
            <div className="card-head" style={{marginBottom:12}}>
              <span className="card-title">Quick Actions</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              <button className="btn btn-primary btn-full"
                onClick={() => router.push("/dashboard/compose")}>
                <PlusIco/> Compose New Post
              </button>
              <button className="btn btn-secondary btn-full"
                onClick={() => router.push("/dashboard/schedule")}>
                <CalIco/> View Schedule
              </button>
              <button className="btn btn-secondary btn-full"
                onClick={() => router.push("/dashboard/clients")}>
                <UserIco/> Manage Clients
              </button>
            </div>
          </div>

          {/* Buffer banner */}
          <div className="card card-pad callout-accent"
            style={{display:"flex",alignItems:"center",gap:"var(--radius-md)"}}>
            <div style={{
              width:40,height:40,borderRadius:"var(--radius-sm)",
              background:"var(--accent)",display:"flex",alignItems:"center",
              justifyContent:"center",flexShrink:0
            }}>
              <BufferIco/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"var(--font-head)",fontSize:"0.88rem",fontWeight:600,marginBottom:3,color:"var(--text-1)"}}>
                Buffer is your publishing engine
              </div>
              <div style={{fontSize:"0.78rem",color:"var(--text-2)"}}>
                Posts approved in SocialOS publish to LinkedIn, Instagram and Facebook via Buffer.
              </div>
            </div>
            <button className="btn btn-secondary btn-sm"
              onClick={() => router.push("/dashboard/settings")}>Configure</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* tiny helper — avoid literal 8px strings inline */
function var_px(n: number) { return `${n}px`; }

/* Icons */
const ico = {width:20,height:20,viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const};
function CalIco()    { return <svg {...ico}><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M14 2v4M6 2v4M2 8h16"/></svg>; }
function CheckIco()  { return <svg {...ico}><path d="M4 10l4 4 8-8"/></svg>; }
function TrendIco()  { return <svg {...ico}><path d="M2 14l4-5 4 3 4-6 4 2"/><path d="M2 18h16"/></svg>; }
function UserIco()   { return <svg {...ico}><circle cx="8" cy="6" r="3"/><path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/><path d="M14 8a3 3 0 010 5M17 18c0-2.5-1-4-3-5"/></svg>; }
function PlusIco()   { return <svg {...ico}><path d="M10 4v12M4 10h12"/></svg>; }
function BufferIco() { return <svg width="18" height="18" viewBox="0 0 20 20" fill="white"><path d="M10 2l8 4-8 4-8-4 8-4zM2 10l8 4 8-4M2 14l8 4 8-4"/></svg>; }
