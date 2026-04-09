"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Post } from "@/types";

export default function TopicsPage() {
  const router  = useRouter();
  const [posts,   setPosts]   = useState<(Post & {rowIndex:number})[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting,setDeleting]= useState<string|null>(null);
  const [toast,   setToast]   = useState<{msg:string;ok:boolean}|null>(null);

  const load = useCallback(() => {
    fetch("/api/posts").then(r=>r.json()).then(res => {
      if (res.ok) {
        // Show only draft posts that came from the client (topic ideas)
        // [TOPIC IDEA] prefix or status === "draft"
        setPosts(res.data.filter((p:any) =>
          p.status === "draft" || p.content?.startsWith("[TOPIC IDEA]")
        ));
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg:string, ok:boolean) {
    setToast({msg,ok});
    setTimeout(()=>setToast(null), 3500);
  }

  async function deletePost(post: Post & {rowIndex:number}) {
    if (!window.confirm(`Delete this topic?\n"${post.content.substring(0,80)}"`) ) return;
    setDeleting(post.id);
    try {
      const res = await fetch("/api/posts/delete", {
        method:"DELETE", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ rowIndex: post.rowIndex }),
      }).then(r=>r.json());
      if (res.ok) { setPosts(p=>p.filter(x=>x.id!==post.id)); showToast("Deleted","true" as any); }
      else showToast(res.error||"Delete failed", false);
    } finally { setDeleting(null); }
  }

  async function promoteToPost(post: Post & {rowIndex:number}) {
    // Navigate to compose with the topic content pre-filled
    const params = new URLSearchParams({
      content:   post.content.replace(/^\[TOPIC IDEA\]\s*/,""),
      platforms: post.platforms.join(","),
      mediaUrl:  post.mediaUrl ?? "",
    });
    router.push(`/dashboard/compose?${params.toString()}`);
  }

  const PILL: Record<string,string> = {
    draft:"pill-draft", pending:"pill-pending",
    approved:"pill-approved", published:"pill-published",
    failed:"pill-failed",
  };

  return (
    <div>
      {toast && (
        <div style={{position:"fixed",bottom:24,right:24,zIndex:600,padding:"12px 20px",
          background:"var(--bg-card)",border:`1px solid ${toast.ok?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`,
          borderRadius:"var(--radius-md)",boxShadow:"var(--shadow-md)",
          fontSize:"0.85rem",fontWeight:500,color:toast.ok?"var(--success)":"var(--danger)"}}>
          {toast.msg}
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="page-title">Client topics &amp; ideas</h1>
          <p className="page-subtitle">
            Rows from your Google Sheet "Drafts" tab (submitted via client portal or Apps Script).
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
          <button className="btn btn-primary" onClick={()=>router.push("/dashboard/compose")}>
            New post
          </button>
        </div>
      </div>

      <div className="card" style={{overflow:"hidden"}}>
        {loading ? (
          <div style={{display:"flex",justifyContent:"center",padding:48}}>
            <div className="spinner spinner-lg"/>
          </div>
        ) : posts.length === 0 ? (
          <div style={{textAlign:"center",padding:64}}>
            <div style={{fontSize:"2rem",marginBottom:16}}>💡</div>
            <div style={{fontFamily:"var(--font-head)",fontWeight:600,fontSize:"0.95rem",
              color:"var(--text-1)",marginBottom:8}}>No topic rows yet</div>
            <p style={{fontSize:"0.82rem",color:"var(--text-3)",lineHeight:1.6,maxWidth:400,margin:"0 auto"}}>
              When clients submit topic ideas, they appear here.
              Ensure your sheet has a "Drafts" tab and Apps Script
              handles topic submissions.
            </p>
          </div>
        ) : (
          posts.map((post, i) => (
            <div key={post.id} style={{
              display:"flex",alignItems:"flex-start",gap:14,
              padding:"16px 20px",
              borderBottom: i < posts.length-1 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.88rem",lineHeight:1.7,color:"var(--text-1)",
                  marginBottom:8,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                  {post.content.replace(/^\[TOPIC IDEA\]\s*/,"")}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <span className={`pill ${PILL[post.status]??"pill-draft"}`}>{post.status}</span>
                  <span style={{fontSize:"0.72rem",color:"var(--text-3)"}}>{post.clientId}</span>
                  {post.platforms.map(p => (
                    <span key={p} style={{fontSize:"0.68rem",fontWeight:600,
                      padding:"2px 8px",borderRadius:20,
                      background:"var(--bg-input)",color:"var(--text-2)"}}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button className="btn btn-primary btn-sm" onClick={()=>promoteToPost(post)}>
                  Create post
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={deleting===post.id}
                  onClick={()=>deletePost(post)}
                  style={{color:"var(--danger)",borderColor:"rgba(239,68,68,0.25)"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--danger)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(239,68,68,0.25)";}}
                >
                  {deleting===post.id?<span className="spinner"/>:"Delete"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}