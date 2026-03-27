"use client";

import { useState } from "react";

const NAV_ITEMS = ["General","Connections","Automation","Make.com","Danger Zone"];

const CONNECTIONS = [
  { id:"linkedin",  label:"LinkedIn",  color:"#0077B5", bg:"rgba(0,119,181,0.12)",  status:"connected",     note:"Client account — connected"   },
  { id:"instagram", label:"Instagram", color:"#E1306C", bg:"rgba(225,48,108,0.10)", status:"connected",     note:"Business account — connected"  },
  { id:"facebook",  label:"Facebook",  color:"#1877F2", bg:"rgba(24,119,242,0.10)", status:"connected",     note:"Facebook Page — connected"     },
  { id:"buffer",    label:"Buffer",    color:"#00C2A8", bg:"rgba(0,194,168,0.10)",  status:"connected",     note:"Publishing engine — connected" },
  { id:"tiktok",    label:"TikTok",    color:"#69C9D0", bg:"rgba(105,201,208,0.10)",status:"disconnected",  note:"Not connected"                 },
];

export default function SettingsPage() {
  const [section,  setSection]  = useState("General");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [callbackSecret, setCallbackSecret] = useState("");
  const [toggles, setToggles] = useState({
    approvalRequired:  true,
    gmailConfirmation: true,
    autoRetry:         true,
    analyticsSync:     true,
  });
  const [saved, setSaved] = useState(false);

  function saveSettings() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:24,alignItems:"start"}}>

      {/* Settings nav */}
      <div className="card" style={{padding:12,position:"sticky",top:"calc(var(--topbar-h) + 16px)"}}>
        {NAV_ITEMS.map(s => (
          <button key={s}
            onClick={() => setSection(s)}
            style={{
              display:"block", width:"100%", textAlign:"left",
              padding:"10px 12px", borderRadius:"var(--radius-sm)",
              fontSize:"0.85rem", fontWeight:500, cursor:"pointer",
              background: section===s ? "var(--accent-dim)" : "none",
              color:       section===s ? "var(--accent)" : "var(--text-2)",
              border:"none", fontFamily:"var(--font-body)", marginBottom:2,
              transition:"all var(--t-fast) var(--ease)",
            }}>
            {s}
          </button>
        ))}
      </div>

      {/* Settings content */}
      <div className="card card-pad">

        {section === "General" && (
          <>
            <div style={{fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:600,marginBottom:20,paddingBottom:12,borderBottom:"1px solid var(--border)",color:"var(--text-1)"}}>Your Profile</div>
            {[["Your name","VA Manager","text"],["Email address","va@socialos.app","email"]].map(([l,v,t]) => (
              <div key={l} className="form-group">
                <label className="form-label">{l}</label>
                <input type={t} className="input" defaultValue={v}/>
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Default timezone</label>
              <select className="input select-input">
                <option>America/New_York (EST)</option>
                <option>Europe/London (GMT)</option>
                <option>America/Los_Angeles (PST)</option>
                <option>Africa/Lagos (WAT)</option>
                <option>Asia/Accra (GMT)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Google Sheet ID</label>
              <input type="text" className="input" placeholder="Paste your Sheet ID from the URL"/>
              <p className="form-hint">Found in: docs.google.com/spreadsheets/d/<strong>SHEET_ID</strong>/edit</p>
            </div>
          </>
        )}

        {section === "Connections" && (
          <>
            <div style={{fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:600,marginBottom:20,paddingBottom:12,borderBottom:"1px solid var(--border)",color:"var(--text-1)"}}>Platform Connections</div>
            <div className="callout-info" style={{marginBottom:16}}>
              Connections are managed in your Buffer and Make.com accounts. Your client connects their social accounts via OAuth — they never share passwords.
            </div>
            {CONNECTIONS.map(c => (
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:14,padding:14,background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",marginBottom:10}}>
                <div style={{width:40,height:40,borderRadius:"var(--radius-sm)",background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:"0.68rem",fontWeight:700,color:c.color}}>{c.id.substring(0,2).toUpperCase()}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:"0.88rem",fontWeight:600,color:"var(--text-1)",marginBottom:2}}>{c.label}</div>
                  <div style={{fontSize:"0.72rem",color:"var(--text-3)"}}>{c.note}</div>
                </div>
                <button style={{padding:"6px 14px",borderRadius:20,fontSize:"0.75rem",fontWeight:600,border:`1px solid ${c.status==="connected"?"var(--accent2)":"var(--accent)"}`,color:c.status==="connected"?"var(--accent2)":"var(--accent)",background:"none",cursor:"pointer",fontFamily:"var(--font-body)"}}>
                  {c.status === "connected" ? "Connected" : "Connect"}
                </button>
              </div>
            ))}
          </>
        )}

        {section === "Automation" && (
          <>
            <div style={{fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:600,marginBottom:20,paddingBottom:12,borderBottom:"1px solid var(--border)",color:"var(--text-1)"}}>Automation Settings</div>
            {[
              { key:"approvalRequired",  title:"Require client approval before publishing", desc:"Posts stay pending until client approves via their portal" },
              { key:"gmailConfirmation", title:"Send Gmail confirmation after publish",      desc:"You and the client receive a confirmation email with post links" },
              { key:"autoRetry",         title:"Auto-retry failed posts",                    desc:"Retry up to 3 times if Make.com encounters an error" },
              { key:"analyticsSync",     title:"Daily analytics sync",                       desc:"Make.com Scenario 2 runs at 03:00 UTC each morning" },
            ].map(t => (
              <div key={t.key} className="toggle-wrap">
                <div className="toggle-info">
                  <div className="toggle-title">{t.title}</div>
                  <div className="toggle-desc">{t.desc}</div>
                </div>
                <div className={`toggle-switch${toggles[t.key as keyof typeof toggles]?" on":""}`}
                  onClick={() => setToggles(p => ({...p,[t.key]:!p[t.key as keyof typeof p]}))}/>
              </div>
            ))}
          </>
        )}

        {section === "Make.com" && (
          <>
            <div style={{fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:600,marginBottom:20,paddingBottom:12,borderBottom:"1px solid var(--border)",color:"var(--text-1)"}}>Make.com Integration</div>
            <div className="form-group">
              <label className="form-label">Scenario 1 Webhook URL</label>
              <input type="url" className="input" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hook.eu1.make.com/…"/>
              <p className="form-hint">Paste the webhook URL from your Make.com Scenario 1 trigger module.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Callback URL (read-only)</label>
              <div className="input" style={{background:"var(--bg-card-2)",fontSize:"0.82rem",fontFamily:"var(--font-mono)",userSelect:"all",cursor:"text"}}>
                {typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"}/api/publish/callback
              </div>
              <p className="form-hint">Add this to the HTTP module at the end of Make.com Scenario 1.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Callback Secret</label>
              <input type="password" className="input" value={callbackSecret} onChange={e => setCallbackSecret(e.target.value)} placeholder="Any strong secret string"/>
              <p className="form-hint">Set as header <code>x-socialos-secret</code> in Make.com HTTP module.</p>
            </div>
            <div className="callout-accent">
              <strong>Ops budget:</strong> ~600 ops/month for 1 client posting 2x/day on 3 platforms. Free tier limit: 1,000 ops/month.
            </div>
          </>
        )}

        {section === "Danger Zone" && (
          <>
            <div style={{fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:600,marginBottom:20,paddingBottom:12,borderBottom:"1px solid rgba(239,68,68,0.3)",color:"var(--danger)"}}>Danger Zone</div>
            <div style={{padding:16,border:"1px solid rgba(239,68,68,0.25)",borderRadius:"var(--radius-md)"}}>
              <div style={{fontSize:"0.88rem",fontWeight:600,color:"var(--text-1)",marginBottom:4}}>Revoke Google access</div>
              <div style={{fontSize:"0.78rem",color:"var(--text-3)",marginBottom:12}}>Signs you out and removes Google Sheets/Drive permissions. You will need to sign in again.</div>
              <button className="btn btn-danger btn-sm">Revoke Access</button>
            </div>
          </>
        )}

        {/* Save button */}
        {!["Danger Zone","Connections"].includes(section) && (
          <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:24}}>
            <button className="btn btn-secondary">Reset</button>
            <button className="btn btn-primary" onClick={saveSettings}
              style={saved ? {background:"var(--success)"} : {}}>
              {saved ? "Saved" : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
