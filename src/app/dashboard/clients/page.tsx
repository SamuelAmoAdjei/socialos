"use client";

import { useState, useEffect, useCallback } from "react";
import type { Client, Platform } from "@/types";

const ALL_PLATFORMS: Platform[] = ["linkedin","instagram","facebook","x","tiktok"];
const TIMEZONES = [
  "Africa/Accra","Africa/Lagos","Africa/Nairobi",
  "America/Los_Angeles","America/New_York","America/Chicago",
  "Europe/London","Europe/Paris","Europe/Berlin",
  "Asia/Dubai","Asia/Singapore","Asia/Tokyo","Australia/Sydney",
];
const AVATAR_BG = [
  "linear-gradient(135deg,var(--accent),#00A896)",
  "linear-gradient(135deg,var(--blue),#6B8FFF)",
  "linear-gradient(135deg,var(--gold),#F09F20)",
  "linear-gradient(135deg,var(--danger),#D4375A)",
];
const PLAT_META: Record<Platform,{label:string;color:string;bg:string}> = {
  linkedin: {label:"LinkedIn", color:"#0077B5",bg:"rgba(0,119,181,0.12)"},
  instagram:{label:"Instagram",color:"#E1306C",bg:"rgba(225,48,108,0.12)"},
  facebook: {label:"Facebook", color:"#1877F2",bg:"rgba(24,119,242,0.12)"},
  x:        {label:"X",        color:"#888888",bg:"rgba(255,255,255,0.08)"},
  tiktok:   {label:"TikTok",   color:"#69C9D0",bg:"rgba(105,201,208,0.12)"},
};

type ClientForm = {
  name:string; email:string; timezone:string;
  platforms:Platform[]; approvalRequired:boolean; makeWebhookUrl:string;
};
const EMPTY:ClientForm = {
  name:"",email:"",timezone:"Africa/Accra",
  platforms:["linkedin","instagram","facebook"],
  approvalRequired:true, makeWebhookUrl:"",
};

