"use client";

import { useState, useEffect } from "react";
import type { Client, Platform } from "@/types";

const ALL_PLATFORMS: Platform[] = ["linkedin","instagram","facebook","x","tiktok"];

const TIMEZONES = [
  "Africa/Accra","Africa/Lagos","Africa/Nairobi",
  "America/Los_Angeles","America/New_York","America/Chicago",
  "Europe/London","Europe/Paris","Europe/Berlin",
  "Asia/Dubai","Asia/Singapore","Asia/Tokyo",
  "Australia/Sydney","Pacific/Auckland",
];

const AVATAR_COLORS = [
  "linear-gradient(135deg,var(--accent),#00A896)",
  "linear-gradient(135deg,var(--blue),#6B8FFF)",
  "linear-gradient(135deg,var(--gold),#F09F20)",
  "linear-gradient(135deg,var(--danger),#D4375A)",
];

type NewClient = {
  name: string; email: string; timezone: string;
  platforms: Platform[]; approvalRequired: boolean;
};
const EMPTY_CLIENT: NewClient = {
  name:"", email:"", timezone:"Africa/Accra",
  platforms:["linkedin","instagram","facebook"],
  approvalRequired:true,
};

export default function ClientsPage() {
  const [clients,  setClients]  = useState<Client[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal,setShowModal]= useState(false);
  const [form,     setForm]     = useState<NewClient>(EMPTY_CLIENT);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  function loadClients() {
    setLoading(true);
    fetch("/api/clients").then(r=>r.json())
      .then(res=>{ if(res.ok) setClients(res.data); })
      .finally(()=>setLoading(false));
  }

  useEffect(()=>{ loadClients(); }, []);

  function togglePlat(p: Platform) {
    setForm(f=>({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter(x=>x!==p)
        : [...f.platforms, p],
    }));
  }

  async function addClient() {
    if (!form.name.trim())  { setError("Name is required");  return; }
    if (!form.email.trim()) { setError("Email is required"); return; }
    if (form.platforms.length===0) { setError("Select at least one platform"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/clients",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(form),
      }).then(r=>r.json());
      if (res.ok) {
        setShowModal(false);
        setForm(EMPTY_CLIENT);
        loadClients();
      } else {
        setError(res.error || "Failed to add client");
      }
    } catch(e:any) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  const PLAT_META: Record<Platform,{label:string;color:string;bg:string}> = {
    linkedin:  {label:"LinkedIn",  color:"#0077B5",bg:"rgba(0,119,181,0.12)"},
    instagram: {label:"Instagram", color:"#E1306C",bg:"rgba(225,48,108,0.12)"},
    facebook:  {label:"Facebook",  color:"#1877F2",bg:"rgba(24,119,242,0.12)"},
    x:         {label:"X",         color:"#888888",bg:"rgba(255,255,255,0.08)"},
    tiktok:    {label:"TikTok",    color:"#69C9D0",bg:"rgba(105,201,208,0.12)"},
  };

  const inp:React.CSSProperties = {width:"100%",padding:"10px 14px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",color:"var(--text-1)",fontFamily:"var(--font-body)",fontSize:"0.875rem"};
  const lbl:React.CSSProperties = {fontSize:"0.78rem",fontWeight:600,color:"var(--text-2)",marginBottom:6,display:"block"};

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            {loading ? "Loading…" : `${clients.length} client${clients.length!==1?"s":""} registered`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}>
          <PlusIco/> Add Client
        </button>
      </div>

      {/* Client list */}
      {loading ? (
        <div style={{display:"flex",justifyContent:"center",padding:48}}>
          <div className="spinner spinner-lg"/>
        </div>
      ) : clients.length===0 ? (
        <div className="card card-pad empty-state">
          <div className="empty-icon"><UsersIco/></div>
          <div className="empty-title">No clients yet</div>
          <p className="empty-desc">
            Add your first client using the button above. They will be stored in the
            Clients tab of your Google Sheet.
          </p>
          <button className="btn btn-primary" onClick={()=>setShowModal(true)}>
            <PlusIco/> Add First Client
          </button>
        </div>
      ) : (
        <div className="card" style={{overflow:"hidden"}}>
          {clients.map((c,i)=>(
            <div key={c.id} className="post-item" style={{alignItems:"center"}}>
              <div style={{
                width:44,height:44,borderRadius:"var(--radius-sm)",flexShrink:0,
                background:AVATAR_COLORS[i%AVATAR_COLORS.length],
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"var(--font-head)",fontWeight:700,fontSize:"0.85rem",color:"white",
              }}>
                {c.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}
              </div>

              <div className="post-body">
                <div className="post-preview">{c.name}</div>
                <div className="post-meta">
                  <span>{c.email}</span>
                  <span>{c.timezone}</span>
                </div>
              </div>

              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginRight:16,maxWidth:200}}>
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

              <div style={{textAlign:"center",marginRight:16,flexShrink:0}}>
                <div style={{fontFamily:"var(--font-head)",fontSize:"0.85rem",fontWeight:700,
                  color:c.approvalRequired?"var(--gold)":"var(--accent)"}}>
                  {c.approvalRequired?"Approval":"Auto"}
                </div>
                <div style={{fontSize:"0.65rem",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Mode</div>
              </div>

              <span className="pill pill-published">Active</span>
            </div>
          ))}
        </div>
      )}

      {/* Add Client modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{width:560}}>
            <div className="modal-head">
              <span className="modal-title">Add New Client</span>
              <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-3)",fontSize:"1.1rem"}}
                onClick={()=>setShowModal(false)}>✕</button>
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
                    const on = form.platforms.includes(p);
                    const m  = PLAT_META[p];
                    return (
                      <button key={p} onClick={()=>togglePlat(p)} style={{
                        padding:"6px 14px",borderRadius:20,fontSize:"0.78rem",fontWeight:500,
                        border:`1px solid ${on?m.color:"var(--border)"}`,
                        background:on?m.bg:"var(--bg-input)",
                        color:on?m.color:"var(--text-2)",
                        cursor:"pointer",fontFamily:"var(--font-body)",
                        transition:"all var(--t-fast) var(--ease)",
                      }}>
                        {on && "✓ "}{m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"12px 14px",background:"var(--bg-input)",border:"1px solid var(--border)",
                borderRadius:"var(--radius-sm)"}}>
                <div>
                  <div style={{fontSize:"0.85rem",fontWeight:500,color:"var(--text-1)",marginBottom:2}}>
                    Require approval before publishing
                  </div>
                  <div style={{fontSize:"0.72rem",color:"var(--text-3)"}}>
                    Posts must be approved by client via the /client portal before publishing
                  </div>
                </div>
                <div
                  className={`toggle-switch${form.approvalRequired?" on":""}`}
                  onClick={()=>setForm(f=>({...f,approvalRequired:!f.approvalRequired}))}
                  style={{flexShrink:0,marginLeft:16}}
                />
              </div>

              <div style={{marginTop:14,padding:"10px 12px",background:"var(--blue-dim)",border:"1px solid rgba(79,142,247,0.20)",borderRadius:"var(--radius-sm)",fontSize:"0.75rem",color:"var(--text-2)",lineHeight:1.6}}>
                The client will be added to the Clients tab in your Google Sheet.
                Share the portal URL with them: <strong>{typeof window!=="undefined"?window.location.origin:""}/client</strong>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={addClient}>
                {saving?<><span className="spinner" style={{marginRight:6}}/>Adding…</>:<><PlusIco/> Add Client</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ico={width:18,height:18,viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const};
function PlusIco()  { return <svg {...ico}><path d="M10 4v12M4 10h12"/></svg>; }
function UsersIco() { return <svg {...ico}><circle cx="8" cy="6" r="3"/><path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/></svg>; }