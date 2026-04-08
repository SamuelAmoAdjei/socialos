"use client";

/**
 * CLIENT PORTAL — /client
 * Completely standalone. Does NOT depend on the VA dashboard theme.
 * Has its own theme stored under "sos-client-theme" in localStorage.
 * All styles are defined locally — no reliance on globals.css variables
 * that could be overridden by the VA dashboard.
 */

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import type { Post, Platform } from "@/types";

// ── Design tokens — hardcoded for client portal independence ──────────────────
const T = {
  dark: {
    bg:      "#0B0F1A",
    surface: "#141B2D",
    card:    "#1A2235",
    input:   "#0F1623",
    border:  "rgba(255,255,255,0.08)",
    text1:   "#F1F5F9",
    text2:   "#94A3B8",
    text3:   "#475569",
  },
  light: {
    bg:      "#F1F5F9",
    surface: "#FFFFFF",
    card:    "#FFFFFF",
    input:   "#F1F5F9",
    border:  "rgba(0,0,0,0.08)",
    text1:   "#0F172A",
    text2:   "#475569",
    text3:   "#94A3B8",
  },
};
const ACCENT   = "#00C2A8";
const SUCCESS  = "#22C55E";
const GOLD     = "#F59E0B";
const DANGER   = "#EF4444";
const BLUE     = "#4F8EF7";

const PLAT_META: Record<string,{label:string;color:string;bg:string}> = {
  linkedin: {label:"LinkedIn", color:"#0077B5",bg:"rgba(0,119,181,0.12)"},
  instagram:{label:"Instagram",color:"#E1306C",bg:"rgba(225,48,108,0.12)"},
  facebook: {label:"Facebook", color:"#1877F2",bg:"rgba(24,119,242,0.12)"},
  x:        {label:"X",        color:"#888888",bg:"rgba(255,255,255,0.08)"},
  tiktok:   {label:"TikTok",   color:"#69C9D0",bg:"rgba(105,201,208,0.12)"},
};

const ALL_PLATFORMS: Platform[] = ["linkedin","instagram","facebook","x","tiktok"];

type Tab = "pending"|"approved"|"published"|"topics";