export default function ClientsPage() {
  const [clients,   setClients]   = useState<Client[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState<"add"|"edit"|null>(null);
  const [editTarget,setEditTarget]= useState<Client|null>(null);
  const [form,      setForm]      = useState<ClientForm>(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string|null>(null);
  const [error,     setError]     = useState("");
  const [toast,     setToast]     = useState("");
  const [refreshing,setRefreshing]= useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setRefreshing(true);
    fetch("/api/clients").then(r=>r.json())
      .then(res=>{ if(res.ok) setClients(res.data); })
      .finally(()=>{
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(()=>{ load(); }, [load]);

  function showToast(msg:string) {
    setToast(msg);
    setTimeout(()=>setToast(""),3000);
  }

  function openAdd() {
    setForm(EMPTY); setError(""); setEditTarget(null); setModal("add");
  }
  function openEdit(c:Client) {
    setForm({
      name:c.name, email:c.email, timezone:c.timezone||"Africa/Accra",
      platforms:c.platforms, approvalRequired:c.approvalRequired,
      makeWebhookUrl:c.makeWebhookUrl||"",
    });
    setError(""); setEditTarget(c); setModal("edit");
  }

  function togglePlat(p:Platform) {
    setForm(f=>({...f,platforms:
      f.platforms.includes(p)?f.platforms.filter(x=>x!==p):[...f.platforms,p]
    }));
  }

  async function save() {
    if (!form.name.trim())  { setError("Name is required");  return; }
    if (!form.email.trim()) { setError("Email is required"); return; }
    if (!form.email.includes("@")){ setError("Enter a valid email"); return; }
    if (form.platforms.length===0){ setError("Select at least one platform"); return; }

    setSaving(true); setError("");
    try {
      const res = await fetch("/api/clients",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          ...form,
          clientId: editTarget?.id || undefined,
        }),
      }).then(r=>r.json());

      if (res.ok) {
        setModal(null);
        load();
        localStorage.setItem("sos-clients-updated-at", String(Date.now()));
        window.dispatchEvent(new Event("sos:clients-updated"));
        showToast(modal==="edit"?"Client updated":"Client added — they can now log in at /client");
      } else {
        setError(res.error||"Failed to save client");
      }
    } finally { setSaving(false); }
  }

  async function deleteClient(c:Client) {
    if (!window.confirm(`Delete client "${c.name}"?\n\nThis removes them from your Google Sheet. Their posts will remain.`)) return;
    setDeleting(c.id);
    try {
      // We delete by posting with a special _delete flag — the API handles the row deletion
      const res = await fetch("/api/clients",{
        method:"DELETE", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ clientId: c.id }),
      }).then(r=>r.json());

      if (res.ok) {
        setClients(prev=>prev.filter(x=>x.id!==c.id));
        localStorage.setItem("sos-clients-updated-at", String(Date.now()));
        window.dispatchEvent(new Event("sos:clients-updated"));
        showToast("Client removed from your Sheet");
      } else {
        showToast(res.error||"Delete failed");
      }
    } finally { setDeleting(null); }
  }

  const inp:React.CSSProperties = {width:"100%",padding:"10px 14px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",color:"var(--text-1)",fontFamily:"var(--font-body)",fontSize:"0.875rem"};
  const lbl:React.CSSProperties = {fontSize:"0.78rem",fontWeight:600,color:"var(--text-2)",marginBottom:6,display:"block"};

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{position:"fixed",bottom:24,right:24,zIndex:600,padding:"12px 20px",background:"var(--bg-card)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"var(--radius-md)",boxShadow:"var(--shadow-md)",fontSize:"0.85rem",fontWeight:500,color:"var(--success)",animation:"toastIn 0.3s var(--ease)"}}>
          {toast}
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            {loading?"Loading…":`${clients.length} client${clients.length!==1?"s":""} registered`}
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={refreshing}>
            {refreshing ? <><span className="spinner" style={{marginRight:6}}/>Refreshing...</> : "Refresh"}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <PlusIco/> Add Client
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{display:"flex",justifyContent:"center",padding:48}}><div className="spinner spinner-lg"/></div>
      ) : clients.length===0 ? (
        <div className="card card-pad empty-state">
          <div className="empty-icon"><UsersIco/></div>
          <div className="empty-title">No clients yet</div>
          <p className="empty-desc">Add your first client — they will be stored in the Clients tab of your Google Sheet and can log in at /client.</p>
          <button className="btn btn-primary" onClick={openAdd}><PlusIco/> Add First Client</button>
        </div>
      ) : (
        <div className="card" style={{overflow:"hidden"}}>
          {clients.map((c,i)=>(
            <div key={c.id} style={{
              display:"flex",alignItems:"center",gap:14,
              padding:"16px 20px",borderBottom:i<clients.length-1?"1px solid var(--border)":"none",
              transition:"background var(--t-fast) var(--ease)",
            }}
            onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-hover)")}
            onMouseLeave={e=>(e.currentTarget.style.background="")}>

              <div style={{
                width:44,height:44,borderRadius:"var(--radius-sm)",flexShrink:0,
                background:AVATAR_BG[i%AVATAR_BG.length],
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"var(--font-head)",fontWeight:700,fontSize:"0.85rem",color:"white",
              }}>
                {c.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}
              </div>

              <div style={{flex:1,minWidth:0}}>
                {/* Explicitly set color to fix visibility issue */}
                <div style={{fontSize:"0.88rem",fontWeight:600,color:"var(--text-1)",marginBottom:3}}>
                  {c.name}
                </div>
                <div style={{fontSize:"0.72rem",color:"var(--text-3)",display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span>{c.email}</span>
                  <span>·</span>
                  <span>{c.timezone}</span>
                </div>
              </div>

              <div style={{display:"flex",gap:4,flexWrap:"wrap",maxWidth:220,flexShrink:0}}>
                {c.platforms.map(p=>(
                  <span key={p} style={{
                    fontSize:"0.65rem",fontWeight:700,padding:"2px 7px",borderRadius:20,
                    background:PLAT_META[p as Platform]?.bg??"var(--bg-input)",
                    color:PLAT_META[p as Platform]?.color??"var(--text-3)",
                  }}>
                    {PLAT_META[p as Platform]?.label??p}
                  </span>
                ))}
              </div>

              <div style={{textAlign:"center",flexShrink:0,marginRight:8}}>
                <div style={{fontFamily:"var(--font-head)",fontSize:"0.82rem",fontWeight:700,
                  color:c.approvalRequired?"var(--gold)":"var(--accent)"}}>
                  {c.approvalRequired?"Approval":"Auto"}
                </div>
                <div style={{fontSize:"0.62rem",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Mode</div>
              </div>

              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button className="btn btn-secondary btn-sm"
                  onClick={()=>openEdit(c)}>
                  <EditIco/> Edit
                </button>
                <button className="btn btn-danger btn-sm"
                  disabled={deleting===c.id}
                  onClick={()=>deleteClient(c)}>
                  {deleting===c.id?<span className="spinner"/>:<TrashIco/>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <div className="modal-backdrop" onClick={()=>setModal(null)}>
          <div className="modal" style={{width:560}} onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">{modal==="edit"?"Edit Client":"Add New Client"}</span>
              <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-3)",fontSize:"1.1rem"}}
                onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && (
                <div style={{padding:"10px 12px",background:"var(--danger-dim)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:"var(--radius-sm)",fontSize:"0.82rem",color:"var(--danger)",marginBottom:16}}>
                  {error}
                </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div>
                  <label style={lbl}>Client Name *</label>
                  <input type="text" style={inp} placeholder="e.g. Acme Corp"
                    value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
                </div>
                <div>
                  <label style={lbl}>Client Email *</label>
                  <input type="email" style={inp} placeholder="client@example.com"
                    value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
                  <p style={{fontSize:"0.70rem",color:"var(--text-3)",marginTop:4,lineHeight:1.5}}>
                    This email is used for role-based login at /client
                  </p>
                </div>
              </div>

              <div style={{marginBottom:14}}>
                <label style={lbl}>Timezone</label>
                <select style={{...inp,appearance:"none",cursor:"pointer"}}
                  value={form.timezone} onChange={e=>setForm(f=>({...f,timezone:e.target.value}))}>
                  {TIMEZONES.map(tz=><option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>

              <div style={{marginBottom:14}}>
                <label style={{...lbl,marginBottom:8}}>Platforms *</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {ALL_PLATFORMS.map(p=>{
                    const on=form.platforms.includes(p); const m=PLAT_META[p];
                    return (
                      <button key={p} onClick={()=>togglePlat(p)} style={{
                        padding:"6px 14px",borderRadius:20,fontSize:"0.78rem",fontWeight:500,
                        border:`1px solid ${on?m.color:"var(--border)"}`,
                        background:on?m.bg:"var(--bg-input)",color:on?m.color:"var(--text-2)",
                        cursor:"pointer",fontFamily:"var(--font-body)",
                        transition:"all var(--t-fast) var(--ease)",
                      }}>
                        {on&&"✓ "}{m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"12px 14px",background:"var(--bg-input)",border:"1px solid var(--border)",
                borderRadius:"var(--radius-sm)",marginBottom:14}}>
                <div>
                  <div style={{fontSize:"0.85rem",fontWeight:500,color:"var(--text-1)",marginBottom:2}}>
                    Require approval before publishing
                  </div>
                  <div style={{fontSize:"0.72rem",color:"var(--text-3)"}}>
                    Posts go pending until client approves at /client
                  </div>
                </div>
                <div className={`toggle-switch${form.approvalRequired?" on":""}`}
                  onClick={()=>setForm(f=>({...f,approvalRequired:!f.approvalRequired}))}
                  style={{flexShrink:0,marginLeft:16}}/>
              </div>

              <div style={{padding:"10px 12px",background:"var(--accent-dim)",border:"1px solid rgba(0,194,168,0.20)",borderRadius:"var(--radius-sm)",fontSize:"0.75rem",color:"var(--text-2)",lineHeight:1.6}}>
                <strong>After adding:</strong> Update Settings → CLIENT_EMAIL to match this email.
                Then add this email to Google Cloud OAuth test users.
                Client logs in at: <strong>{typeof window!=="undefined"?window.location.origin:""}/client</strong>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={save}>
                {saving?<><span className="spinner" style={{marginRight:6}}/>Saving…</>:
                  <>{modal==="edit"?"Save Changes":"Add Client"}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ico={width:16,height:16,viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const};
function PlusIco()  { return <svg {...ico}><path d="M10 4v12M4 10h12"/></svg>; }
function EditIco()  { return <svg {...ico}><path d="M14 2l4 4-10 10H4v-4L14 2z"/><path d="M12 4l4 4"/></svg>; }
function TrashIco() { return <svg {...ico}><path d="M4 6h12M8 6V4h4v2M7 6v10h6V6"/></svg>; }
function UsersIco() { return <svg {...{...ico,width:20,height:20}}><circle cx="8" cy="6" r="3"/><path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/></svg>; }