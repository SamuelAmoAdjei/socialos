"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PLATFORM_META, CHAR_LIMITS, type Platform } from "@/types";

const ALL_PLATFORMS: Platform[] = ["linkedin","instagram","facebook","x","tiktok"];

type ToastType = "success"|"info"|"error"|"warn";
function useToast() {
  const [toasts, setToasts] = useState<{id:number;msg:string;type:ToastType}[]>([]);
  const show = useCallback((msg:string, type:ToastType="info") => {
    const id = Date.now();
    setToasts(t => [...t,{id,msg,type}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000);
  },[]);
  return { toasts, show };
}

export default function ComposePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toasts, show:toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [content,       setContent]       = useState("");
  const [liOverride,    setLiOverride]     = useState("");
  const [xOverride,     setXOverride]      = useState("");
  const [igOverride,    setIgOverride]     = useState("");
  const [selectedPlats, setSelectedPlats]  = useState<Set<Platform>>(new Set<Platform>(["linkedin","instagram","facebook"]));
  const [mediaUrl,      setMediaUrl]       = useState("");
  const [scheduledAt,   setScheduledAt]    = useState("");
  const [activePreview, setActivePreview]  = useState<Platform>("linkedin");
  const [overridesOpen, setOverridesOpen]  = useState<Set<string>>(new Set());
  const [submitting,    setSubmitting]     = useState(false);
  const [scheduleModal, setScheduleModal]  = useState(false);
  const [publishedPostId,setPublishedPostId]= useState<string|null>(null);
  const [postStatus,    setPostStatus]     = useState<string|null>(null);
  const [uploadingMedia,setUploadingMedia] = useState(false);

  // Status polling after Publish Now
  useEffect(() => {
    if (!publishedPostId) return;
    let attempts = 0;
    const id = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch("/api/posts").then(r=>r.json());
        if (res.ok) {
          const post = (res.data as any[]).find(p => p.id === publishedPostId);
          if (post) {
            setPostStatus(post.status);
            if (["published","failed","partial"].includes(post.status)) {
              clearInterval(id);
              if (post.status === "published")
                toast("✓ Post published successfully!","success");
              else if (post.status === "failed")
                toast(`✗ Post failed: ${post.errorMsg || "Check Make.com history"}`, "error");
              else
                toast("⚠ Partially published — some platforms failed. Check Schedule.","warn");
            }
          }
        }
      } catch {}
      if (attempts >= 18) clearInterval(id); // stop after 3 min
    }, 10_000);
    return () => clearInterval(id);
  }, [publishedPostId, toast]);

  // ── Formatting tools ──────────────────────────────────────────────────────
  // Works by inserting/wrapping text at the cursor position in the textarea.
  // Content is plain text — formatting characters are preserved exactly as typed.
  function insertAtCursor(before: string, after = "", placeholder = "") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const selected = el.value.substring(start, end);
    const insert = selected ? `${before}${selected}${after}` : `${before}${placeholder}${after}`;
    const newVal = el.value.substring(0, start) + insert + el.value.substring(end);
    setContent(newVal);
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      el.focus();
      const cursorPos = start + before.length + (selected || placeholder).length;
      el.setSelectionRange(cursorPos, cursorPos);
    });
  }

  function insertHashtag() {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    // If there's no space before, add one
    const before = pos > 0 && el.value[pos-1] !== " " && el.value[pos-1] !== "\n" ? " #" : "#";
    insertAtCursor(before, "", "hashtag");
  }

  function insertMention() {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const before = pos > 0 && el.value[pos-1] !== " " && el.value[pos-1] !== "\n" ? " @" : "@";
    insertAtCursor(before, "", "name");
  }

  function insertNewLine() {
    insertAtCursor("\n");
  }

  // ── Platform helpers ──────────────────────────────────────────────────────
  function togglePlat(p: Platform) {
    setSelectedPlats(prev => {
      const n = new Set<Platform>(Array.from(prev));
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });
    setActivePreview(p);
  }

  function toggleOverride(k: string) {
    setOverridesOpen(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  function previewText(p: Platform) {
    if (p === "linkedin"  && liOverride.trim()) return liOverride;
    if (p === "x"         && xOverride.trim())  return xOverride;
    if (p === "instagram" && igOverride.trim()) return igOverride;
    return p === "x" ? content.substring(0,280) : content;
  }

  const igNeedsImage = selectedPlats.has("instagram") && !mediaUrl.trim();

  function validateInstagram(): boolean {
    if (igNeedsImage) {
      toast("⚠ Instagram requires a media URL. Add an image/video link or remove Instagram.", "warn");
      return false;
    }
    return true;
  }

  // ── Save draft ────────────────────────────────────────────────────────────
  // Helper — always use the client NAME as clientId for readability in the Sheet
  function getClientId(): string {
    if (typeof window === "undefined") return "client";
    return (
      localStorage.getItem("sos-active-client-id")   ||
      localStorage.getItem("sos-active-client-name") ||
      "client"
    );
  }

  async function saveDraft() {
    if (!content.trim()) { toast("Write some content first","error"); return; }
    setSubmitting(true);
    try {
      const res  = await fetch("/api/posts", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          content,
          liOverride:  liOverride  || undefined,
          xOverride:   xOverride   || undefined,
          igOverride:  igOverride  || undefined,
          platforms:   Array.from(selectedPlats),
          mediaUrl:    mediaUrl.trim() || undefined,
          scheduledAt: scheduledAt || undefined,
          status:      "draft",
          clientId:    getClientId(),
        }),
      });

      // Guard against non-JSON responses (session expired, server error)
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {
        if (res.status === 401) {
          toast("✗ Session expired — please sign out and sign back in","error");
        } else {
          toast(`✗ Server error ${res.status} — check Vercel logs`,"error");
        }
        return;
      }

      if (res.ok && data.ok) {
        toast(`✓ Draft saved to your Google Sheet (${data.data?.id?.slice(-8)})`, "success");
      } else {
        toast(`✗ Save failed: ${data.error || "Unknown — check GOOGLE_SHEETS_ID and sign in again"}`, "error");
      }
    } catch (e: any) {
      toast(`✗ Network error: ${e.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadMediaFile(file: File) {
    setUploadingMedia(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.ok && data.data?.url) {
        setMediaUrl(data.data.url);
        toast(`✓ Uploaded: ${file.name}`, "success");
      } else {
        toast(`✗ Upload failed: ${data.error || "Unknown error"}`, "error");
      }
    } catch (e: any) {
      toast(`✗ Upload error: ${e.message}`, "error");
    } finally {
      setUploadingMedia(false);
    }
  }

  // ── Schedule ──────────────────────────────────────────────────────────────
  async function schedulePost() {
    if (!content.trim())         { toast("Write content first","error"); return; }
    if (!scheduledAt)            { toast("Pick a schedule time","error"); return; }
    if (selectedPlats.size === 0){ toast("Select at least one platform","error"); return; }
    if (!validateInstagram())    return;

    setSubmitting(true);
    try {
      const body = {
        content,
        liOverride: liOverride || undefined,
        xOverride:  xOverride  || undefined,
        igOverride: igOverride || undefined,
        platforms:  Array.from(selectedPlats),
        mediaUrl:   mediaUrl.trim() || undefined,
        scheduledAt,
        status:     "approved",
        clientId:   getClientId(),
      };
      const res  = await fetch("/api/posts", {
        method:  "POST",
        headers: { "Content-Type":"application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        const savedStatus = data?.data?.status;
        if (savedStatus === "pending") {
          toast("✓ Sent to client approval queue. It will publish only after client approval.", "success");
        } else {
          toast(`✓ Post scheduled for ${new Date(scheduledAt).toLocaleString()} — Apps Script will fire it automatically`, "success");
        }
        setScheduleModal(false);
        // Reset form
        setContent(""); setMediaUrl(""); setScheduledAt("");
        setLiOverride(""); setXOverride(""); setIgOverride("");
        setTimeout(() => router.push("/dashboard/schedule"), 2000);
      } else {
        const errMsg = data.error || "Unknown error";
        toast(`✗ Schedule failed: ${errMsg}`, "error");
        // Keep modal open so user sees the error
      }
    } catch (e: any) {
      toast(`✗ Network error: ${e.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Publish now ───────────────────────────────────────────────────────────
  async function publishNow() {
    if (!content.trim())         { toast("Write some content first","error"); return; }
    if (selectedPlats.size === 0){ toast("Select at least one platform","error"); return; }
    if (!validateInstagram())    return;

    setSubmitting(true);
    setPublishedPostId(null);
    setPostStatus(null);

    try {
      const platforms = Array.from(selectedPlats);
      const res  = await fetch("/api/publish", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          liOverride: liOverride || undefined,
          xOverride:  xOverride  || undefined,
          igOverride: igOverride || undefined,
          platforms,
          mediaUrl:   mediaUrl.trim() || null,
          scheduledAt: new Date().toISOString(),
          clientId:   getClientId(),
        }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setPublishedPostId(data.data.id);
        setPostStatus("publishing");
        const platNames = platforms.map(p => PLATFORM_META[p]?.label || p).join(", ");
        toast(`Sent to Make.com → ${platNames}. Checking status every 10s…`, "info");
      } else {
        toast(`✗ Publish failed: ${data.error || "Unknown error"}`, "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const charCount = content.length;
  const xLeft     = 280 - (xOverride || content).substring(0,280).length;

  return (
    <div style={{position:"relative"}}>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast anim-fade-up">
            <div className="toast-icon" style={{
              background: t.type==="success"?"var(--success-dim)":t.type==="error"?"var(--danger-dim)":t.type==="warn"?"var(--gold-dim)":"var(--blue-dim)",
              color:      t.type==="success"?"var(--success)":t.type==="error"?"var(--danger)":t.type==="warn"?"var(--gold)":"var(--blue)",
            }}>
              {t.type==="success"?<CheckIco/>:t.type==="error"?<XSmIco/>:t.type==="warn"?<WarnIco/>:<InfoIco/>}
            </div>
            <span className="toast-msg">{t.msg}</span>
          </div>
        ))}
      </div>

      {/* Publishing status bar */}
      {postStatus && !["published","failed","partial"].includes(postStatus) && (
        <div style={{
          marginBottom:16,padding:"12px 16px",
          background:"var(--blue-dim)",border:"1px solid rgba(79,142,247,0.25)",
          borderRadius:"var(--radius-sm)",
          display:"flex",alignItems:"center",gap:12,fontSize:"0.85rem",
        }}>
          <span className="spinner"/>
          <span style={{color:"var(--text-1)",flex:1}}>
            Publishing in progress — status: <strong style={{color:"var(--blue)"}}>{postStatus}</strong>.
            You will be notified when complete.
          </span>
          <button className="btn btn-secondary btn-sm" onClick={()=>router.push("/dashboard/schedule")}>
            View in Schedule
          </button>
        </div>
      )}

      {/* Schedule modal */}
      {scheduleModal && (
        <div className="modal-backdrop" onClick={()=>setScheduleModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">Confirm Schedule</span>
              <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-3)",fontSize:"1.1rem"}}
                onClick={()=>setScheduleModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Show error toasts inside modal */}
              {toasts.filter(t=>t.type==="error").map(t=>(
                <div key={t.id} style={{padding:"10px 12px",background:"var(--danger-dim)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:"var(--radius-sm)",fontSize:"0.82rem",color:"var(--danger)",marginBottom:14}}>
                  {t.msg}
                </div>
              ))}

              <div style={{padding:"12px 14px",background:"var(--bg-input)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",fontSize:"0.85rem",lineHeight:1.6,marginBottom:16,color:"var(--text-2)",whiteSpace:"pre-wrap",maxHeight:120,overflow:"auto"}}>
                {(content||"No content yet").substring(0,200)}{content.length>200?"…":""}
              </div>

              <div className="form-group">
                <label className="form-label">Schedule time</label>
                <input type="datetime-local" className="input" value={scheduledAt}
                  onChange={e=>setScheduledAt(e.target.value)}
                  style={{colorScheme:"dark"}}/>
              </div>

              {igNeedsImage && (
                <div style={{padding:"10px 12px",background:"var(--gold-dim)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:"var(--radius-sm)",fontSize:"0.82rem",color:"var(--gold)",marginBottom:14}}>
                  ⚠ Instagram selected but no media URL. Instagram requires an image/video.
                </div>
              )}

              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
                {Array.from(selectedPlats).map(p=>(
                  <span key={p} style={{fontSize:"0.72rem",fontWeight:600,padding:"3px 10px",borderRadius:20,background:PLATFORM_META[p].bg,color:PLATFORM_META[p].color}}>
                    {PLATFORM_META[p].label}
                  </span>
                ))}
              </div>

              <div style={{padding:"10px 12px",background:"var(--accent-dim)",border:"1px solid rgba(0,194,168,0.20)",borderRadius:"var(--radius-sm)",fontSize:"0.78rem",color:"var(--text-2)",lineHeight:1.6}}>
                Schedule respects client approval mode. If approval is required, this goes to the client portal first as "pending".
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" disabled={submitting} onClick={()=>setScheduleModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={submitting} onClick={schedulePost}>
                {submitting ? <><span className="spinner" style={{marginRight:6}}/>Saving…</> : <><CalIco/> Confirm Schedule</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="compose-layout">

        {/* LEFT — Editor */}
        <div className="card card-pad">
          <div style={{marginBottom:20}}>
            <h2 style={{fontFamily:"var(--font-head)",fontSize:"1.05rem",fontWeight:600,marginBottom:4,color:"var(--text-1)"}}>
              Compose Post
            </h2>
            <p style={{fontSize:"0.8rem",color:"var(--text-2)"}}>
              Your content is sent to platforms exactly as written — all spaces, line breaks, hashtags and mentions are preserved.
            </p>
          </div>

          {/* Platform selector */}
          <div className="section-label" style={{marginBottom:8}}>Select Platforms</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
            {ALL_PLATFORMS.map(p => {
              const on = selectedPlats.has(p);
              const m  = PLATFORM_META[p];
              return (
                <button key={p} className={`plat-tab${on?" selected":""}`}
                  onClick={() => togglePlat(p)}
                  style={on ? {background:m.bg,borderColor:m.color,color:m.color} : {}}>
                  {on && "✓ "}{m.label}
                </button>
              );
            })}
          </div>

          {/* Instagram warning */}
          {igNeedsImage && (
            <div style={{padding:"10px 12px",background:"var(--gold-dim)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:"var(--radius-sm)",fontSize:"0.78rem",color:"var(--gold)",marginBottom:14,lineHeight:1.6}}>
              ⚠ Instagram is selected but no media URL is provided. Instagram's API requires an image or video.
            </div>
          )}

          {/* Editor */}
          <div className="section-label" style={{marginBottom:8}}>Content</div>
          <div style={{borderRadius:"var(--radius-sm)",overflow:"hidden",marginBottom:6,border:"1px solid var(--border)"}}>
            {/* Formatting toolbar — all buttons actually work */}
            <div className="editor-toolbar" style={{borderBottom:"1px solid var(--border)"}}>
              <button className="tool-btn" title="Bold — wraps selected text in **bold**"
                style={{fontWeight:700}}
                onClick={() => insertAtCursor("**","**","bold text")}>
                B
              </button>
              <button className="tool-btn" title="Italic — wraps selected text in _italic_"
                style={{fontStyle:"italic"}}
                onClick={() => insertAtCursor("_","_","italic text")}>
                I
              </button>
              <div className="tool-sep"/>
              <button className="tool-btn" title="New line break"
                onClick={insertNewLine}>
                ↵
              </button>
              <button className="tool-btn" title="Insert hashtag"
                onClick={insertHashtag}>
                #
              </button>
              <button className="tool-btn" title="Insert mention"
                onClick={insertMention}>
                @
              </button>
              <div className="tool-sep"/>
              <button className="tool-btn" title="Bullet point"
                onClick={() => insertAtCursor("\n• ","","item")}>
                •
              </button>
              <button className="tool-btn" title="Numbered list"
                onClick={() => insertAtCursor("\n1. ","","item")}>
                1.
              </button>
              <div className="tool-sep"/>
              <span style={{marginLeft:"auto",fontSize:"0.68rem",color:"var(--text-3)",padding:"0 8px",lineHeight:"28px"}}>
                Tip: select text then click a tool to wrap it
              </span>
            </div>
            <textarea
              ref={textareaRef}
              className="textarea"
              style={{
                borderRadius:0,minHeight:180,border:"none",
                fontFamily:"var(--font-body)",fontSize:"0.9rem",lineHeight:1.7,
                resize:"vertical",
              }}
              placeholder={"Write your post here...\n\nUse the toolbar above to format.\nAll spacing, line breaks, #hashtags and @mentions are preserved exactly.\n\nLinkedIn tip: paste content formatted with LinkedIn's own editor for rich formatting."}
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
            />
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,padding:"0 2px"}}>
            <span className={`char-count${charCount>2200?" char-over":charCount>280?" char-warn":""}`}>
              {charCount.toLocaleString()} characters
            </span>
            <span style={{display:"flex",gap:10,fontSize:"0.70rem",color:"var(--text-3)"}}>
              <span>LI: {CHAR_LIMITS.linkedin.toLocaleString()}</span>
              <span>X: {CHAR_LIMITS.x}</span>
              <span>IG: {CHAR_LIMITS.instagram.toLocaleString()}</span>
            </span>
          </div>

          {/* Platform overrides */}
          <div className="section-label" style={{marginBottom:8}}>
            Platform Overrides
            <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:"var(--text-3)",marginLeft:6}}>— optional, use for platform-specific versions</span>
          </div>

          {[
            { key:"x",  label:"X / Twitter override", badge:"X",  bc:"#888",    bbg:"rgba(255,255,255,0.08)", info:`${xLeft} remaining`, danger:xLeft<20, ph:"Shorter version for X (max 280)…", val:xOverride,  set:setXOverride,  max:280  },
            { key:"li", label:"LinkedIn override",     badge:"LI", bc:"#0077B5", bbg:"rgba(0,119,181,0.15)",  info:"3,000 max",            ph:"Extended version with hashtags…",  val:liOverride, set:setLiOverride        },
            { key:"ig", label:"Instagram override",    badge:"IG", bc:"#E1306C", bbg:"rgba(225,48,108,0.12)", info:"2,200 max",            ph:"Caption with hashtags…",            val:igOverride, set:setIgOverride, max:2200 },
          ].map(ov => {
            const open = overridesOpen.has(ov.key);
            return (
              <div key={ov.key} style={{marginBottom:4}}>
                <button className={`override-header ${open?"open":"closed"}`}
                  onClick={() => toggleOverride(ov.key)}>
                  <span style={{display:"flex",alignItems:"center",gap:10}}>
                    <span className="plat-badge" style={{background:ov.bbg,color:ov.bc}}>{ov.badge}</span>
                    <span style={{fontSize:"0.82rem",fontWeight:500,color:"var(--text-1)"}}>{ov.label}</span>
                    <span style={{fontSize:"0.70rem",fontFamily:"var(--font-mono)",color:ov.danger?"var(--danger)":"var(--text-3)"}}>{ov.info}</span>
                  </span>
                  <span style={{color:"var(--text-3)",transform:open?"rotate(180deg)":"rotate(0)",transition:"transform 0.2s",display:"inline-block"}}>⌄</span>
                </button>
                {open && (
                  <div className="override-body">
                    <textarea className="textarea"
                      style={{minHeight:80,fontSize:"0.82rem",borderRadius:"var(--radius-xs)"}}
                      placeholder={ov.ph}
                      value={ov.val}
                      onChange={e => ov.set(e.target.value)}
                      maxLength={ov.max}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Media & Schedule */}
          <div className="section-label" style={{marginTop:20,marginBottom:8}}>
            Media &amp; Schedule
            {selectedPlats.has("instagram") && (
              <span style={{color:"var(--danger)",fontWeight:400,textTransform:"none",letterSpacing:0,marginLeft:8,fontSize:"0.72rem"}}>
                * Media URL required for Instagram
              </span>
            )}
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
            <input type="url" className="input"
              style={{flex:1,minWidth:180,borderColor:igNeedsImage?"var(--gold)":"var(--border)"}}
              placeholder="Media URL (or upload a file below)"
              value={mediaUrl}
              onChange={e => setMediaUrl(e.target.value)}/>
            <input type="datetime-local" className="input"
              style={{flex:"0 0 220px",colorScheme:"dark"}}
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,flexWrap:"wrap"}}>
            <label className="btn btn-secondary btn-sm" style={{cursor: uploadingMedia ? "not-allowed" : "pointer", opacity: uploadingMedia ? 0.7 : 1}}>
              {uploadingMedia ? <><span className="spinner" style={{marginRight:6}}/>Uploading…</> : "Upload image/video"}
              <input
                type="file"
                accept="image/*,video/*"
                disabled={uploadingMedia}
                style={{display:"none"}}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMediaFile(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <span style={{fontSize:"0.72rem",color:"var(--text-3)"}}>
              Uploaded files become shareable links automatically.
            </span>
          </div>

          {/* Action buttons */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button className="btn btn-secondary" disabled={submitting} onClick={saveDraft}>
              <SaveIco/> Save Draft
            </button>
            <button className="btn btn-secondary" disabled={submitting} onClick={() => {
              if (!content.trim()) { toast("Write content first","error"); return; }
              if (!scheduledAt) {
                const oneHour = new Date(Date.now()+3600000).toISOString().slice(0,16);
                setScheduledAt(oneHour);
              }
              setScheduleModal(true);
            }}>
              <CalIco/> Schedule
            </button>
            <button className="btn btn-primary" style={{flex:1}} disabled={submitting||postStatus==="publishing"}
              onClick={publishNow}>
              {submitting ? <span className="spinner"/> : <SendIco/>}
              {postStatus === "publishing" ? "Publishing…" : "Publish Now"}
            </button>
          </div>
        </div>

        {/* RIGHT — Live preview */}
        <div style={{position:"sticky",top:"calc(var(--topbar-h) + 16px)"}}>
          <div className="card card-pad">
            <div style={{display:"flex",alignItems:"center",gap:8,fontFamily:"var(--font-head)",fontSize:"0.9rem",fontWeight:600,marginBottom:14}}>
              <EyeIco/> Live Platform Preview
            </div>

            <div className="preview-tabs">
              {ALL_PLATFORMS.map(p => (
                <button key={p} className={`prev-tab${activePreview===p?" active":""}`}
                  onClick={() => setActivePreview(p)}>
                  {PLATFORM_META[p].short}
                  {p==="instagram"&&igNeedsImage&&<span style={{color:"var(--gold)"}}>!</span>}
                </button>
              ))}
            </div>

            <PreviewCard platform={activePreview} text={previewText(activePreview)} mediaUrl={mediaUrl}/>

            <div style={{marginTop:10,padding:"8px 10px",background:"var(--bg-input)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",fontSize:"0.70rem",color:"var(--text-3)",lineHeight:1.6}}>
              {{
                linkedin:  "LinkedIn — 3,000 char limit. Line breaks and emojis preserved. Rich formatting uses LinkedIn's own editor.",
                instagram: "Instagram — image/video REQUIRED. 2,200 char limit. Hashtags show as links.",
                facebook:  "Facebook Page — 63,206 char limit. Links auto-preview.",
                x:         "X (Twitter) — 280 char limit. Thread if longer.",
                tiktok:    "TikTok — video required. No clickable URLs in captions.",
              }[activePreview]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Preview Card — shows content exactly as it will appear ── */
function PreviewCard({ platform, text, mediaUrl }: { platform:Platform; text:string; mediaUrl:string }) {
  const empty = !text.trim();
  // Preserve exact whitespace/line breaks in the preview
  const textStyle: React.CSSProperties = {
    fontSize:"0.82rem",lineHeight:1.65,whiteSpace:"pre-wrap",wordBreak:"break-word",
    fontFamily:"inherit",
  };
  const ph: React.CSSProperties = { fontStyle:"italic",color:"var(--text-3)",fontSize:"0.78rem" };
  const card: React.CSSProperties = {
    border:"1px solid var(--border)",borderRadius:"var(--radius-md)",
    background:"var(--bg-surface)",overflow:"hidden",
  };
  const ava = (bg:string):React.CSSProperties => ({
    width:40,height:40,borderRadius:"50%",background:bg,
    display:"flex",alignItems:"center",justifyContent:"center",
    fontWeight:700,fontSize:"0.82rem",color:"white",flexShrink:0,
  });
  const hdr: React.CSSProperties = {
    display:"flex",alignItems:"center",gap:10,
    padding:"12px 14px",borderBottom:"1px solid var(--border)",
  };
  const nameS: React.CSSProperties = {fontSize:"0.83rem",fontWeight:600,color:"var(--text-1)"};
  const metaS: React.CSSProperties = {fontSize:"0.68rem",color:"var(--text-3)",marginTop:2};
  const acts: React.CSSProperties  = {display:"flex",borderTop:"1px solid var(--border)",padding:"4px 14px"};
  const act: React.CSSProperties   = {flex:1,textAlign:"center",fontSize:"0.72rem",fontWeight:500,color:"var(--text-3)",padding:"6px 0"};

  const mediaBox = mediaUrl
    ? <div style={{height:90,background:"var(--accent-dim)",borderRadius:"var(--radius-xs)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--accent)",fontSize:"0.78rem",gap:6,marginTop:10}}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="16" height="12" rx="2"/><path d="M8 8l6 4-6 4V8z"/></svg>
        Media attached
      </div>
    : <div style={{height:70,background:"var(--bg-input)",borderRadius:"var(--radius-xs)",border:"1px dashed var(--border)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-3)",fontSize:"0.72rem",marginTop:10}}>
        No media attached
      </div>;

  if (platform === "linkedin") return <div style={card}>
    <div style={hdr}><div style={ava("linear-gradient(135deg,#0077B5,#00A0DC)")}>CL</div>
      <div><div style={nameS}>Client Name</div><div style={metaS}>Just now</div></div></div>
    <div style={{padding:"12px 14px"}}><div style={{...textStyle,...(empty?ph:{})}}>{empty?"Your post will appear here…":text}</div>{mediaBox}</div>
    <div style={acts}><span style={{...act,color:"#0077B5"}}>Like</span><span style={act}>Comment</span><span style={act}>Repost</span></div>
  </div>;

  if (platform === "instagram") return <div style={card}>
    <div style={{display:"flex",alignItems:"center",gap:9,padding:"10px 14px"}}>
      <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:700,fontSize:"0.78rem"}}>CL</div>
      <div><div style={nameS}>clienthandle</div><div style={metaS}>Business</div></div>
    </div>
    {mediaUrl
      ? <div style={{height:160,background:"linear-gradient(135deg,#833AB4,#FD1D1D)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"0.78rem",gap:6}}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="16" height="12" rx="2"/><path d="M8 8l6 4-6 4V8z"/></svg>
          Image attached
        </div>
      : <div style={{height:160,background:"var(--bg-input)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"var(--gold)",gap:6}}>
          <span style={{fontSize:"1.5rem"}}>⚠</span>
          <span style={{fontSize:"0.72rem"}}>Image required for Instagram</span>
        </div>
    }
    <div style={{padding:"10px 14px",fontSize:"0.8rem",lineHeight:1.6}}>
      <strong>clienthandle </strong>
      <span style={{...textStyle,...(empty?ph:{})}}>{empty?"Caption…":text}</span>
    </div>
  </div>;

  if (platform === "x") return <div style={card}>
    <div style={{...hdr,borderBottom:"none"}}>
      <div style={ava("linear-gradient(135deg,#222,#444)")}>CL</div>
      <div><div style={{...nameS,display:"flex",alignItems:"center",gap:4}}>Client Name <span style={{color:"var(--accent)",fontSize:"0.75rem"}}>✓</span></div><div style={metaS}>@clienthandle · now</div></div>
    </div>
    <div style={{padding:"4px 14px 8px"}}>
      <div style={{...textStyle,fontSize:"0.88rem",...(empty?ph:{})}}>{empty?"Tweet…":text.substring(0,280)}</div>
      {!empty && <div style={{fontSize:"0.68rem",color:text.length>280?"var(--danger)":"var(--text-3)",marginTop:4}}>{280-text.length} chars remaining</div>}
    </div>
    <div style={acts}><span style={act}>Reply</span><span style={act}>Repost</span><span style={act}>Like</span></div>
  </div>;

  if (platform === "facebook") return <div style={card}>
    <div style={hdr}><div style={ava("linear-gradient(135deg,#1877F2,#42A5F5)")}>CL</div>
      <div><div style={nameS}>Client Page</div><div style={metaS}>Just now · 🌍</div></div></div>
    <div style={{padding:"12px 14px"}}><div style={{...textStyle,...(empty?ph:{})}}>{empty?"Facebook post…":text}</div>{mediaBox}</div>
    <div style={acts}><span style={{...act,color:"#1877F2"}}>Like</span><span style={act}>Comment</span><span style={act}>Share</span></div>
  </div>;

  return <div style={card}>
    <div style={{height:220,background:"#111",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
      <svg width="40" height="40" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeLinecap="round"><polygon points="5 3 19 10 5 17 5 3"/></svg>
      <div style={{position:"absolute",bottom:12,left:12,right:48}}>
        <div style={{fontSize:"0.78rem",fontWeight:600,color:"rgba(255,255,255,0.9)",marginBottom:4}}>@clienthandle</div>
        <div style={{fontSize:"0.72rem",color:empty?"rgba(255,255,255,0.35)":"rgba(255,255,255,0.8)",lineHeight:1.5,fontStyle:empty?"italic":"normal"}}>
          {empty?"Caption (no URLs)…":text.substring(0,120)}
        </div>
      </div>
    </div>
  </div>;
}

const ico={width:15,height:15,viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round" as const};
function CalIco()  { return <svg {...ico}><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M14 2v4M6 2v4M2 8h16"/></svg>; }
function SaveIco() { return <svg {...ico}><path d="M4 2h9l5 5v11a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z"/><path d="M14 2v5h5M8 13h4"/></svg>; }
function SendIco() { return <svg {...ico}><path d="M4 14l6-10 6 10M7 10h6"/></svg>; }
function EyeIco()  { return <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"><path d="M1 10s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z"/><circle cx="10" cy="10" r="3"/></svg>; }
function CheckIco(){ return <svg {...ico}><path d="M4 10l4 4 8-8"/></svg>; }
function XSmIco()  { return <svg {...ico}><path d="M4 4l12 12M16 4L4 16"/></svg>; }
function InfoIco() { return <svg {...ico}><circle cx="10" cy="10" r="8"/><path d="M10 6v5M10 14v.5"/></svg>; }
function WarnIco() { return <svg {...ico}><path d="M10 2L2 17h16L10 2z"/><path d="M10 9v4M10 14.5v.5"/></svg>; }