"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import type { Post, Platform } from "@/types";

type Tab = "pending"|"approved"|"published"|"topics";

const ALL_PLATFORMS: Platform[] = ["linkedin","instagram","facebook","x","tiktok"];
const PLAT_META: Record<Platform,{label:string;color:string;bg:string}> = {
  linkedin:  {label:"LinkedIn",  color:"#0077B5",bg:"rgba(0,119,181,0.12)"},
  instagram: {label:"Instagram", color:"#E1306C",bg:"rgba(225,48,108,0.12)"},
  facebook:  {label:"Facebook",  color:"#1877F2",bg:"rgba(24,119,242,0.12)"},
  x:         {label:"X",         color:"#888888",bg:"rgba(255,255,255,0.08)"},
  tiktok:    {label:"TikTok",    color:"#69C9D0",bg:"rgba(105,201,208,0.12)"},
};

const PILL_CLS: Record<string,string> = {
  published:"pill-published",scheduled:"pill-scheduled",
  approved:"pill-approved",pending:"pill-pending",
  draft:"pill-draft",failed:"pill-failed",publishing:"pill-publishing",
};

export default function ClientPortal() {
  const { data:session, status } = useSession();
  const [role,        setRole]        = useState<"loading"|"client"|"va"|"none">("loading");
  const [tab,         setTab]         = useState<Tab>("pending");
  const [posts,       setPosts]       = useState<(Post & {rowIndex:number})[]>([]);
  const [postsLoading,setPostsLoading]= useState(true);
  const [toast,       setToast]       = useState<{msg:string;type:"success"|"error"}|null>(null);
  const [acting,      setActing]      = useState<string|null>(null);

  // Edit state
  const [editPost,    setEditPost]    = useState<(Post & {rowIndex:number})|null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving,  setEditSaving]  = useState(false);

  // Topic submission state
  const [topicText,   setTopicText]   = useState("");
  const [topicPlats,  setTopicPlats]  = useState<Set<Platform>>(new Set<Platform>(["linkedin","instagram"]));
  const [topicMedia,  setTopicMedia]  = useState("");
  const [topicSaving, setTopicSaving] = useState(false);
  const [topicMsg,    setTopicMsg]    = useState("");

  function showToast(msg:string, type:"success"|"error") {
    setToast({msg,type});
    setTimeout(()=>setToast(null),3500);
  }

  // ── Check role ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") { setRole("none"); return; }
    if (status === "authenticated") {
      fetch("/api/role").then(r=>r.json()).then(res=>{
        setRole(res.role ?? "none");
      }).catch(()=>setRole("none"));
    }
  }, [status]);

  // ── Load posts ──────────────────────────────────────────────────────────────
  const loadPosts = useCallback(() => {
    if (role !== "client") return;
    fetch("/api/posts").then(r=>r.json())
      .then(res=>{ if(res.ok) setPosts(res.data); })
      .finally(()=>setPostsLoading(false));
  }, [role]);

  useEffect(() => {
    loadPosts();
    const id = setInterval(loadPosts, 20_000);
    return () => clearInterval(id);
  }, [loadPosts]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function approve(post: Post & {rowIndex:number}) {
    setActing(post.id);
    try {
      const res = await fetch("/api/posts/approve",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({postId:post.id, rowIndex:post.rowIndex, status:"approved"}),
      }).then(r=>r.json());
      if (res.ok) {
        setPosts(p=>p.map(x=>x.id===post.id?{...x,status:"approved"}:x));
        showToast("Post approved — will publish at the scheduled time","success");
      } else { showToast(res.error||"Failed","error"); }
    } finally { setActing(null); }
  }

  async function requestChanges(post: Post & {rowIndex:number}) {
    const note = window.prompt("What changes would you like? (optional note to your VA)");
    setActing(post.id);
    try {
      const res = await fetch("/api/posts/approve",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({postId:post.id, rowIndex:post.rowIndex, status:"draft", note}),
      }).then(r=>r.json());
      if (res.ok) {
        setPosts(p=>p.map(x=>x.id===post.id?{...x,status:"draft"}:x));
        showToast("Sent back for edits — your VA will revise and resubmit","success");
      } else { showToast(res.error||"Failed","error"); }
    } finally { setActing(null); }
  }

  async function saveEdit() {
    if (!editPost) return;
    setEditSaving(true);
    try {
      // Update via approve endpoint with new content note
      const res = await fetch("/api/posts/approve",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          postId:editPost.id, rowIndex:editPost.rowIndex,
          status:"pending", note:`Client edited content: ${editContent}`,
        }),
      }).then(r=>r.json());
      // Also update content in sheet via PATCH-style approach
      await fetch("/api/posts",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          ...editPost, content:editContent, status:"pending"
        }),
      });
      if (res.ok) {
        setPosts(p=>p.map(x=>x.id===editPost.id?{...x,content:editContent}:x));
        setEditPost(null);
        showToast("Post updated — now pending re-approval","success");
      } else { showToast(res.error||"Failed to save","error"); }
    } finally { setEditSaving(false); }
  }

  async function submitTopic() {
    if (!topicText.trim()) { setTopicMsg("Please describe the topic"); return; }
    if (topicPlats.size===0){ setTopicMsg("Select at least one platform"); return; }
    setTopicSaving(true); setTopicMsg("");
    try {
      const res = await fetch("/api/posts",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          content:     `[TOPIC IDEA] ${topicText}`,
          platforms:   Array.from(topicPlats),
          mediaUrl:    topicMedia,
          status:      "draft",
          clientId:    session?.user?.email ?? "client",
          scheduledAt: "",
        }),
      }).then(r=>r.json());
      if (res.ok) {
        setTopicText(""); setTopicMedia("");
        setTopicMsg("Topic submitted to your VA");
        showToast("Topic idea sent to your VA","success");
      } else { setTopicMsg(res.error||"Failed to submit"); }
    } finally { setTopicSaving(false); }
  }

  // ── Filtered posts ──────────────────────────────────────────────────────────
  const filtered = {
    pending:   posts.filter(p=>p.status==="pending"),
    approved:  posts.filter(p=>p.status==="approved"),
    published: posts.filter(p=>p.status==="published"||p.status==="partial"),
    topics:    [],
  }[tab] ?? [];

  const pendingCount = posts.filter(p=>p.status==="pending").length;

  // ── Signed out ──────────────────────────────────────────────────────────────
  if (status === "loading" || role === "loading") {
    return (
      <div style={{minHeight:"100vh",background:"#0B0F1A",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div className="spinner spinner-lg"/>
      </div>
    );
  }

  if (status === "unauthenticated" || role === "none") {
    return (
      <div style={{minHeight:"100vh",background:"#0B0F1A",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#00C2A8,#00A896)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 24px rgba(0,194,168,0.35)",marginBottom:20}}>
          <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <path d="M10 2L18 6v8l-8 4-8-4V6z"/><path d="M10 2v12M2 6l8 4 8-4"/>
          </svg>
        </div>
        <h1 style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:"1.6rem",color:"#F1F5F9",marginBottom:8,letterSpacing:"-0.02em"}}>
          Social<em style={{color:"#00C2A8",fontStyle:"normal"}}>OS</em> — Client Portal
        </h1>
        <p style={{fontSize:"0.9rem",color:"#94A3B8",marginBottom:32,textAlign:"center",maxWidth:380,lineHeight:1.6}}>
          Sign in with the Google account registered by your VA to access your social media dashboard.
        </p>
        {role === "none" && status === "authenticated" && (
          <div style={{padding:"12px 20px",background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,fontSize:"0.85rem",color:"#EF4444",marginBottom:20,textAlign:"center",maxWidth:380}}>
            Your email is not registered in this system. Contact your VA to be added.
          </div>
        )}
        <button
          onClick={()=>signIn("google", {callbackUrl:"/client"})}
          style={{
            display:"flex",alignItems:"center",gap:12,padding:"14px 28px",
            background:"#FFFFFF",border:"1px solid #E2E8F0",
            borderRadius:12,fontSize:"0.95rem",fontWeight:500,
            fontFamily:"'DM Sans',sans-serif",cursor:"pointer",
            boxShadow:"0 2px 12px rgba(0,0,0,0.15)",color:"#0F172A",
          }}>
          <GoogleIcon/>
          Continue with Google
        </button>
      </div>
    );
  }

  // ── VA trying to access client portal ──────────────────────────────────────
  if (role === "va") {
    return (
      <div style={{minHeight:"100vh",background:"#0B0F1A",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{padding:"24px 32px",background:"#1A2235",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,textAlign:"center",maxWidth:400}}>
          <div style={{fontSize:"2rem",marginBottom:12}}>🔐</div>
          <h2 style={{fontFamily:"'Sora',sans-serif",color:"#F1F5F9",marginBottom:8}}>VA Account Detected</h2>
          <p style={{fontSize:"0.85rem",color:"#94A3B8",lineHeight:1.6,marginBottom:20}}>
            You are signed in as the VA. The client portal is for clients only.
            Go to your VA dashboard instead.
          </p>
          <a href="/dashboard" style={{display:"inline-block",padding:"10px 24px",background:"#00C2A8",color:"#0B0F1A",borderRadius:8,fontWeight:600,fontSize:"0.9rem",textDecoration:"none"}}>
            Go to VA Dashboard
          </a>
        </div>
      </div>
    );
  }

  // ── Client portal ────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"var(--bg-app)"}}>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",
          zIndex:600,background:"var(--bg-card)",
          border:`1px solid ${toast.type==="success"?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`,
          borderRadius:"var(--radius-md)",padding:"12px 24px",
          boxShadow:"var(--shadow-md)",fontSize:"0.87rem",fontWeight:500,
          color:toast.type==="success"?"var(--success)":"var(--danger)",
          animation:"toastIn 0.3s var(--ease)",whiteSpace:"nowrap",
        }}>{toast.msg}</div>
      )}

      {/* Edit modal */}
      {editPost && (
        <div className="modal-backdrop" onClick={()=>setEditPost(null)}>
          <div className="modal" style={{width:580}} onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Edit Post Before Approving</span>
              <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-3)",fontSize:"1.1rem"}} onClick={()=>setEditPost(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:"0.78rem",color:"var(--text-3)",marginBottom:10,lineHeight:1.6}}>
                Make any changes to the content below. Your VA will see the updated version and the post will remain pending until you approve it.
              </p>
              <textarea
                className="textarea"
                style={{minHeight:160,fontSize:"0.87rem"}}
                value={editContent}
                onChange={e=>setEditContent(e.target.value)}
              />
              <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
                {editPost.platforms.map(p=>(
                  <span key={p} style={{fontSize:"0.72rem",fontWeight:600,padding:"3px 10px",borderRadius:20,background:PLAT_META[p as Platform]?.bg,color:PLAT_META[p as Platform]?.color}}>
                    {PLAT_META[p as Platform]?.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={()=>setEditPost(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={editSaving} onClick={saveEdit}>
                {editSaving?<><span className="spinner" style={{marginRight:6}}/>Saving…</>:"Save & Keep Pending"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{
        height:64,background:"var(--bg-surface)",borderBottom:"1px solid var(--border)",
        padding:"0 24px",display:"flex",alignItems:"center",gap:14,
        position:"sticky",top:0,zIndex:100,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
          <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,var(--accent),#00A896)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 3px 10px var(--accent-glow)",flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <path d="M10 2L18 6v8l-8 4-8-4V6z"/><path d="M10 2v12M2 6l8 4 8-4"/>
            </svg>
          </div>
          <div>
            <div style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:"0.95rem",color:"var(--text-1)"}}>
              Social<em style={{color:"var(--accent)",fontStyle:"normal"}}>OS</em> — Client Portal
            </div>
            <div style={{fontSize:"0.68rem",color:"var(--text-3)"}}>
              Welcome, {session?.user?.name?.split(" ")[0] ?? "Client"}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button className="btn btn-secondary btn-sm" onClick={loadPosts}>
            <RefreshIco/> Refresh
          </button>
          <button className="btn btn-secondary btn-sm" onClick={()=>signOut({callbackUrl:"/client"})}>
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
            padding:"14px 18px",background:"var(--accent-dim)",
            border:"1px solid rgba(0,194,168,0.25)",borderRadius:"var(--radius-md)",marginBottom:24,
          }}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z"/>
              <path d="M8 16a2 2 0 004 0"/>
            </svg>
            <div style={{flex:1}}>
              <div style={{fontFamily:"var(--font-head)",fontWeight:600,fontSize:"0.9rem",color:"var(--text-1)",marginBottom:2}}>
                {pendingCount} post{pendingCount!==1?"s":""} awaiting your approval
              </div>
              <div style={{fontSize:"0.78rem",color:"var(--text-2)"}}>
                Review, approve or request changes below. Approved posts publish automatically.
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={()=>setTab("pending")}>
              Review now
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display:"flex",gap:0,marginBottom:20,
          background:"var(--bg-card)",border:"1px solid var(--border)",
          borderRadius:"var(--radius-md)",padding:4,
        }}>
          {(["pending","approved","published","topics"] as Tab[]).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              flex:1,padding:"9px 6px",borderRadius:"var(--radius-sm)",
              fontSize:"0.82rem",fontWeight:500,border:"none",cursor:"pointer",
              fontFamily:"var(--font-body)",
              background:tab===t?"var(--bg-surface)":"none",
              color:tab===t?"var(--text-1)":"var(--text-3)",
              boxShadow:tab===t?"var(--shadow-xs)":"none",
              transition:"all var(--t-fast) var(--ease)",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            }}>
              {{pending:"Pending",approved:"Approved",published:"Published",topics:"Submit Topic"}[t]}
              {t==="pending" && pendingCount>0 && (
                <span style={{background:"var(--accent)",color:"#0B0F1A",fontSize:"0.62rem",fontWeight:700,padding:"1px 6px",borderRadius:20}}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Submit topic */}
        {tab==="topics" && (
          <div className="card card-pad">
            <div style={{fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:600,marginBottom:6,color:"var(--text-1)"}}>
              Submit a Topic Idea
            </div>
            <p style={{fontSize:"0.82rem",color:"var(--text-3)",marginBottom:16,lineHeight:1.6}}>
              Describe a topic or idea you want your VA to create a post about.
              Select the platforms and add a media URL if you have one.
            </p>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:"0.78rem",fontWeight:600,color:"var(--text-2)",marginBottom:6,display:"block"}}>Topic / Idea</label>
              <textarea
                className="textarea"
                style={{minHeight:100,fontSize:"0.875rem"}}
                placeholder="e.g. Share our Q2 results and what the team is proud of this quarter. Highlight the 30% growth in user sign-ups."
                value={topicText}
                onChange={e=>setTopicText(e.target.value)}
              />
            </div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:"0.78rem",fontWeight:600,color:"var(--text-2)",marginBottom:8,display:"block"}}>Platforms</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {ALL_PLATFORMS.map(p=>{
                  const on = topicPlats.has(p);
                  const m  = PLAT_META[p];
                  return (
                    <button key={p} onClick={()=>{
                      setTopicPlats(prev=>{
                        const n=new Set<Platform>(Array.from(prev));
                        on?n.delete(p):n.add(p);
                        return n;
                      });
                    }} style={{
                      padding:"6px 14px",borderRadius:20,fontSize:"0.78rem",fontWeight:500,
                      border:`1px solid ${on?m.color:"var(--border)"}`,
                      background:on?m.bg:"var(--bg-input)",
                      color:on?m.color:"var(--text-2)",
                      cursor:"pointer",fontFamily:"var(--font-body)",
                      transition:"all var(--t-fast) var(--ease)",
                    }}>
                      {on&&"✓ "}{m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <label style={{fontSize:"0.78rem",fontWeight:600,color:"var(--text-2)",marginBottom:6,display:"block"}}>Media URL (optional)</label>
              <input type="url" className="input" placeholder="Google Drive share link to an image or video"
                value={topicMedia} onChange={e=>setTopicMedia(e.target.value)}/>
            </div>

            {topicMsg && (
              <div style={{fontSize:"0.82rem",color:topicMsg.includes("submit")||topicMsg.includes("sent")?"var(--success)":"var(--danger)",marginBottom:12,fontWeight:500}}>
                {topicMsg}
              </div>
            )}

            <button className="btn btn-primary" disabled={topicSaving} onClick={submitTopic}>
              {topicSaving?<><span className="spinner" style={{marginRight:6}}/>Submitting…</>:"Submit to VA"}
            </button>
          </div>
        )}

        {/* Post lists */}
        {tab !== "topics" && (
          postsLoading ? (
            <div style={{display:"flex",justifyContent:"center",padding:48}}>
              <div className="spinner spinner-lg"/>
            </div>
          ) : filtered.length===0 ? (
            <div className="card card-pad" style={{textAlign:"center",padding:48}}>
              <div style={{fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:600,marginBottom:8,color:"var(--text-1)"}}>
                {tab==="pending"?"Nothing needs your approval right now":`No ${tab} posts yet`}
              </div>
              <p style={{fontSize:"0.82rem",color:"var(--text-3)",lineHeight:1.6}}>
                {tab==="pending"
                  ?"Your VA will notify you when new posts are ready for review."
                  :"Posts will appear here once they exist."}
              </p>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {filtered.map(post=>(
                <div key={post.id} className="card card-pad">
                  {/* Platforms + schedule */}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                    {post.platforms.map(p=>(
                      <span key={p} style={{
                        fontSize:"0.72rem",fontWeight:600,padding:"3px 10px",borderRadius:20,
                        background:PLAT_META[p as Platform]?.bg??"var(--bg-input)",
                        color:PLAT_META[p as Platform]?.color??"var(--text-3)",
                      }}>
                        {PLAT_META[p as Platform]?.label??p}
                      </span>
                    ))}
                    <span style={{marginLeft:"auto",fontSize:"0.72rem",color:"var(--text-3)"}}>
                      {post.scheduledAt?new Date(post.scheduledAt).toLocaleString():"No schedule set"}
                    </span>
                  </div>

                  {/* Content */}
                  <div style={{
                    fontSize:"0.9rem",lineHeight:1.8,color:"var(--text-1)",
                    marginBottom:16,padding:"14px 16px",
                    background:"var(--bg-input)",borderRadius:"var(--radius-sm)",
                    border:"1px solid var(--border)",
                  }}>
                    {post.content}
                  </div>

                  {/* Media */}
                  {post.mediaUrl && (
                    <div style={{fontSize:"0.78rem",color:"var(--text-3)",marginBottom:12}}>
                      Media: <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer"
                        style={{color:"var(--blue)",textDecoration:"underline"}}>
                        View attached media
                      </a>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                    <span className={`pill ${PILL_CLS[post.status]??"pill-draft"}`}>{post.status}</span>

                    {post.status==="pending" && (
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <button className="btn btn-secondary btn-sm"
                          disabled={!!acting} onClick={()=>{setEditPost(post);setEditContent(post.content);}}>
                          Edit
                        </button>
                        <button className="btn btn-secondary btn-sm"
                          disabled={!!acting} onClick={()=>requestChanges(post)}>
                          Request Changes
                        </button>
                        <button className="btn btn-primary btn-sm"
                          disabled={!!acting} onClick={()=>approve(post)}>
                          {acting===post.id?<span className="spinner"/>:<CheckIco/>}
                          Approve
                        </button>
                      </div>
                    )}

                    {post.status==="published" && post.publishedAt && (
                      <span style={{fontSize:"0.72rem",color:"var(--success)",fontWeight:500}}>
                        ✓ Published {new Date(post.publishedAt).toLocaleString()}
                      </span>
                    )}

                    {post.status==="approved" && (
                      <span style={{fontSize:"0.72rem",color:"var(--blue)",fontWeight:500}}>
                        Approved — will publish at scheduled time
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
function CheckIco()   { return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 10l4 4 8-8"/></svg>; }
function RefreshIco() { return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12a6 6 0 1 0 1-4M4 4v4h4"/></svg>; }