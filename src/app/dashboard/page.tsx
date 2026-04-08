"use client";

import { useSession } from "next-auth/react";
import { useRouter }  from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import type { Post, Client } from "@/types";

const PLAT: Record<string,{cls:string;label:string}> = {
  linkedin: { cls:"pd-li", label:"LI" },
  x:        { cls:"pd-x",  label:"X"  },
  instagram:{ cls:"pd-ig", label:"IG" },
  facebook: { cls:"pd-fb", label:"FB" },
  tiktok:   { cls:"pd-tt", label:"TT" },
};

const PILL: Record<string,string> = {
  published:"pill-published", scheduled:"pill-scheduled",
  approved:"pill-approved",   pending:"pill-pending",
  draft:"pill-draft",         failed:"pill-failed",
  publishing:"pill-publishing",
};

const PLAT_COLORS: Record<string,string> = {
  linkedin:"#0077B5", instagram:"#E1306C", facebook:"#1877F2", x:"#888", tiktok:"#69C9D0",
};

export default function DashboardPage() {
  const { data:session } = useSession();
  const router = useRouter();

  const [posts,   setPosts]   = useState<(Post & {rowIndex:number})[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const [activeClientTimezone, setActiveClientTimezone] = useState<string>("UTC");

  const load = useCallback(async () => {
    const [pRes, cRes] = await Promise.allSettled([
      fetch("/api/posts").then(r=>r.json()),
      fetch("/api/clients").then(r=>r.json()),
    ]);
    if (pRes.status === "fulfilled" && pRes.value.ok) setPosts(pRes.value.data);
    if (cRes.status === "fulfilled" && cRes.value.ok) {
      const list = cRes.value.data as Client[];
      setClients(list);
      if (typeof window !== "undefined") {
        const activeId = localStorage.getItem("sos-active-client-id") || "";
        const activeName = localStorage.getItem("sos-active-client-name") || "";
        const match =
          list.find((c) => c.id === activeId) ||
          list.find((c) => c.name === activeName);
        setActiveClientTimezone(match?.timezone || "UTC");
      }
    }
    setLoading(false);
  }, []);

  const vaGreeting = useMemo(() => {
    try {
      const nowText = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        hour12: false,
        timeZone: activeClientTimezone || "UTC",
      }).format(new Date());
      const hour = Number(nowText);
      if (hour >= 5 && hour < 12) return "Good morning";
      if (hour >= 12 && hour < 17) return "Good afternoon";
      if (hour >= 17 && hour < 21) return "Good evening";
      return "Good night";
    } catch {
      return "Hello";
    }
  }, [activeClientTimezone]);

  useEffect(() => {
    const first = setTimeout(() => load(), 0);
    // Auto-refresh every 30 seconds
    const id = setInterval(load, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  // Computed stats from real data
  const scheduled  = posts.filter(p => p.status === "scheduled" || p.status === "approved").length;
  const published  = posts.filter(p => p.status === "published").length;
  const pending    = posts.filter(p => p.status === "pending").length;
  const recent     = [...posts].reverse().slice(0, 5);

  // Platform breakdown
  const platCount: Record<string,number> = {};
  posts.forEach(p => p.platforms.forEach(pl => { platCount[pl] = (platCount[pl]||0)+1; }));
  const totalPlatPosts = Object.values(platCount).reduce((a,b)=>a+b,0) || 1;

  const STATS = [
    { label:"Posts Scheduled",  value:String(scheduled),       chip:`${pending} pending approval`, chipClass:"chip-nt", Icon:CalIco,   color:"var(--blue)",   bg:"var(--blue-dim)"    },
    { label:"Posts Published",   value:String(published),       chip:"Total published",             chipClass:"chip-up", Icon:CheckIco, color:"var(--success)", bg:"var(--success-dim)" },
    { label:"Total Posts",       value:String(posts.length),    chip:"All statuses",                chipClass:"chip-nt", Icon:TrendIco, color:"var(--accent)",  bg:"var(--accent-dim)"  },
    { label:"Active Clients",    value:String(clients.length),  chip:clients.length===0?"Add clients in Clients tab":"Registered",chipClass:"chip-nt", Icon:UserIco, color:"var(--gold)", bg:"var(--gold-dim)" },
  ];

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:400}}>
      <div className="spinner spinner-lg"/>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{vaGreeting}, {firstName}</h1>
        <p className="page-subtitle">
          {posts.length === 0
            ? "No posts yet — head to Compose to create your first post."
            : `${posts.length} total posts · ${scheduled} scheduled · ${published} published · timezone: ${activeClientTimezone}`}
        </p>
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

      <div className="grid-2" style={{marginBottom:16}}>

        {/* Recent posts — real data */}
        <div className="card" style={{overflow:"hidden"}}>
          <div style={{padding:"var(--radius-md) var(--radius-md) 0"}}>
            <div className="card-head">
              <span className="card-title">Recent Posts</span>
              <button className="card-action" onClick={()=>router.push("/dashboard/schedule")}>
                View all
              </button>
            </div>
          </div>

          {recent.length === 0 ? (
            <div className="empty-state" style={{padding:32}}>
              <div className="empty-icon"><EditIco/></div>
              <div className="empty-title">No posts yet</div>
              <p className="empty-desc">Create your first post to see it here.</p>
              <button className="btn btn-primary btn-sm"
                onClick={()=>router.push("/dashboard/compose")}>
                <PlusIco/> Compose
              </button>
            </div>
          ) : (
            recent.map((p,i) => (
              <div key={i} className="post-item"
                onClick={()=>router.push("/dashboard/schedule")}>
                <div className="plat-dots">
                  {p.platforms.slice(0,3).map(pl => (
                    <div key={pl} className={`plat-dot ${PLAT[pl]?.cls ?? "pd-li"}`}>
                      {PLAT[pl]?.label ?? pl.substring(0,2).toUpperCase()}
                    </div>
                  ))}
                </div>
                <div className="post-body">
                  <div className="post-preview">
                    {p.content || "(no content)"}
                  </div>
                  <div className="post-meta">
                    <span>{p.clientId}</span>
                    {p.scheduledAt && <span>{new Date(p.scheduledAt).toLocaleString()}</span>}
                  </div>
                </div>
                <span className={`pill ${PILL[p.status] ?? "pill-draft"}`}>{p.status}</span>
              </div>
            ))
          )}
        </div>

        {/* Right column */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>

          {/* Platform breakdown — real data */}
          <div className="card card-pad">
            <div className="card-head">
              <span className="card-title">Platform Breakdown</span>
              <span style={{fontSize:"0.72rem",color:"var(--text-3)"}}>All posts</span>
            </div>

            {Object.keys(platCount).length === 0 ? (
              <p style={{fontSize:"0.82rem",color:"var(--text-3)",textAlign:"center",padding:16}}>
                No platform data yet
              </p>
            ) : (
              Object.entries(platCount)
                .sort((a,b)=>b[1]-a[1])
                .map(([pl,count]) => (
                  <div key={pl} className="bar-row">
                    <span className="bar-label" style={{color:PLAT_COLORS[pl]??"var(--text-2)"}}>
                      {pl.charAt(0).toUpperCase()+pl.slice(1)}
                    </span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{
                        width:`${(count/totalPlatPosts)*100}%`,
                        background:PLAT_COLORS[pl]??"var(--accent)",
                      }}/>
                    </div>
                    <span className="bar-pct">{count}</span>
                  </div>
                ))
            )}

            <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid var(--border)"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:"0.78rem"}}>
                <span style={{fontWeight:500,color:"var(--text-2)"}}>Total posts</span>
                <span style={{color:"var(--text-3)"}}>{posts.length} posts</span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card card-pad">
            <div className="card-head" style={{marginBottom:12}}>
              <span className="card-title">Quick Actions</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button className="btn btn-primary btn-full"
                onClick={()=>router.push("/dashboard/compose")}>
                <PlusIco/> Compose New Post
              </button>
              <button className="btn btn-secondary btn-full"
                onClick={()=>router.push("/dashboard/schedule")}>
                <CalIco/> View Schedule
              </button>
              <button className="btn btn-secondary btn-full"
                onClick={()=>router.push("/dashboard/clients")}>
                <UserIco/> Manage Clients
              </button>
            </div>
          </div>

          {/* Status pending alert if any */}
          {pending > 0 && (
            <div className="card card-pad" style={{
              background:"var(--gold-dim)",border:"1px solid rgba(245,158,11,0.25)",
              display:"flex",alignItems:"center",gap:14,
            }}>
              <div style={{width:36,height:36,borderRadius:"var(--radius-sm)",background:"var(--gold-dim)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z"/>
                  <path d="M8 16a2 2 0 004 0"/>
                </svg>
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"var(--font-head)",fontSize:"0.85rem",fontWeight:600,marginBottom:2,color:"var(--text-1)"}}>
                  {pending} post{pending!==1?"s":""} awaiting approval
                </div>
                <div style={{fontSize:"0.75rem",color:"var(--text-2)"}}>
                  Your client can approve at /client
                </div>
              </div>
              <button className="btn btn-secondary btn-sm"
                onClick={()=>router.push("/dashboard/schedule")}>
                View
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ico={width:20,height:20,viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const};
function CalIco()   { return <svg {...ico}><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M14 2v4M6 2v4M2 8h16"/></svg>; }
function CheckIco() { return <svg {...ico}><path d="M4 10l4 4 8-8"/></svg>; }
function TrendIco() { return <svg {...ico}><path d="M2 14l4-5 4 3 4-6 4 2"/><path d="M2 18h16"/></svg>; }
function UserIco()  { return <svg {...ico}><circle cx="8" cy="6" r="3"/><path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/><path d="M14 8a3 3 0 010 5M17 18c0-2.5-1-4-3-5"/></svg>; }
function PlusIco()  { return <svg {...ico}><path d="M10 4v12M4 10h12"/></svg>; }
function EditIco()  { return <svg {...ico}><path d="M14 2l4 4-10 10H4v-4L14 2z"/></svg>; }