export default function ClientPortal() {
  const { data:session, status } = useSession();

  // Independent theme — does NOT share with VA dashboard
  const [theme, setTheme] = useState<"dark"|"light">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("sos-client-theme") as "dark"|"light"|null;
    setTheme(saved ?? "dark");
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("sos-client-theme", next);
  }

  const C = T[theme];

  // Time-based greeting
  function getGreeting(): string {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Good afternoon";
    if (h >= 17 && h < 21) return "Good evening";
    return "Good night";
  }

  // Client's registered name (from Clients sheet, not Google account name)
  const [clientName, setClientName] = useState<string>("");
  useEffect(() => {
    if (session?.user?.email) {
      fetch("/api/clients").then(r=>r.json()).then(res => {
        if (res.ok && Array.isArray(res.data)) {
          const match = res.data.find((c:any) =>
            (c.email ?? "").toLowerCase().trim() === (session.user!.email ?? "").toLowerCase().trim()
          );
          if (match?.name) setClientName(match.name);
        }
      }).catch(()=>{});
    }
  }, [session?.user?.email]);

  // Display name: registered client name > Google first name > "Client"
  const displayName = clientName
    ? clientName.split(" ")[0]
    : (session?.user?.name?.split(" ")[0] ?? "Client");

  const [role,        setRole]        = useState<"loading"|"client"|"va"|"none">("loading");
  const [tab,         setTab]         = useState<Tab>("pending");
  const [posts,       setPosts]       = useState<(Post & {rowIndex:number})[]>([]);
  const [postsLoading,setPostsLoading]= useState(true);
  const [toast,       setToast]       = useState<{msg:string;type:"success"|"error"|"info"}|null>(null);
  const [acting,      setActing]      = useState<string|null>(null);
  const [refreshing,  setRefreshing]  = useState(false);

  // Edit modal
  const [editPost,    setEditPost]    = useState<(Post & {rowIndex:number})|null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving,  setEditSaving]  = useState(false);

  // Topic form
  const [topicText,   setTopicText]   = useState("");
  const [topicPlats,  setTopicPlats]  = useState<Set<Platform>>(new Set<Platform>(["linkedin","instagram"]));
  const [topicMedia,  setTopicMedia]  = useState("");
  const [topicSaving, setTopicSaving] = useState(false);
  const [topicMsg,    setTopicMsg]    = useState<{text:string;ok:boolean}|null>(null);
  const [topicUploading, setTopicUploading] = useState(false);

  function showToast(msg:string, type:"success"|"error"|"info"="info") {
    setToast({msg,type});
    setTimeout(()=>setToast(null),4000);
  }

  // Role check
  useEffect(() => {
    if (status==="unauthenticated") { setRole("none"); return; }
    if (status==="authenticated") {
      fetch("/api/role").then(r=>r.json()).then(res=>{
        setRole(res.role ?? "none");
      }).catch(()=>setRole("none"));
    }
  }, [status]);

  // Load posts
  const loadPosts = useCallback((withIndicator = false) => {
    if (role !== "client") return;
    if (withIndicator) setRefreshing(true);
    fetch("/api/posts").then(r=>r.json())
      .then(res=>{ if(res.ok) setPosts(res.data); })
      .finally(()=>{
        setPostsLoading(false);
        if (withIndicator) {
          setRefreshing(false);
          showToast("Refreshed","info");
        }
      });
  }, [role]);

  useEffect(() => {
    loadPosts();
    const id = setInterval(loadPosts, 30_000);
    return () => clearInterval(id);
  }, [loadPosts]);

  // Approve
  async function approve(post: Post & {rowIndex:number}) {
    setActing(post.id);
    try {
      const res = await fetch("/api/posts/approve",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({postId:post.id, rowIndex:post.rowIndex, status:"approved"}),
      }).then(r=>r.json());
      if (res.ok) {
        setPosts(p=>p.map(x=>x.id===post.id?{...x,status:"approved"}:x));
        showToast("✓ Post approved — will publish at the scheduled time","success");
      } else { showToast(res.error||"Failed","error"); }
    } finally { setActing(null); }
  }

  // Request changes
  async function requestChanges(post: Post & {rowIndex:number}) {
    const note = window.prompt("What changes would you like? (optional note to your VA)");
    if (note === null) return; // user cancelled
    setActing(post.id);
    try {
      const res = await fetch("/api/posts/approve",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({postId:post.id, rowIndex:post.rowIndex, status:"draft", note}),
      }).then(r=>r.json());
      if (res.ok) {
        setPosts(p=>p.map(x=>x.id===post.id?{...x,status:"draft"}:x));
        showToast("Feedback sent — your VA will revise and resubmit","info");
      } else { showToast(res.error||"Failed","error"); }
    } finally { setActing(null); }
  }

  // Save edit
  async function saveEdit() {
    if (!editPost) return;
    if (!editContent.trim()) { showToast("Content cannot be empty","error"); return; }
    setEditSaving(true);
    try {
      const res = await fetch("/api/posts/approve",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          postId:   editPost.id,
          rowIndex: editPost.rowIndex,
          status:   "pending",
          content:  editContent,           // ← actually saves to column C in Sheet
          note:     `Client edited: "${editContent.substring(0,80)}…"`,
        }),
      }).then(r=>r.json());
      if (res.ok) {
        setPosts(p=>p.map(x=>x.id===editPost!.id?{...x,content:editContent}:x));
        setEditPost(null);
        showToast("✓ Post updated — still pending your final approval","success");
      } else { showToast(res.error||"Failed to save","error"); }
    } finally { setEditSaving(false); }
  }

  // Submit topic
  async function submitTopic() {
    if (!topicText.trim()) { setTopicMsg({text:"Please describe the topic",ok:false}); return; }
    if (topicPlats.size===0){ setTopicMsg({text:"Select at least one platform",ok:false}); return; }
    setTopicSaving(true); setTopicMsg(null);
    try {
      const res = await fetch("/api/topics",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          content:     topicText,
          platforms:   Array.from(topicPlats),
          mediaUrl:    topicMedia.trim()||undefined,
          clientId:    session?.user?.email ?? "client",
        }),
      }).then(r=>r.json());
      if (res.ok) {
        setTopicText(""); setTopicMedia("");
        setTopicMsg({text:"✓ Topic submitted to your VA — saved successfully",ok:true});
        showToast("Topic sent to your VA","success");
      } else { setTopicMsg({text:res.error||"Submit failed",ok:false}); }
    } finally { setTopicSaving(false); }
  }

  async function uploadTopicMedia(file: File) {
    setTopicUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.ok && data.data?.url) {
        setTopicMedia(data.data.url);
        showToast("Media uploaded", "success");
      } else {
        showToast(data.error || "Upload failed", "error");
      }
    } catch (e: any) {
      showToast(e.message || "Upload failed", "error");
    } finally {
      setTopicUploading(false);
    }
  }

  // Filtered posts per tab
  const byTab = {
    pending:   posts.filter(p=>p.status==="pending"),
    approved:  posts.filter(p=>p.status==="approved"),
    published: posts.filter(p=>p.status==="published"||p.status==="partial"),
    topics:    [] as typeof posts,
  };
  const pendingCount = byTab.pending.length;

  // ── Styles ───────────────────────────────────────────────────────────────
  const page: React.CSSProperties = {
    minHeight:"100vh", background:C.bg, color:C.text1,
    fontFamily:"'DM Sans',system-ui,sans-serif",
    transition:"background 0.2s, color 0.2s",
  };
  const card: React.CSSProperties = {
    background:C.card, border:`1px solid ${C.border}`,
    borderRadius:16, padding:20,
    transition:"background 0.2s",
  };
  const inp: React.CSSProperties = {
    width:"100%", padding:"10px 14px",
    background:C.input, border:`1px solid ${C.border}`,
    borderRadius:8, color:C.text1,
    fontFamily:"inherit", fontSize:"0.875rem",
    outline:"none", transition:"border-color 0.15s",
  };
  const lbl: React.CSSProperties = {
    fontSize:"0.78rem", fontWeight:600, color:C.text2,
    marginBottom:6, display:"block",
  };

  // ── Not signed in ─────────────────────────────────────────────────────────
  if (status==="loading"||role==="loading") {
    return (
      <div style={{...page,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${C.border}`,borderTopColor:ACCENT,animation:"spin 0.7s linear infinite"}}/>
      </div>
    );
  }

  if (status==="unauthenticated"||role==="none") {
    return (
      <div style={{...page,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{width:56,height:56,borderRadius:16,background:`linear-gradient(135deg,${ACCENT},#00A896)`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 6px 24px rgba(0,194,168,0.35)`,marginBottom:20}}>
          <svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <path d="M10 2L18 6v8l-8 4-8-4V6z"/><path d="M10 2v12M2 6l8 4 8-4"/>
          </svg>
        </div>
        <h1 style={{fontFamily:"'Sora',system-ui,sans-serif",fontWeight:700,fontSize:"1.6rem",color:C.text1,marginBottom:8,letterSpacing:"-0.02em",textAlign:"center"}}>
          Social<em style={{color:ACCENT,fontStyle:"normal"}}>OS</em> — Client Portal
        </h1>
        <p style={{fontSize:"0.9rem",color:C.text2,marginBottom:32,textAlign:"center",maxWidth:380,lineHeight:1.7}}>
          Sign in with the Google account your VA registered to access your social media dashboard.
        </p>
        {role==="none"&&status==="authenticated"&&(
          <div style={{padding:"12px 20px",background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,fontSize:"0.85rem",color:DANGER,marginBottom:20,textAlign:"center",maxWidth:420}}>
            Your email is not registered in this system. Contact your VA to be added.
          </div>
        )}
        <button
          onClick={()=>signIn("google",{callbackUrl:"/client"})}
          style={{display:"flex",alignItems:"center",gap:12,padding:"14px 32px",background:"white",border:"1px solid #E2E8F0",borderRadius:12,fontSize:"0.95rem",fontWeight:500,cursor:"pointer",boxShadow:"0 2px 16px rgba(0,0,0,0.12)",color:"#0F172A"}}>
          <GoogleIcon/> Continue with Google
        </button>
      </div>
    );
  }

  // VA trying to use client portal
  if (role==="va") {
    return (
      <div style={{...page,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{...card,textAlign:"center",maxWidth:400,padding:32}}>
          <div style={{fontSize:"2.5rem",marginBottom:12}}>🔐</div>
          <h2 style={{fontFamily:"'Sora',system-ui",marginBottom:8,color:C.text1}}>VA Account Detected</h2>
          <p style={{fontSize:"0.85rem",color:C.text2,lineHeight:1.7,marginBottom:20}}>
            You are signed in as the VA. This portal is for clients only. Go to your VA dashboard.
          </p>
          <a href="/dashboard" style={{display:"inline-block",padding:"10px 24px",background:ACCENT,color:"#0B0F1A",borderRadius:8,fontWeight:600,fontSize:"0.9rem",textDecoration:"none"}}>
            Go to VA Dashboard
          </a>
        </div>
      </div>
    );
  }

  // ── Client portal ──────────────────────────────────────────────────────────
  return (
    <div style={page}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        * { box-sizing: border-box; }
        .cl-btn {
          cursor: pointer;
          font-family: inherit;
          border: none;
          transition: all 0.15s ease;
          outline: none;
        }
        .cl-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .cl-btn:not(:disabled):hover {
          opacity: 0.85;
          transform: translateY(-1px);
          border-color: ${ACCENT} !important;
          box-shadow: 0 0 0 2px rgba(0,194,168,0.10);
        }
        .cl-btn:not(:disabled):active {
          transform: translateY(0px);
          opacity: 1;
        }
        .cl-btn-primary:not(:disabled):hover {
          box-shadow: 0 4px 16px rgba(0,194,168,0.40);
          opacity: 1;
        }
        .cl-btn-danger:not(:disabled):hover {
          background: rgba(239,68,68,0.25) !important;
          border-color: #EF4444 !important;
          color: #EF4444 !important;
          opacity: 1;
        }
        .cl-input:focus { border-color:${ACCENT}!important; box-shadow:0 0 0 3px rgba(0,194,168,0.12); }
        textarea.cl-input { resize:vertical; min-height:100px; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",
          zIndex:600,background:C.card,
          border:`1px solid ${toast.type==="success"?"rgba(34,197,94,0.3)":toast.type==="error"?"rgba(239,68,68,0.3)":"rgba(79,142,247,0.3)"}`,
          borderRadius:12,padding:"12px 24px",boxShadow:"0 8px 28px rgba(0,0,0,0.16)",
          fontSize:"0.87rem",fontWeight:500,
          color:toast.type==="success"?SUCCESS:toast.type==="error"?DANGER:BLUE,
          animation:"toastIn 0.3s ease",whiteSpace:"nowrap",
        }}>{toast.msg}</div>
      )}

      {/* Edit modal */}
      {editPost && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",backdropFilter:"blur(6px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeIn 0.2s ease"}}>
          <div style={{...card,width:580,maxWidth:"96vw",maxHeight:"90vh",overflow:"auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <h3 style={{fontSize:"1rem",fontWeight:600,color:C.text1,fontFamily:"'Sora',system-ui"}}>Edit Post Before Approving</h3>
              <button className="cl-btn" style={{background:"none",color:C.text3,fontSize:"1.1rem",padding:4}} onClick={()=>setEditPost(null)}>✕</button>
            </div>
            <p style={{fontSize:"0.78rem",color:C.text3,marginBottom:10,lineHeight:1.6}}>
              Make changes below. Your VA will see the update. The post stays pending until you click Approve.
            </p>
            <textarea
              className="cl-input"
              style={{...inp,minHeight:160,resize:"vertical",marginBottom:12,lineHeight:1.7}}
              value={editContent}
              onChange={e=>setEditContent(e.target.value)}
            />
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              {editPost.platforms.map(p=>(
                <span key={p} style={{fontSize:"0.72rem",fontWeight:600,padding:"3px 10px",borderRadius:20,background:PLAT_META[p]?.bg,color:PLAT_META[p]?.color}}>
                  {PLAT_META[p]?.label}
                </span>
              ))}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button className="cl-btn" style={{padding:"9px 18px",background:C.input,border:`1px solid ${C.border}`,borderRadius:8,color:C.text2,fontSize:"0.85rem"}} onClick={()=>setEditPost(null)}>Cancel</button>
              <button className="cl-btn" disabled={editSaving} onClick={saveEdit}
                style={{padding:"9px 18px",background:ACCENT,color:"#0B0F1A",borderRadius:8,fontWeight:600,fontSize:"0.85rem",display:"flex",alignItems:"center",gap:8}}>
                {editSaving?<><Spinner/>Saving…</>:"Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{height:64,background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
          <div style={{width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${ACCENT},#00A896)`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 3px 10px rgba(0,194,168,0.3)`,flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <path d="M10 2L18 6v8l-8 4-8-4V6z"/><path d="M10 2v12M2 6l8 4 8-4"/>
            </svg>
          </div>
          <div>
            <div style={{fontFamily:"'Sora',system-ui",fontWeight:700,fontSize:"0.95rem",color:C.text1}}>
              Social<em style={{color:ACCENT,fontStyle:"normal"}}>OS</em> — Client Portal
            </div>
            <div style={{fontSize:"0.68rem",color:C.text3}}>
              {getGreeting()}, {displayName}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {/* Independent theme toggle */}
          <button className="cl-btn" onClick={toggleTheme}
            style={{width:36,height:36,borderRadius:8,background:C.input,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:C.text2}}>
            {theme==="dark"?"☀️":"🌙"}
          </button>
          <button className="cl-btn" onClick={()=>loadPosts(true)}
            style={{padding:"7px 14px",borderRadius:8,background:C.input,border:`1px solid ${C.border}`,color:C.text2,fontSize:"0.82rem",display:"flex",alignItems:"center",gap:6}}>
            {refreshing ? <Spinner size={12}/> : <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12a6 6 0 1 0 1-4M4 4v4h4"/></svg>}
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button className="cl-btn" onClick={()=>signOut({callbackUrl:"/client"})}
            style={{padding:"7px 14px",borderRadius:8,background:C.input,border:`1px solid ${C.border}`,color:C.text2,fontSize:"0.82rem"}}>
            Sign out
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{maxWidth:860,margin:"0 auto",padding:"24px 20px"}}>

        {/* Alert banner */}
        {pendingCount > 0 && (
          <div style={{
            display:"flex",alignItems:"center",gap:14,
            padding:"14px 18px",background:"rgba(0,194,168,0.10)",
            border:"1px solid rgba(0,194,168,0.25)",borderRadius:12,marginBottom:24,
          }}>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round">
              <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z"/>
              <path d="M8 16a2 2 0 004 0"/>
            </svg>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Sora',system-ui",fontWeight:600,fontSize:"0.9rem",color:C.text1,marginBottom:2}}>
                {pendingCount} post{pendingCount!==1?"s":""} awaiting your approval
              </div>
              <div style={{fontSize:"0.78rem",color:C.text2}}>
                Review, approve or request changes. Approved posts publish automatically.
              </div>
            </div>
            <button className="cl-btn" onClick={()=>setTab("pending")}
              style={{padding:"8px 16px",background:ACCENT,color:"#0B0F1A",borderRadius:8,fontWeight:600,fontSize:"0.82rem"}}>
              Review
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{display:"flex",gap:0,marginBottom:24,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:4}}>
          {(["pending","approved","published","topics"] as Tab[]).map(t=>(
            <button key={t} className="cl-btn" onClick={()=>setTab(t)}
              style={{
                flex:1,padding:"9px 6px",borderRadius:9,
                fontSize:"0.82rem",fontWeight:500,
                background:tab===t?C.surface:"none",
                color:tab===t?C.text1:C.text3,
                boxShadow:tab===t?"0 1px 4px rgba(0,0,0,0.10)":"none",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6,
              }}>
              {{pending:"Pending",approved:"Approved",published:"Published",topics:"Submit Topic"}[t]}
              {t==="pending"&&pendingCount>0&&(
                <span style={{background:ACCENT,color:"#0B0F1A",fontSize:"0.62rem",fontWeight:700,padding:"1px 6px",borderRadius:20}}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Topics */}
        {tab==="topics" && (
          <div style={card}>
            <h3 style={{fontFamily:"'Sora',system-ui",fontSize:"0.95rem",fontWeight:600,marginBottom:6,color:C.text1}}>
              Submit a Topic Idea
            </h3>
            <p style={{fontSize:"0.82rem",color:C.text3,marginBottom:20,lineHeight:1.6}}>
              Describe a topic you want your VA to create a post about. Select the platforms and add a media URL if you have one.
            </p>

            <div style={{marginBottom:14}}>
              <label style={lbl}>Topic / Idea</label>
              <textarea className="cl-input"
                style={{...inp,minHeight:100,resize:"vertical",lineHeight:1.7}}
                placeholder="e.g. Share our Q2 results and highlight the 30% growth in user sign-ups."
                value={topicText}
                onChange={e=>setTopicText(e.target.value)}
              />
            </div>

            <div style={{marginBottom:14}}>
              <label style={lbl}>Platforms</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {ALL_PLATFORMS.map(p=>{
                  const on=topicPlats.has(p); const m=PLAT_META[p];
                  return (
                    <button key={p} className="cl-btn"
                      style={{padding:"6px 14px",borderRadius:20,fontSize:"0.78rem",fontWeight:500,border:`1px solid ${on?m.color:C.border}`,background:on?m.bg:C.input,color:on?m.color:C.text2}}
                      onClick={()=>{
                        setTopicPlats(prev=>{const n=new Set<Platform>(Array.from(prev));on?n.delete(p):n.add(p);return n;});
                      }}>
                      {on&&"✓ "}{m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{marginBottom:20}}>
              <label style={lbl}>Media URL (optional)</label>
              <input type="url" className="cl-input"
                style={{...inp}} placeholder="Google Drive / Dropbox share link to an image or video"
                value={topicMedia} onChange={e=>setTopicMedia(e.target.value)}/>
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                <label className="cl-btn cl-btn-primary"
                  style={{padding:"7px 12px",borderRadius:8,background:C.input,border:`1px solid ${C.border}`,color:C.text2,fontSize:"0.78rem"}}>
                  {topicUploading ? "Uploading..." : "Upload media"}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    disabled={topicUploading}
                    style={{display:"none"}}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadTopicMedia(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <span style={{fontSize:"0.72rem",color:C.text3}}>Auto-generates shareable link</span>
              </div>
            </div>

            {topicMsg && (
              <div style={{fontSize:"0.82rem",fontWeight:500,color:topicMsg.ok?SUCCESS:DANGER,marginBottom:12}}>
                {topicMsg.text}
              </div>
            )}

            <button className="cl-btn" disabled={topicSaving} onClick={submitTopic}
              style={{padding:"10px 24px",background:ACCENT,color:"#0B0F1A",borderRadius:9,fontWeight:600,fontSize:"0.87rem",display:"flex",alignItems:"center",gap:8}}>
              {topicSaving?<><Spinner/>Submitting…</>:"Submit to VA"}
            </button>
          </div>
        )}

        {/* Post lists */}
        {tab !== "topics" && (
          postsLoading ? (
            <div style={{display:"flex",justifyContent:"center",padding:56}}>
              <Spinner size={36}/>
            </div>
          ) : (byTab[tab as "pending"|"approved"|"published"] ?? []).length===0 ? (
            <div style={{...card,textAlign:"center",padding:56}}>
              <div style={{fontFamily:"'Sora',system-ui",fontSize:"0.95rem",fontWeight:600,marginBottom:8,color:C.text1}}>
                {tab==="pending"?"Nothing needs your approval right now":`No ${tab} posts yet`}
              </div>
              <p style={{fontSize:"0.82rem",color:C.text3,lineHeight:1.6}}>
                {tab==="pending"
                  ?"Your VA will notify you when new posts are ready."
                  :"Posts will appear here once they exist."}
              </p>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {(byTab[tab as "pending"|"approved"|"published"] ?? []).map(post=>(
                <div key={post.id} style={card}>
                  {/* Platform tags + schedule */}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                    {post.platforms.map(p=>(
                      <span key={p} style={{fontSize:"0.72rem",fontWeight:600,padding:"3px 10px",borderRadius:20,background:PLAT_META[p]?.bg,color:PLAT_META[p]?.color}}>
                        {PLAT_META[p]?.label??p}
                      </span>
                    ))}
                    <span style={{marginLeft:"auto",fontSize:"0.72rem",color:C.text3}}>
                      {post.scheduledAt?new Date(post.scheduledAt).toLocaleString():"No schedule set"}
                    </span>
                  </div>

                  {/* Content — exact whitespace preserved */}
                  <div style={{
                    fontSize:"0.9rem",lineHeight:1.8,color:C.text1,
                    marginBottom:14,padding:"14px 16px",
                    background:C.input,borderRadius:9,
                    border:`1px solid ${C.border}`,
                    whiteSpace:"pre-wrap",wordBreak:"break-word",
                  }}>
                    {post.content}
                  </div>

                  {/* Media */}
                  {post.mediaUrl && (
                    <div style={{fontSize:"0.78rem",color:C.text3,marginBottom:12}}>
                      Media: <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer"
                        style={{color:BLUE,textDecoration:"underline"}}>View attached media</a>
                    </div>
                  )}

                  {/* Status + actions */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                    <span style={{
                      fontSize:"0.68rem",fontWeight:600,padding:"4px 10px",borderRadius:20,
                      textTransform:"capitalize",
                      background:post.status==="published"?"rgba(34,197,94,0.12)":post.status==="approved"?"rgba(79,142,247,0.12)":post.status==="pending"?"rgba(245,158,11,0.12)":"rgba(255,255,255,0.06)",
                      color:post.status==="published"?SUCCESS:post.status==="approved"?BLUE:post.status==="pending"?GOLD:C.text3,
                    }}>
                      {post.status}
                    </span>

                    {post.status==="pending" && (
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <button className="cl-btn"
                          style={{padding:"7px 14px",borderRadius:8,background:C.input,border:`1px solid ${C.border}`,color:C.text2,fontSize:"0.82rem"}}
                          disabled={!!acting}
                          onClick={()=>{setEditPost(post);setEditContent(post.content);}}>
                          Edit
                        </button>
                        <button className="cl-btn"
                          style={{padding:"7px 14px",borderRadius:8,background:C.input,border:`1px solid ${C.border}`,color:C.text2,fontSize:"0.82rem"}}
                          disabled={!!acting}
                          onClick={()=>requestChanges(post)}>
                          Request Changes
                        </button>
                        <button className="cl-btn"
                          style={{padding:"7px 16px",borderRadius:8,background:ACCENT,color:"#0B0F1A",fontWeight:600,fontSize:"0.82rem",display:"flex",alignItems:"center",gap:6}}
                          disabled={!!acting}
                          onClick={()=>approve(post)}>
                          {acting===post.id?<Spinner/>:<CheckIco/>}
                          Approve
                        </button>
                      </div>
                    )}

                    {post.status==="approved"&&(
                      <span style={{fontSize:"0.72rem",color:BLUE,fontWeight:500}}>
                        ✓ Approved — publishes at scheduled time
                      </span>
                    )}
                    {post.status==="published"&&post.publishedAt&&(
                      <span style={{fontSize:"0.72rem",color:SUCCESS,fontWeight:500}}>
                        ✓ Published {new Date(post.publishedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Spinner({ size=14 }:{size?:number}) {
  return <div style={{width:size,height:size,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.2)",borderTopColor:"currentColor",animation:"spin 0.7s linear infinite",flexShrink:0}}/>;
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
function CheckIco() {
  return <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 10l4 4 8-8"/></svg>;
}