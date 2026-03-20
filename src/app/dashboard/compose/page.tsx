"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CHAR_LIMITS, PLATFORM_META, type Platform } from "@/types";

const ALL_PLATFORMS: Platform[] = ["linkedin", "instagram", "facebook", "x", "tiktok"];

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "info" | "error" }[]>([]);
  const show = useCallback((msg: string, type: "success" | "info" | "error" = "info") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, show };
}

export default function ComposePage() {
  const router = useRouter();
  const { toasts, show: toast } = useToast();
  const [content, setContent] = useState("");
  const [liOverride, setLiOverride] = useState("");
  const [xOverride, setXOverride] = useState("");
  const [igOverride, setIgOverride] = useState("");
  const [selectedPlats, setSelectedPlats] = useState<Set<Platform>>(new Set<Platform>(["linkedin", "instagram", "facebook"]));
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [activePreview, setActivePreview] = useState<Platform>("linkedin");
  const [overridesOpen, setOverridesOpen] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const previewText = (p: Platform) => {
    if (p === "linkedin" && liOverride.trim()) return liOverride;
    if (p === "x" && xOverride.trim()) return xOverride;
    if (p === "instagram" && igOverride.trim()) return igOverride;
    return p === "x" ? content.substring(0, 280) : content;
  };

  const charCount = content.length;
  const xLeft = 280 - (xOverride || content.substring(0, 280)).length;

  function togglePlat(p: Platform) {
    setSelectedPlats(prev => { const n = new Set<Platform>(Array.from(prev)); n.has(p) ? n.delete(p) : n.add(p); return n; });
    setActivePreview(p);
  }
  function toggleOverride(k: string) {
    setOverridesOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  async function saveDraft() {
    if (!content.trim()) { toast("Write some content first", "error"); return; }
    setSubmitting(true);
    const res = await fetch("/api/posts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, liOverride, xOverride, igOverride, platforms: Array.from(selectedPlats), mediaUrl, scheduledAt, status: "draft" }),
    }).then(r => r.json());
    setSubmitting(false);
    res.ok ? toast("Draft saved to your Google Sheet", "success") : toast(res.error, "error");
  }

  async function publishNow() {
    if (!content.trim()) { toast("Write some content first", "error"); return; }
    if (selectedPlats.size === 0) { toast("Select at least one platform", "error"); return; }
    setSubmitting(true);
    const res = await fetch("/api/publish", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, liOverride, xOverride, igOverride, platforms: Array.from(selectedPlats), mediaUrl, scheduledAt: new Date().toISOString() }),
    }).then(r => r.json());
    setSubmitting(false);
    if (res.ok) { toast("Sent to Make.com — publishing in progress", "success"); setTimeout(() => router.push("/dashboard/schedule"), 1500); }
    else toast(res.error ?? "Publish failed", "error");
  }

  async function schedulePost() {
    if (!content.trim()) { toast("Write content first", "error"); return; }
    if (!scheduledAt) { toast("Pick a schedule time", "error"); return; }
    if (selectedPlats.size === 0) { toast("Select at least one platform", "error"); return; }
    setSubmitting(true);
    const res = await fetch("/api/posts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, liOverride, xOverride, igOverride, platforms: Array.from(selectedPlats), mediaUrl, scheduledAt, status: "approved" }),
    }).then(r => r.json());
    setSubmitting(false); setScheduleOpen(false);
    if (res.ok) { toast("Post scheduled successfully", "success"); setTimeout(() => router.push("/dashboard/schedule"), 1200); }
    else toast(res.error ?? "Schedule failed", "error");
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Toasts */}
      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 500, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} className="anim-toast" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--bg-glass)", backdropFilter: "blur(20px)", border: `1px solid ${t.type === "success" ? "rgba(6,214,160,0.3)" : t.type === "error" ? "rgba(255,77,109,0.3)" : "var(--border)"}`, borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)", minWidth: 260 }}>
            <div style={{ width: 26, height: 26, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", background: t.type === "success" ? "rgba(6,214,160,0.12)" : t.type === "error" ? "rgba(255,77,109,0.12)" : "rgba(79,142,247,0.12)", color: t.type === "success" ? "var(--accent2)" : t.type === "error" ? "var(--danger)" : "var(--accent)" }}>
              {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "i"}
            </div>
            <span style={{ fontSize: "0.82rem", fontWeight: 500 }}>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* Schedule modal */}
      {scheduleOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setScheduleOpen(false)}>
          <div className="anim-scale-in glass" style={{ width: 520, maxWidth: "96vw", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "22px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "1rem" }}>Schedule Post</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.1rem" }} onClick={() => setScheduleOpen(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ padding: "12px 14px", background: "var(--bg-input)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: "0.85rem", lineHeight: 1.5, marginBottom: 16, color: "var(--text-secondary)" }}>
                {(content || "No content yet").substring(0, 140)}{content.length > 140 ? "…" : ""}
              </div>
              <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Schedule time</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "0.85rem", colorScheme: "dark" }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {Array.from(selectedPlats).map(p => <span key={p} style={{ fontSize: "0.72rem", fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: PLATFORM_META[p].bg, color: PLATFORM_META[p].color }}>{PLATFORM_META[p].label}</span>)}
              </div>
              <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(79,142,247,0.06)", border: "1px solid rgba(79,142,247,0.18)", borderRadius: "var(--radius-sm)", fontSize: "0.77rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Post saved as "approved". Apps Script fires the Make.com webhook at the scheduled time.
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={{ padding: "10px 18px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "0.82rem", cursor: "pointer", fontFamily: "var(--font-body)" }} onClick={() => setScheduleOpen(false)}>Cancel</button>
              <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", background: "linear-gradient(135deg,var(--accent),#6B8FFF)", color: "white", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" }} disabled={submitting} onClick={schedulePost}>
                {submitting ? "…" : "Confirm Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 24, alignItems: "start" }}>

        {/* LEFT — Editor */}
        <div style={{ background: "var(--bg-card)", backdropFilter: "blur(16px)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: "1.1rem", fontWeight: 600, marginBottom: 4 }}>Compose Post</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>Select platforms, write content, add overrides, preview on every platform, then publish.</p>
          </div>

          {/* Platform selector */}
          <div style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Select Platforms</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {ALL_PLATFORMS.map(p => {
              const on = selectedPlats.has(p); const m = PLATFORM_META[p];
              return <button key={p} onClick={() => togglePlat(p)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 30, border: `1px solid ${on ? m.color : "var(--border)"}`, fontSize: "0.78rem", fontWeight: 500, color: on ? m.color : "var(--text-secondary)", background: on ? m.bg : "var(--bg-input)", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 0.2s" }}>
                {on && <span style={{ color: m.color }}>✓</span>}
                {m.label}
              </button>;
            })}
          </div>

          {/* Editor */}
          <div style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Content</div>
          <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "8px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderBottom: "none" }}>
              {["B", "I"].map(l => <button key={l} style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.75rem", cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", fontWeight: l === "B" ? 700 : 400, fontStyle: l === "I" ? "italic" : "normal" }}>{l}</button>)}
              <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
              <button style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.75rem", cursor: "pointer", background: "none", border: "none" }}>#</button>
              <button style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.75rem", cursor: "pointer", background: "none", border: "none" }}>@</button>
            </div>
            <textarea
              style={{ width: "100%", padding: 16, background: "var(--bg-input)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 var(--radius-md) var(--radius-md)", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: "0.88rem", lineHeight: 1.7, resize: "vertical" }}
              placeholder="Write your post content here. This text will be used across all selected platforms unless you set a platform-specific override below…"
              value={content} onChange={e => setContent(e.target.value)} rows={8}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px", marginBottom: 0 }}>
            <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: charCount > 2200 ? "var(--danger)" : charCount > 280 ? "var(--accent3)" : "var(--text-muted)" }}>{charCount} characters</span>
            <span style={{ display: "flex", gap: 10, fontSize: "0.7rem", color: "var(--text-muted)" }}><span>LI: 3,000</span><span>X: 280</span><span>IG: 2,200</span></span>
          </div>

          {/* Overrides */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Platform Overrides <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— optional</span></div>
            {[
              { key: "x",  label: "X / Twitter override",  badge: "X",  bc: "#888", bbg: "rgba(255,255,255,0.08)", info: `${xLeft} remaining`, danger: xLeft < 20, ph: "Shorter version for X (max 280 chars)…", val: xOverride, set: setXOverride, max: 280 },
              { key: "li", label: "LinkedIn override",      badge: "LI", bc: "#0077B5", bbg: "rgba(0,119,181,0.15)", info: "3,000 max", ph: "Extended version for LinkedIn with hashtags…", val: liOverride, set: setLiOverride },
              { key: "ig", label: "Instagram override",     badge: "IG", bc: "#E1306C", bbg: "rgba(225,48,108,0.12)", info: "2,200 max", ph: "Caption with hashtags…", val: igOverride, set: setIgOverride, max: 2200 },
            ].map(ov => (
              <div key={ov.key} style={{ marginBottom: 4 }}>
                <button onClick={() => toggleOverride(ov.key)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: overridesOpen.has(ov.key) ? "var(--radius-sm) var(--radius-sm) 0 0" : "var(--radius-sm)", cursor: "pointer", fontFamily: "var(--font-body)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: ov.bbg, color: ov.bc }}>{ov.badge}</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>{ov.label}</span>
                    <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: ov.danger ? "var(--danger)" : "var(--text-muted)" }}>{ov.info}</span>
                  </span>
                  <span style={{ color: "var(--text-muted)", transform: overridesOpen.has(ov.key) ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", display: "inline-block" }}>⌄</span>
                </button>
                {overridesOpen.has(ov.key) && (
                  <div style={{ padding: 10, border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 var(--radius-sm) var(--radius-sm)", marginBottom: 4 }}>
                    <textarea style={{ width: "100%", minHeight: 80, padding: 12, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: "0.82rem", lineHeight: 1.6, resize: "vertical" }} placeholder={ov.ph} value={ov.val} onChange={e => ov.set(e.target.value)} maxLength={ov.max} rows={4} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Media & Schedule */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Media &amp; Schedule</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input type="url" style={{ flex: 1, padding: "9px 14px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "0.8rem", minWidth: 120 }} placeholder="Media URL (Google Drive share link)…" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} />
              <input type="datetime-local" style={{ flex: 1, padding: "9px 14px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "0.8rem", minWidth: 160, colorScheme: "dark" }} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
            </div>
          </div>

          {/* CTA row */}
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <button disabled={submitting} onClick={saveDraft} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-body)" }}>
              Save Draft
            </button>
            <button disabled={submitting} onClick={() => { if (!content.trim()) { toast("Write content first", "error"); return; } if (!scheduledAt) { setScheduledAt(new Date(Date.now() + 3600000).toISOString().slice(0, 16)); } setScheduleOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-body)" }}>
              Schedule
            </button>
            <button disabled={submitting} onClick={publishNow} style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 22px", background: "linear-gradient(135deg,var(--accent),#6B8FFF)", color: "white", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)", boxShadow: "0 4px 16px rgba(79,142,247,0.35)" }}>
              {submitting ? "Publishing…" : "Publish Now"}
            </button>
          </div>
        </div>

        {/* RIGHT — Preview */}
        <div style={{ position: "sticky", top: 80 }}>
          <div style={{ background: "var(--bg-card)", backdropFilter: "blur(16px)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-head)", fontSize: "0.9rem", fontWeight: 600, marginBottom: 14 }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"><path d="M1 10s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z"/><circle cx="10" cy="10" r="3"/></svg>
              Live Platform Preview
            </div>

            {/* Tab strip */}
            <div style={{ display: "flex", gap: 3, marginBottom: 16, background: "var(--bg-input)", borderRadius: "var(--radius-sm)", padding: 3 }}>
              {ALL_PLATFORMS.map(p => <button key={p} onClick={() => setActivePreview(p)} style={{ flex: 1, padding: "6px 4px", textAlign: "center", fontSize: "0.72rem", fontWeight: 600, borderRadius: 6, cursor: "pointer", color: activePreview === p ? "var(--text-primary)" : "var(--text-muted)", background: activePreview === p ? "var(--bg-surface)" : "none", border: "none", fontFamily: "var(--font-body)", boxShadow: activePreview === p ? "0 1px 6px rgba(0,0,0,0.15)" : "none", transition: "all 0.15s" }}>{PLATFORM_META[p].short}</button>)}
            </div>

            {/* Preview card */}
            <PreviewCard platform={activePreview} text={previewText(activePreview)} mediaUrl={mediaUrl} />

            {/* Hint */}
            <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--bg-input)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              {{ linkedin: "LinkedIn — up to 3,000 characters. Supports articles and newsletters.", instagram: "Instagram — up to 2,200 characters. Image or video required for best reach.", facebook: "Facebook — up to 63,000 characters. Links and media supported.", x: "X (Twitter) — maximum 280 characters. Threads extend this limit.", tiktok: "TikTok — video required. 2,200 character caption. No URLs in captions." }[activePreview]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Preview Card ─────────────────────────────────────────────────────── */
function PreviewCard({ platform, text, mediaUrl }: { platform: Platform; text: string; mediaUrl: string }) {
  const empty = !text.trim();
  const ph = { color: "var(--text-muted)", fontStyle: "italic" as const, fontSize: "0.78rem" };
  const cardStyle = { border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-surface)", overflow: "hidden" };
  const hdr = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--border)" };
  const ava = (bg: string) => ({ width: 40, height: 40, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.82rem", color: "white", flexShrink: 0 });
  const name = { fontSize: "0.83rem", fontWeight: 600, color: "var(--text-primary)" };
  const meta = { fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2 };
  const textSty: React.CSSProperties = { fontSize: "0.82rem", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" };
  const mediaEl = (h = 80) => mediaUrl
    ? <div style={{ marginTop: 10, height: h, background: "rgba(79,142,247,0.08)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontSize: "0.78rem" }}>Media attached</div>
    : <div style={{ marginTop: 10, height: h, background: "var(--bg-input)", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.78rem" }}>No media</div>;
  const actions = (items: string[], accent?: string) => (
    <div style={{ display: "flex", borderTop: "1px solid var(--border)", padding: "4px 14px" }}>
      {items.map(a => <span key={a} style={{ flex: 1, textAlign: "center", fontSize: "0.72rem", fontWeight: 500, color: accent && a === items[0] ? accent : "var(--text-muted)", padding: "6px 0" }}>{a}</span>)}
    </div>
  );

  if (platform === "linkedin") return <div style={cardStyle}>
    <div style={hdr}><div style={ava("linear-gradient(135deg,#0077B5,#00A0DC)")}>AC</div><div><div style={name}>Acme Corp</div><div style={meta}>Company Page · Just now</div></div></div>
    <div style={{ padding: "12px 14px" }}><div style={{ ...textSty, ...(empty ? ph : {}) }}>{empty ? "Your post content will appear here as you type…" : text}</div>{mediaEl(90)}</div>
    {actions(["Like", "Comment", "Share"], "#0077B5")}
  </div>;

  if (platform === "instagram") return <div style={cardStyle}>
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px" }}>
      <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)", padding: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "2px solid var(--bg-surface)", background: "linear-gradient(135deg,#833AB4,#FD1D1D,#F77737)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.78rem", color: "white" }}>AC</div>
      </div>
      <div><div style={name}>acmecorp</div><div style={meta}>Sponsored</div></div>
      <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>···</span>
    </div>
    <div style={{ height: 200, background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.78rem" }}>Image or video</div>
    <div style={{ padding: "10px 14px", fontSize: "0.8rem", lineHeight: 1.5 }}><strong>acmecorp </strong><span style={empty ? ph : {}}>{empty ? "Caption appears here…" : text}</span></div>
  </div>;

  if (platform === "x") return <div style={cardStyle}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
      <div style={ava("linear-gradient(135deg,#333,#555)")}>AC</div>
      <div><div style={{ ...name, display: "flex", alignItems: "center", gap: 4 }}>Acme Corp <span style={{ color: "var(--accent)", fontSize: "0.75rem" }}>✓</span></div><div style={meta}>@acmecorp · now</div></div>
      <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>···</span>
    </div>
    <div style={{ padding: "4px 14px 8px" }}>
      <div style={{ ...textSty, fontSize: "0.88rem", ...(empty ? ph : {}) }}>{empty ? "Tweet text (max 280 chars)…" : text.substring(0, 280)}</div>
      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 8 }}>{280 - (empty ? 0 : text.length)} chars remaining</div>
    </div>
    {actions(["Reply", "Repost", "Like"])}
  </div>;

  if (platform === "facebook") return <div style={cardStyle}>
    <div style={hdr}><div style={ava("linear-gradient(135deg,#1877F2,#42A5F5)")}>AC</div><div><div style={name}>Acme Corp</div><div style={meta}>Just now · Public</div></div></div>
    <div style={{ padding: "12px 14px" }}><div style={{ ...textSty, ...(empty ? ph : {}) }}>{empty ? "Your Facebook post will appear here…" : text}</div>{mediaEl(90)}</div>
    {actions(["Like", "Comment", "Share"], "#1877F2")}
  </div>;

  // TikTok
  return <div style={cardStyle}>
    <div style={{ height: 260, background: "linear-gradient(160deg,#0A0A0A 60%,#1A0A2A)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <svg width="36" height="36" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round"><polygon points="5 3 19 10 5 17 5 3"/></svg>
      <div style={{ position: "absolute", bottom: 12, left: 12, right: 50 }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 5 }}>@acmecorp</div>
        <div style={{ fontSize: "0.72rem", color: empty ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.75)", lineHeight: 1.5, fontStyle: empty ? "italic" as const : "normal" }}>
          {empty ? "Caption here (no URLs)…" : text.substring(0, 150)}
        </div>
      </div>
      <div style={{ position: "absolute", right: 10, bottom: 30, display: "flex", flexDirection: "column", gap: 14 }}>
        {[0, 1].map(i => <div key={i} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.25)" }} />)}
      </div>
    </div>
  </div>;
}
