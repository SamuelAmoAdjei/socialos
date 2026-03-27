"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_META, type Platform, type Post, type PostStatus } from "@/types";

const FILTERS: { label:string; value:PostStatus|"all" }[] = [
  { label:"All Posts",   value:"all"       },
  { label:"Scheduled",   value:"scheduled" },
  { label:"Published",   value:"published" },
  { label:"Drafts",      value:"draft"     },
  { label:"Pending",     value:"approved"  },
  { label:"Failed",      value:"failed"    },
];

const PILL: Record<string,string> = {
  published:"pill-published", scheduled:"pill-scheduled",
  approved:"pill-approved",   publishing:"pill-publishing",
  partial:"pill-partial",     draft:"pill-draft", failed:"pill-failed",
};

export default function SchedulePage() {
  const router = useRouter();
  const [posts,    setPosts]    = useState<(Post & { rowIndex:number })[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<PostStatus|"all">("all");
  const [selected, setSelected] = useState<Post|null>(null);

  useEffect(() => {
    fetch("/api/posts")
      .then(r => r.json())
      .then(res => { if (res.ok) setPosts(res.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? posts : posts.filter(p => p.status === filter);

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="page-title">Post Queue</h1>
          <p className="page-subtitle">{posts.length} total posts across all clients</p>
        </div>
        <button className="btn btn-primary"
          onClick={() => router.push("/dashboard/compose")}>
          <PlusIco/> New Post
        </button>
      </div>

      {/* Filter pills */}
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {FILTERS.map(f => (
          <button key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding:"7px 16px", borderRadius:20,
              fontSize:"0.78rem", fontWeight:500,
              border:`1px solid ${filter===f.value?"var(--accent)":"var(--border)"}`,
              background: filter===f.value ? "var(--accent-dim)" : "var(--bg-input)",
              color: filter===f.value ? "var(--accent)" : "var(--text-2)",
              cursor:"pointer", fontFamily:"var(--font-body)",
              transition:"all var(--t-fast) var(--ease)",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Post list */}
      <div className="card" style={{overflow:"hidden"}}>
        {loading && (
          <div className="empty-state">
            <div className="spinner spinner-lg"/>
            <p style={{marginTop:16,color:"var(--text-3)",fontSize:"0.875rem"}}>Loading posts from your Google Sheet…</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <CalIco/>
            </div>
            <div className="empty-title">No posts yet</div>
            <p className="empty-desc">Create your first post to see it here.</p>
            <button className="btn btn-primary"
              onClick={() => router.push("/dashboard/compose")}>
              <PlusIco/> Compose a post
            </button>
          </div>
        )}
        {!loading && filtered.map((post,i) => (
          <div key={post.id} className="post-item"
            onClick={() => setSelected(post)}>
            <div className="plat-dots">
              {post.platforms.map(p => (
                <div key={p} className="plat-dot"
                  style={{background:PLATFORM_META[p as Platform]?.bg ?? "var(--bg-input)",color:PLATFORM_META[p as Platform]?.color ?? "var(--text-3)"}}>
                  {PLATFORM_META[p as Platform]?.short ?? p.substring(0,2).toUpperCase()}
                </div>
              ))}
            </div>
            <div className="post-body">
              <div className="post-preview">{post.content || "(no content)"}</div>
              <div className="post-meta">
                <span>{post.clientId}</span>
                {post.scheduledAt && <span>{new Date(post.scheduledAt).toLocaleString()}</span>}
                <span>{post.platforms.length} platform{post.platforms.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <span className={`pill ${PILL[post.status] ?? "pill-draft"}`}>{post.status}</span>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Post Details</span>
              <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-3)",fontSize:"1.1rem"}}
                onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
                {selected.platforms.map(p => (
                  <div key={p} style={{width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.72rem",fontWeight:700,background:PLATFORM_META[p as Platform]?.bg,color:PLATFORM_META[p as Platform]?.color}}>
                    {PLATFORM_META[p as Platform]?.short}
                  </div>
                ))}
                <span className={`pill ${PILL[selected.status] ?? "pill-draft"}`}
                  style={{marginLeft:"auto"}}>{selected.status}</span>
              </div>
              <p style={{fontSize:"0.88rem",lineHeight:1.7,marginBottom:16,color:"var(--text-1)"}}>{selected.content}</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {([["Client",selected.clientId],["Scheduled",selected.scheduledAt?new Date(selected.scheduledAt).toLocaleString():"—"],["Published",selected.publishedAt?new Date(selected.publishedAt).toLocaleString():"—"],["Error",selected.errorMsg||"—"]] as [string,string][]).map(([k,v]) => (
                  <div key={k} style={{padding:"10px 12px",background:"var(--bg-input)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)"}}>
                    <div style={{fontSize:"0.68rem",textTransform:"uppercase",letterSpacing:".06em",color:"var(--text-3)",marginBottom:3}}>{k}</div>
                    <div style={{fontSize:"0.85rem",fontWeight:500,color:k==="Error"&&v!=="—"?"var(--danger)":"var(--text-1)"}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => {router.push("/dashboard/compose");setSelected(null);}}>
                Duplicate Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ico = {width:18,height:18,viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const};
function CalIco()  { return <svg {...ico}><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M14 2v4M6 2v4M2 8h16"/></svg>; }
function PlusIco() { return <svg {...ico}><path d="M10 4v12M4 10h12"/></svg>; }
