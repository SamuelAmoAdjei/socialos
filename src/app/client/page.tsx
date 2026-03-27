"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Post } from "@/types";

type Tab = "pending"|"approved"|"published"|"analytics";

const TABS: { id:Tab; label:string }[] = [
  { id:"pending",   label:"Pending Approval" },
  { id:"approved",  label:"Approved"         },
  { id:"published", label:"Published"        },
  { id:"analytics", label:"Analytics"        },
];

const PLAT_LABELS: Record<string,string> = {
  linkedin:"LinkedIn", instagram:"Instagram",
  facebook:"Facebook", x:"X", tiktok:"TikTok",
};

export default function ClientPortal() {
  const { data:session, status } = useSession();
  const router = useRouter();

  const [tab,      setTab]      = useState<Tab>("pending");
  const [posts,    setPosts]    = useState<(Post & {rowIndex:number})[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState<string|null>(null);
  const [toast,    setToast]    = useState<{msg:string;type:"success"|"error"}|null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/posts").then(r => r.json())
      .then(res => { if (res.ok) setPosts(res.data); })
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg:string, type:"success"|"error") {
    setToast({msg,type});
    setTimeout(() => setToast(null), 3000);
  }

  async function approve(postId:string, rowIndex:number) {
    setActing(postId);
    try {
      const res = await fetch("/api/posts/approve",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ postId, rowIndex, status:"approved" }),
      }).then(r => r.json());
      if (res.ok) {
        setPosts(p => p.map(x => x.id===postId ? {...x, status:"approved"} : x));
        showToast("Post approved — it will publish at the scheduled time","success");
      } else {
        showToast(res.error || "Failed to approve","error");
      }
    } finally { setActing(null); }
  }

  async function requestChanges(postId:string, rowIndex:number) {
    const note = window.prompt("What changes would you like? (optional)");
    setActing(postId);
    try {
      const res = await fetch("/api/posts/approve",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ postId, rowIndex, status:"draft", note }),
      }).then(r => r.json());
      if (res.ok) {
        setPosts(p => p.map(x => x.id===postId ? {...x, status:"draft"} : x));
        showToast("Sent back for edits — your VA will revise and resubmit","success");
      } else {
        showToast(res.error || "Failed","error");
      }
    } finally { setActing(null); }
  }

  const filtered = {
    pending:   posts.filter(p => p.status === "pending" || p.status === "publishing"),
    approved:  posts.filter(p => p.status === "approved"),
    published: posts.filter(p => p.status === "published" || p.status === "partial"),
    analytics: [],
  }[tab];

  if (status === "loading") {
    return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div className="spinner spinner-lg"/>
    </div>;
  }

  const userName = session?.user?.name ?? "Client";

  return (
    <div style={{minHeight:"100vh",background:"var(--bg-app)"}}>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",
          zIndex:600,background:"var(--bg-card)",
          border:`1px solid ${toast.type==="success"?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`,
          borderRadius:"var(--radius-md)",padding:"12px 20px",
          boxShadow:"var(--shadow-md)",fontSize:"0.85rem",fontWeight:500,
          color:toast.type==="success"?"var(--success)":"var(--danger)",
          animation:"toastIn 0.3s var(--ease)",
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <header style={{
        background:"var(--bg-surface)",borderBottom:"1px solid var(--border)",
        padding:"0 24px",height:"var(--topbar-h)",
        display:"flex",alignItems:"center",gap:16,
        position:"sticky",top:0,zIndex:100,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
          <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,var(--accent),#00A896)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 3px 10px var(--accent-glow)"}}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <path d="M10 2L18 6v8l-8 4-8-4V6z"/><path d="M10 2v12M2 6l8 4 8-4"/>
            </svg>
          </div>
          <div>
            <div style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:"0.95rem",color:"var(--text-1)"}}>
              Social<em style={{color:"var(--accent)",fontStyle:"normal"}}>OS</em> — Client Portal
            </div>
            <div style={{fontSize:"0.70rem",color:"var(--text-3)"}}>Welcome, {userName}</div>
          </div>
        </div>
        <button className="signout-btn"
          onClick={() => signOut({callbackUrl:"/auth/signin"})}>
          Sign out
        </button>
      </header>

      {/* Body */}
      <div style={{maxWidth:820,margin:"0 auto",padding:24}}>

        {/* Welcome banner */}
        <div className="callout-accent" style={{marginBottom:24,display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:"1.5rem"}}>
            <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z"/>
              <path d="M8 16a2 2 0 004 0"/>
            </svg>
          </div>
          <div>
            <div style={{fontFamily:"var(--font-head)",fontWeight:600,fontSize:"0.95rem",color:"var(--text-1)",marginBottom:2}}>
              {posts.filter(p => p.status==="pending").length} post{posts.filter(p=>p.status==="pending").length!==1?"s":""} awaiting your approval
            </div>
            <div style={{fontSize:"0.78rem",color:"var(--text-2)"}}>
              Review, approve or request changes below. Approved posts publish automatically at the scheduled time.
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:0,marginBottom:20,background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:4,overflow:"hidden"}}>
          {TABS.map(t => (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex:1, padding:"9px 12px",
                borderRadius:"var(--radius-sm)",
                fontSize:"0.82rem", fontWeight:500,
                border:"none", cursor:"pointer",
                fontFamily:"var(--font-body)",
                background: tab===t.id ? "var(--bg-surface)" : "none",
                color:       tab===t.id ? "var(--text-1)"    : "var(--text-3)",
                boxShadow:   tab===t.id ? "var(--shadow-xs)" : "none",
                transition:"all var(--t-fast) var(--ease)",
              }}>
              {t.label}
              {t.id==="pending" && posts.filter(p=>p.status==="pending").length > 0 && (
                <span style={{marginLeft:6,background:"var(--accent)",color:"#0B0F1A",fontSize:"0.62rem",fontWeight:700,padding:"1px 6px",borderRadius:20}}>
                  {posts.filter(p=>p.status==="pending").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Posts */}
        {loading ? (
          <div style={{display:"flex",justifyContent:"center",padding:48}}>
            <div className="spinner spinner-lg"/>
          </div>
        ) : tab === "analytics" ? (
          <div className="card card-pad" style={{textAlign:"center",padding:48}}>
            <div style={{fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:600,marginBottom:8,color:"var(--text-1)"}}>Analytics coming soon</div>
            <p style={{fontSize:"0.82rem",color:"var(--text-3)"}}>Your VA will share performance reports here. Analytics sync daily after posts are published.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card card-pad" style={{textAlign:"center",padding:48}}>
            <div style={{fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:600,marginBottom:8,color:"var(--text-1)"}}>
              {tab==="pending" ? "Nothing needs your approval right now" : `No ${tab} posts`}
            </div>
            <p style={{fontSize:"0.82rem",color:"var(--text-3)"}}>
              {tab==="pending" ? "Your VA will notify you when new posts are ready for review." : "Posts will appear here once they exist."}
            </p>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {filtered.map(post => (
              <div key={post.id} className="card card-pad">
                {/* Platform tags */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                  {post.platforms.map(p => (
                    <span key={p} style={{
                      fontSize:"0.72rem",fontWeight:600,padding:"3px 10px",borderRadius:20,
                      background:`${p==="linkedin"?"rgba(0,119,181,0.12)":p==="instagram"?"rgba(225,48,108,0.12)":p==="facebook"?"rgba(24,119,242,0.12)":"rgba(255,255,255,0.08)"}`,
                      color:     p==="linkedin"?"#0077B5":p==="instagram"?"#E1306C":p==="facebook"?"#1877F2":"var(--text-2)",
                    }}>{PLAT_LABELS[p] ?? p}</span>
                  ))}
                  <span style={{marginLeft:"auto",fontSize:"0.72rem",color:"var(--text-3)"}}>
                    {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "No schedule set"}
                  </span>
                </div>

                {/* Post content */}
                <p style={{fontSize:"0.9rem",lineHeight:1.75,color:"var(--text-1)",marginBottom:16,background:"var(--bg-input)",padding:"14px 16px",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)"}}>
                  {post.content}
                </p>

                {/* Media */}
                {post.mediaUrl && (
                  <div className="callout-info" style={{marginBottom:12}}>
                    Media attached: <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" style={{color:"var(--blue)",textDecoration:"underline"}}>{post.mediaUrl}</a>
                  </div>
                )}

                {/* Status line */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <span className={`pill pill-${post.status}`}>{post.status}</span>

                  {(post.status === "pending") && (
                    <div style={{display:"flex",gap:8}}>
                      <button className="btn btn-secondary btn-sm"
                        disabled={acting === post.id}
                        onClick={() => requestChanges(post.id, (post as any).rowIndex)}>
                        Request Changes
                      </button>
                      <button className="btn btn-primary btn-sm"
                        disabled={acting === post.id}
                        onClick={() => approve(post.id, (post as any).rowIndex)}>
                        {acting === post.id ? <span className="spinner"/> : <CheckIco/>}
                        Approve
                      </button>
                    </div>
                  )}

                  {post.status === "published" && post.publishedAt && (
                    <span style={{fontSize:"0.72rem",color:"var(--success)"}}>
                      Published {new Date(post.publishedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIco() {
  return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M4 10l4 4 8-8"/>
  </svg>;
}

