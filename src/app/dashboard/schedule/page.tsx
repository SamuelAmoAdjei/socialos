"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_META, type Platform, type Post, type PostStatus } from "@/types";

const STATUS_STYLES: Record<PostStatus, React.CSSProperties> = {
  published:  { background: "rgba(6,214,160,0.12)",   color: "var(--accent2)" },
  scheduled:  { background: "rgba(79,142,247,0.12)",  color: "var(--accent)" },
  approved:   { background: "rgba(79,142,247,0.08)",  color: "var(--accent)" },
  publishing: { background: "rgba(247,201,72,0.12)",  color: "var(--accent3)" },
  partial:    { background: "rgba(247,201,72,0.12)",  color: "var(--accent3)" },
  draft:      { background: "rgba(255,255,255,0.07)", color: "var(--text-muted)" },
  failed:     { background: "rgba(255,77,109,0.12)",  color: "var(--danger)" },
};

const FILTERS: { label: string; value: PostStatus | "all" }[] = [
  { label: "All Posts", value: "all" },
  { label: "Scheduled",  value: "scheduled" },
  { label: "Published",  value: "published" },
  { label: "Drafts",     value: "draft" },
  { label: "Pending",    value: "approved" },
  { label: "Failed",     value: "failed" },
];

export default function SchedulePage() {
  const router = useRouter();
  const [posts, setPosts]   = useState<(Post & { rowIndex: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PostStatus | "all">("all");
  const [selected, setSelected] = useState<Post | null>(null);

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: "1.1rem", fontWeight: 600, marginBottom: 3 }}>Post Queue</h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{posts.length} total posts across all clients</p>
        </div>
        <button onClick={() => router.push("/dashboard/compose")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "linear-gradient(135deg,var(--accent),#6B8FFF)", color: "white", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)", boxShadow: "0 4px 16px rgba(79,142,247,0.3)" }}>
          + New Post
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{ padding: "7px 16px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 500, border: `1px solid ${filter === f.value ? "var(--accent)" : "var(--border)"}`, background: filter === f.value ? "rgba(79,142,247,0.12)" : "var(--bg-input)", color: filter === f.value ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 0.15s" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Post list */}
      <div style={{ background: "var(--bg-card)", backdropFilter: "blur(16px)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        {loading && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Loading posts from your Google Sheet…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>No posts yet</div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 20 }}>Create your first post to see it here.</p>
            <button onClick={() => router.push("/dashboard/compose")} style={{ padding: "9px 20px", background: "linear-gradient(135deg,var(--accent),#6B8FFF)", color: "white", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" }}>Compose a post</button>
          </div>
        )}
        {!loading && filtered.map((post, i) => (
          <div key={post.id} onClick={() => setSelected(post)} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 18px", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "")}>
            {/* Platform dots */}
            <div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 2 }}>
              {post.platforms.map(p => (
                <div key={p} style={{ width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 700, background: PLATFORM_META[p]?.bg ?? "var(--bg-input)", color: PLATFORM_META[p]?.color ?? "var(--text-muted)" }}>
                  {PLATFORM_META[p]?.short ?? p}
                </div>
              ))}
            </div>
            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.83rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{post.content || "(no content)"}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", gap: 10 }}>
                <span>{post.clientId}</span>
                {post.scheduledAt && <span>{new Date(post.scheduledAt).toLocaleString()}</span>}
                {post.platforms.length > 0 && <span>{post.platforms.length} platform{post.platforms.length > 1 ? "s" : ""}</span>}
              </div>
            </div>
            {/* Status pill */}
            <div style={{ fontSize: "0.68rem", fontWeight: 600, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0, textTransform: "capitalize", ...STATUS_STYLES[post.status] ?? {} }}>
              {post.status}
            </div>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setSelected(null)}>
          <div className="anim-scale-in glass" style={{ width: 540, maxWidth: "96vw", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "22px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "1rem" }}>Post Details</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.1rem" }} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                {selected.platforms.map(p => <div key={p} style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, background: PLATFORM_META[p]?.bg, color: PLATFORM_META[p]?.color }}>{PLATFORM_META[p]?.short}</div>)}
                <div style={{ marginLeft: "auto", fontSize: "0.68rem", fontWeight: 600, padding: "3px 9px", borderRadius: 20, textTransform: "capitalize", ...STATUS_STYLES[selected.status] ?? {} }}>{selected.status}</div>
              </div>
              <p style={{ fontSize: "0.88rem", lineHeight: 1.7, marginBottom: 16, color: "var(--text-primary)" }}>{selected.content}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["Client", selected.clientId], ["Scheduled", selected.scheduledAt ? new Date(selected.scheduledAt).toLocaleString() : "—"], ["Published", selected.publishedAt ? new Date(selected.publishedAt).toLocaleString() : "—"], ["Error", selected.errorMsg || "—"]].map(([k, v]) => (
                  <div key={k as string} style={{ padding: "10px 12px", background: "var(--bg-input)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted)", marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 500, color: k === "Error" && v !== "—" ? "var(--danger)" : "var(--text-primary)" }}>{v as string}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={{ padding: "10px 18px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "0.82rem", cursor: "pointer", fontFamily: "var(--font-body)" }} onClick={() => setSelected(null)}>Close</button>
              <button style={{ padding: "10px 20px", background: "linear-gradient(135deg,var(--accent),#6B8FFF)", color: "white", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" }} onClick={() => { router.push("/dashboard/compose"); setSelected(null); }}>Duplicate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
