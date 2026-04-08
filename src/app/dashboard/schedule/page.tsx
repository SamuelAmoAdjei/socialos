"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_META, type Platform, type Post, type PostStatus } from "@/types";

const ALL_PLATFORMS: Platform[] = ["linkedin","instagram","facebook","x","tiktok"];
const NON_EDITABLE_STATUS = new Set<PostStatus>(["published", "partial", "publishing"]);

const FILTERS: { label:string; value:PostStatus|"all" }[] = [
  { label:"All Posts",  value:"all"       },
  { label:"Scheduled",  value:"scheduled" },
  { label:"Published",  value:"published" },
  { label:"Drafts",     value:"draft"     },
  { label:"Pending",    value:"pending"   },
  { label:"Failed",     value:"failed"    },
];

const PILL: Record<string,string> = {
  published:"pill-published", scheduled:"pill-scheduled",
  approved:"pill-approved",   publishing:"pill-publishing",
  partial:"pill-partial",     draft:"pill-draft",
  failed:"pill-failed",       pending:"pill-pending",
};

export default function SchedulePage() {
  const router = useRouter();
  const [posts,    setPosts]    = useState<(Post & {rowIndex:number})[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<PostStatus|"all">("all");
  const [selected, setSelected] = useState<(Post & {rowIndex:number})|null>(null);
  const [deleting, setDeleting] = useState<string|null>(null);
  const [toast,    setToast]    = useState<{msg:string;ok:boolean}|null>(null);
  const [timeRange, setTimeRange] = useState<"all"|"week"|"month"|"year">("all");
  const [platformFilter, setPlatformFilter] = useState<"all"|Platform>("all");
  const [refreshing, setRefreshing] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editMediaUrl, setEditMediaUrl] = useState("");
  const [editLi, setEditLi] = useState("");
  const [editX, setEditX] = useState("");
  const [editIg, setEditIg] = useState("");
  const [editPlats, setEditPlats] = useState<Set<Platform>>(new Set());

  const load = useCallback(() => {
    setRefreshing(true);
    fetch("/api/posts").then(r=>r.json())
      .then(res=>{ if(res.ok) setPosts(res.data); })
      .finally(()=>{
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setEditContent(selected.content);
    setEditScheduledAt(selected.scheduledAt ? selected.scheduledAt.slice(0, 16) : "");
    setEditMediaUrl(selected.mediaUrl || "");
    setEditLi(selected.liOverride || "");
    setEditX(selected.xOverride || "");
    setEditIg(selected.igOverride || "");
    setEditPlats(new Set<Platform>(selected.platforms));
    setEditMode(false);
  }, [selected]);

  function showToast(msg:string, ok:boolean) {
    setToast({msg,ok});
    setTimeout(()=>setToast(null),3500);
  }

  async function deletePost(post: Post & {rowIndex:number}) {
    if (!window.confirm(`Delete this post?\n\n"${post.content.substring(0,80)}…"`)) return;
    setDeleting(post.id);
    try {
      const res = await fetch("/api/posts/delete",{
        method:"DELETE", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ rowIndex: post.rowIndex }),
      }).then(r=>r.json());
      if (res.ok) {
        setPosts(p=>p.filter(x=>x.id!==post.id));
        setSelected(null);
        showToast("Post deleted","true" as any);
      } else {
        showToast(res.error||"Delete failed", false);
      }
    } finally { setDeleting(null); }
  }

  const inSelectedTimeRange = (post: Post) => {
    if (timeRange === "all") return true;
    const source = post.scheduledAt || post.createdAt || post.publishedAt;
    if (!source) return false;
    const dt = new Date(source);
    if (Number.isNaN(dt.getTime())) return false;
    const now = new Date();
    const diffMs = now.getTime() - dt.getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (timeRange === "week") return diffMs <= 7 * oneDay;
    if (timeRange === "month") return diffMs <= 31 * oneDay;
    return diffMs <= 365 * oneDay;
  };

  const canEditSelected = selected ? !NON_EDITABLE_STATUS.has(selected.status) : false;

  async function saveEdits() {
    if (!selected || !canEditSelected) return;
    if (!editContent.trim()) {
      showToast("Content cannot be empty", false);
      return;
    }
    if (editPlats.size === 0) {
      showToast("Select at least one platform", false);
      return;
    }
    setSavingEdit(true);
    try {
      const body: Record<string, unknown> = {
        rowIndex: selected.rowIndex,
        postId: selected.id,
        content: editContent,
        platforms: Array.from(editPlats),
        mediaUrl: editMediaUrl.trim() || "",
        scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : "",
        liOverride: editLi.trim() || undefined,
        xOverride: editX.trim() || undefined,
        igOverride: editIg.trim() || undefined,
      };
      const res = await fetch("/api/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (res.ok) {
        const nextPlats = Array.from(editPlats);
        setPosts((p) =>
          p.map((x) =>
            x.id === selected.id
              ? {
                  ...x,
                  content: editContent,
                  scheduledAt: body.scheduledAt as string,
                  mediaUrl: editMediaUrl.trim(),
                  liOverride: editLi,
                  xOverride: editX,
                  igOverride: editIg,
                  platforms: nextPlats,
                }
              : x
          )
        );
        setSelected((s) =>
          s && s.id === selected.id
            ? {
                ...s,
                content: editContent,
                scheduledAt: (body.scheduledAt as string) || s.scheduledAt,
                mediaUrl: editMediaUrl.trim(),
                liOverride: editLi,
                xOverride: editX,
                igOverride: editIg,
                platforms: nextPlats,
              }
            : s
        );
        showToast("Post updated", true);
        setEditMode(false);
      } else {
        showToast(res.error || "Save failed", false);
      }
    } finally {
      setSavingEdit(false);
    }
  }

  function toggleEditPlat(p: Platform) {
    setEditPlats((prev) => {
      const n = new Set(prev);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  }

  const filtered = posts
    .filter((p) => (filter === "all" ? true : p.status === filter))
    .filter((p) => (platformFilter === "all" ? true : p.platforms.includes(platformFilter)))
    .filter((p) => inSelectedTimeRange(p))
    .sort((a, b) => {
      const aTs = new Date(a.createdAt || a.scheduledAt || a.publishedAt || 0).getTime();
      const bTs = new Date(b.createdAt || b.scheduledAt || b.publishedAt || 0).getTime();
      return bTs - aTs;
    });

  return (
    <div style={{position:"relative"}}>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed",bottom:24,right:24,zIndex:600,
          padding:"12px 20px",borderRadius:"var(--radius-md)",
          background:"var(--bg-card)",border:`1px solid ${toast.ok?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`,
          boxShadow:"var(--shadow-md)",fontSize:"0.85rem",fontWeight:500,
          color:toast.ok?"var(--success)":"var(--danger)",
          animation:"toastIn 0.3s var(--ease)",
        }}>{toast.msg}</div>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="page-title">Post Queue</h1>
          <p className="page-subtitle">{posts.length} total posts · auto-refreshes every 20s</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            {refreshing ? <span className="spinner" style={{marginRight:6}}/> : <RefreshIco/>}
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn btn-primary" onClick={()=>router.push("/dashboard/compose")}>
            <PlusIco/> New Post
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {FILTERS.map(f=>{
          const count = f.value==="all" ? posts.length : posts.filter(p=>p.status===f.value).length;
          return (
            <button key={f.value} onClick={()=>setFilter(f.value)} style={{
              padding:"7px 14px",borderRadius:20,
              fontSize:"0.78rem",fontWeight:500,
              border:`1px solid ${filter===f.value?"var(--accent)":"var(--border)"}`,
              background:filter===f.value?"var(--accent-dim)":"var(--bg-input)",
              color:filter===f.value?"var(--accent)":"var(--text-2)",
              cursor:"pointer",fontFamily:"var(--font-body)",
              transition:"all var(--t-fast) var(--ease)",
              display:"flex",alignItems:"center",gap:6,
            }}>
              {f.label}
              {count > 0 && (
                <span style={{
                  fontSize:"0.62rem",fontWeight:700,
                  padding:"1px 5px",borderRadius:10,
                  background:filter===f.value?"var(--accent)":"var(--border-md)",
                  color:filter===f.value?"#0B0F1A":"var(--text-2)",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        <select
          className="input"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
          style={{width: 180}}
        >
          <option value="all">All time</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
          <option value="year">Last 12 months</option>
        </select>
        <select
          className="input"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as "all"|Platform)}
          style={{width: 200}}
        >
          <option value="all">All platforms</option>
          {Object.keys(PLATFORM_META).map((p) => (
            <option key={p} value={p}>{PLATFORM_META[p as Platform].label}</option>
          ))}
        </select>
      </div>

      {/* Post list */}
      <div className="card" style={{overflow:"hidden"}}>
        {loading && (
          <div className="empty-state">
            <div className="spinner spinner-lg"/>
            <p style={{marginTop:16,color:"var(--text-3)",fontSize:"0.875rem"}}>
              Loading posts from your Google Sheet…
            </p>
          </div>
        )}
        {!loading && filtered.length===0 && (
          <div className="empty-state">
            <div className="empty-icon"><CalIco/></div>
            <div className="empty-title">No posts found</div>
            <p className="empty-desc">
              {filter==="all"
                ? "Create your first post to see it here."
                : `No posts with status "${filter}".`}
            </p>
            <button className="btn btn-primary btn-sm"
              onClick={()=>router.push("/dashboard/compose")}>
              <PlusIco/> Compose a post
            </button>
          </div>
        )}
        {!loading && filtered.map((post,i) => (
          <div key={post.id} style={{
            display:"flex",alignItems:"center",gap:12,
            padding:"14px 20px",borderBottom: i<filtered.length-1 ? "1px solid var(--border)" : "none",
            transition:"background var(--t-fast) var(--ease)",cursor:"pointer",
            minWidth:0,
          }}
          onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-hover)")}
          onMouseLeave={e=>(e.currentTarget.style.background="")}
          onClick={()=>setSelected(post)}>

            <div className="plat-dots" style={{marginTop:2,flexShrink:0}}>
              {post.platforms.slice(0,3).map(p=>(
                <div key={p} className="plat-dot"
                  style={{background:PLATFORM_META[p as Platform]?.bg??"var(--bg-input)",color:PLATFORM_META[p as Platform]?.color??"var(--text-3)"}}>
                  {PLATFORM_META[p as Platform]?.short??p.substring(0,2).toUpperCase()}
                </div>
              ))}
            </div>

            <div className="post-body" style={{minWidth:0,flex:1}}>
              <div
                className="post-preview"
                title={post.content || "(no content)"}
                style={{
                  whiteSpace:"nowrap",
                  overflow:"hidden",
                  textOverflow:"ellipsis",
                  maxWidth:"100%",
                }}
              >
                {post.content||"(no content)"}
              </div>
              <div className="post-meta">
                <span>{post.clientId}</span>
                {post.scheduledAt && <span>{new Date(post.scheduledAt).toLocaleString()}</span>}
                <span>{post.platforms.length} platform{post.platforms.length!==1?"s":""}</span>
              </div>
            </div>

            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:"auto"}}>
              <span className={`pill ${PILL[post.status]??"pill-draft"}`}>{post.status}</span>
              <button
                onClick={e=>{e.stopPropagation();deletePost(post);}}
                disabled={deleting===post.id}
                title="Delete post"
                style={{
                  width:28,height:28,borderRadius:"var(--radius-xs)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  background:"none",border:"1px solid var(--border)",
                  color:"var(--text-3)",cursor:"pointer",flexShrink:0,
                  transition:"all var(--t-fast) var(--ease)",
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--danger)";e.currentTarget.style.color="var(--danger)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-3)";}}
              >
                {deleting===post.id ? <span className="spinner" style={{width:12,height:12}}/> : <TrashIco/>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail / preview / edit modal */}
      {selected && (
        <div className="modal-backdrop" onClick={()=>setSelected(null)}>
          <div className="modal" style={{maxWidth:560,width:"96%"}} onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Post preview</span>
              <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-3)",fontSize:"1.1rem"}}
                onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
                {(editMode ? Array.from(editPlats) : selected.platforms).map(p=>(
                  <div key={p} style={{
                    width:28,height:28,borderRadius:8,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:"0.72rem",fontWeight:700,
                    background:PLATFORM_META[p as Platform]?.bg,
                    color:PLATFORM_META[p as Platform]?.color,
                  }}>
                    {PLATFORM_META[p as Platform]?.short}
                  </div>
                ))}
                <span className={`pill ${PILL[selected.status]??"pill-draft"}`}
                  style={{marginLeft:"auto"}}>{selected.status}</span>
              </div>

              {!editMode && (
                <div style={{
                  padding:"12px 14px",background:"var(--bg-input)",
                  borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",
                  fontSize:"0.88rem",lineHeight:1.75,color:"var(--text-1)",marginBottom:16,
                  maxHeight:220,overflowY:"auto",whiteSpace:"pre-wrap",wordBreak:"break-word",
                }}>
                  {selected.content}
                </div>
              )}

              {editMode && canEditSelected && (
                <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
                  <div>
                    <label className="form-label">Content</label>
                    <textarea className="textarea" style={{minHeight:120}} value={editContent}
                      onChange={e=>setEditContent(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Platforms</label>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {ALL_PLATFORMS.map(p=>{
                        const on = editPlats.has(p);
                        const m = PLATFORM_META[p];
                        return (
                          <button key={p} type="button" className={`plat-tab${on?" selected":""}`}
                            onClick={()=>toggleEditPlat(p)}
                            style={on ? {background:m.bg,borderColor:m.color,color:m.color} : {}}>
                            {on && "✓ "}{m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <label className="form-label">Schedule (local)</label>
                      <input type="datetime-local" className="input" value={editScheduledAt}
                        onChange={e=>setEditScheduledAt(e.target.value)} style={{colorScheme:"dark"}} />
                    </div>
                    <div>
                      <label className="form-label">Media URL</label>
                      <input type="url" className="input" value={editMediaUrl} onChange={e=>setEditMediaUrl(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Overrides (optional)</label>
                    <div style={{display:"grid",gap:8}}>
                      <input className="input" placeholder="LinkedIn" value={editLi} onChange={e=>setEditLi(e.target.value)} />
                      <input className="input" placeholder="X / Twitter" value={editX} onChange={e=>setEditX(e.target.value)} />
                      <input className="input" placeholder="Instagram" value={editIg} onChange={e=>setEditIg(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {!canEditSelected && (
                <p style={{fontSize:"0.78rem",color:"var(--text-3)",marginBottom:12}}>
                  Published and in-flight posts cannot be edited here.
                </p>
              )}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {([
                  ["Client",    selected.clientId],
                  ["Scheduled", selected.scheduledAt ? new Date(selected.scheduledAt).toLocaleString() : "—"],
                  ["Published", selected.publishedAt ? new Date(selected.publishedAt).toLocaleString() : "—"],
                  ["Error",     selected.errorMsg || "—"],
                ] as [string,string][]).map(([k,v])=>(
                  <div key={k} style={{
                    padding:"10px 12px",background:"var(--bg-input)",
                    borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",
                  }}>
                    <div style={{fontSize:"0.68rem",textTransform:"uppercase",letterSpacing:".06em",color:"var(--text-3)",marginBottom:3}}>{k}</div>
                    <div style={{fontSize:"0.85rem",fontWeight:500,
                      color:k==="Error"&&v!=="—"?"var(--danger)":"var(--text-1)"}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-foot" style={{gap:8,flexWrap:"wrap"}}>
              <button className="btn btn-danger btn-sm"
                disabled={deleting===selected.id}
                onClick={()=>deletePost(selected)}>
                <TrashIco/> Delete
              </button>
              {canEditSelected && !editMode && (
                <button className="btn btn-secondary btn-sm" type="button" onClick={()=>setEditMode(true)}>
                  Edit post
                </button>
              )}
              {canEditSelected && editMode && (
                <>
                  <button className="btn btn-secondary btn-sm" type="button" disabled={savingEdit}
                    onClick={()=>setEditMode(false)}>Cancel edit</button>
                  <button className="btn btn-primary btn-sm" type="button" disabled={savingEdit}
                    onClick={saveEdits}>
                    {savingEdit ? <><span className="spinner" style={{width:12,height:12,marginRight:6}}/>Saving…</> : "Save changes"}
                  </button>
                </>
              )}
              <div style={{flex:1,minWidth:8}}/>
              <button className="btn btn-secondary" onClick={()=>setSelected(null)}>Close</button>
              <button className="btn btn-primary"
                onClick={()=>{router.push("/dashboard/compose");setSelected(null);}}>
                Duplicate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ico={width:16,height:16,viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const};
function CalIco()     { return <svg {...ico} style={{width:20,height:20}}><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M14 2v4M6 2v4M2 8h16"/></svg>; }
function PlusIco()    { return <svg {...ico}><path d="M10 4v12M4 10h12"/></svg>; }
function TrashIco()   { return <svg {...ico}><path d="M4 6h12M8 6V4h4v2M7 6v10h6V6"/></svg>; }
function RefreshIco() { return <svg {...ico}><path d="M4 12a6 6 0 1 0 1-4M4 4v4h4"/></svg>; }