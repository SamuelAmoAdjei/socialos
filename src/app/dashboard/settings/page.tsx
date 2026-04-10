"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";

const NAV_ITEMS = ["General","Connections","Automation","Make.com","Danger Zone"];

const TIMEZONES = [
  "Africa/Accra","Africa/Lagos","Africa/Nairobi",
  "America/Los_Angeles","America/New_York","America/Chicago","America/Denver",
  "Europe/London","Europe/Paris","Europe/Berlin",
  "Asia/Dubai","Asia/Singapore","Asia/Tokyo","Asia/Kolkata",
  "Australia/Sydney","Pacific/Auckland",
];

const FIELD_MAP: Record<string,string> = {
  vaEmail:        "VA_EMAIL",
  clientEmail:    "CLIENT_EMAIL",
  clientName:     "CLIENT_NAME",
  timezone:       "CLIENT_TIMEZONE",
  pollInterval:   "POLL_INTERVAL_MINS",
  makeWebhookUrl: "MAKE_WEBHOOK_URL",
  callbackUrl:    "CALLBACK_URL",
};

type FormState = {
  vaEmail:string; clientEmail:string; clientName:string;
  timezone:string; pollInterval:string;
  makeWebhookUrl:string; callbackUrl:string;
};
const EMPTY:FormState = {
  vaEmail:"",clientEmail:"",clientName:"",
  timezone:"",pollInterval:"5",makeWebhookUrl:"",callbackUrl:"",
};

export default function SettingsPage() {
  const [section,  setSection]  = useState("General");
  const [form,     setForm]     = useState<FormState>(EMPTY);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState<{text:string;ok:boolean}|null>(null);
  const [revoking, setRevoking] = useState(false);
  const [toggles,  setToggles]  = useState({approvalRequired:true,gmailConfirmation:true,autoRetry:true,analyticsSync:true});

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings").then(r=>r.json());
      if (!res.ok) return;
      const s = res.data as Record<string,string>;
      setForm({
        vaEmail:        s["VA_EMAIL"]          ??"",
        clientEmail:    s["CLIENT_EMAIL"]       ??"",
        clientName:     s["CLIENT_NAME"]        ??"",
        timezone:       s["CLIENT_TIMEZONE"]    ??"",
        pollInterval:   s["POLL_INTERVAL_MINS"] ??"5",
        makeWebhookUrl: s["MAKE_WEBHOOK_URL"]   ??"",
        callbackUrl:    s["CALLBACK_URL"]       ??"",
      });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  function set(field:keyof FormState, value:string) {
    setForm(f=>({...f,[field]:value}));
  }

  async function save() {
    setSaving(true); setSaveMsg(null);
    try {
      const payload:Record<string,string> = {};
      (Object.entries(FIELD_MAP) as [keyof FormState,string][]).forEach(([f,k]) => { payload[k]=form[f]; });
      const res = await fetch("/api/settings",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
      }).then(r=>r.json());
      setSaveMsg(res.ok ? {text:"Settings saved to your Google Sheet",ok:true} : {text:res.error||"Save failed",ok:false});
    } catch(e:any) { setSaveMsg({text:e.message,ok:false}); }
    finally { setSaving(false); setTimeout(()=>setSaveMsg(null),4000); }
  }

  async function revoke() {
    if (!window.confirm("This will sign you out and revoke Google access. Continue?")) return;
    setRevoking(true);
    await signOut({callbackUrl:"/auth/signin"});
  }

  const inp:React.CSSProperties = {width:"100%",padding:"10px 14px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",color:"var(--text-1)",fontFamily:"var(--font-body)",fontSize:"0.875rem"};
  const card:React.CSSProperties = {background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:24};
  const lbl:React.CSSProperties = {fontSize:"0.78rem",fontWeight:600,color:"var(--text-2)",marginBottom:6,display:"block"};
  const hint:React.CSSProperties = {fontSize:"0.72rem",color:"var(--text-3)",marginTop:5};
  const hdr:React.CSSProperties = {fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:600,marginBottom:20,paddingBottom:12,borderBottom:"1px solid var(--border)",color:"var(--text-1)"};

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:300}}>
      <div className="spinner spinner-lg"/>
      <span style={{marginLeft:12,color:"var(--text-3)",fontSize:"0.875rem"}}>Loading settings from your Sheet…</span>
    </div>
  );

  return (
    <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:24,alignItems:"start"}}>

      <div style={{...card,padding:12,position:"sticky",top:"calc(var(--topbar-h) + 16px)"}}>
        {NAV_ITEMS.map(s=>(
          <button key={s} onClick={()=>setSection(s)} style={{
            display:"block",width:"100%",textAlign:"left",
            padding:"10px 12px",borderRadius:"var(--radius-sm)",
            fontSize:"0.85rem",fontWeight:500,cursor:"pointer",
            background:section===s?"var(--accent-dim)":"none",
            color:section===s?"var(--accent)":"var(--text-2)",
            border:"none",fontFamily:"var(--font-body)",marginBottom:2,
            transition:"all var(--t-fast) var(--ease)",
          }}>{s}</button>
        ))}
      </div>

      <div style={card}>

        {section==="General" && <>
          <div style={hdr}>General Settings</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div>
              <label style={lbl}>VA Email (your email)</label>
              <input style={inp} type="email" placeholder="you@example.com" value={form.vaEmail} onChange={e=>set("vaEmail",e.target.value)}/>
              <span style={hint}>Receives confirmation emails after each publish</span>
            </div>
            <div>
              <label style={lbl}>Client Email</label>
              <input style={inp} type="email" placeholder="client@example.com" value={form.clientEmail} onChange={e=>set("clientEmail",e.target.value)}/>
              <span style={hint}>Receives approval requests and publish confirmations</span>
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <label style={lbl}>Client Name</label>
            <input style={inp} type="text" placeholder="e.g. Acme Corp" value={form.clientName} onChange={e=>set("clientName",e.target.value)}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div>
              <label style={lbl}>Client Timezone</label>
              <select style={{...inp,appearance:"none",cursor:"pointer"}} value={form.timezone} onChange={e=>set("timezone",e.target.value)}>
                <option value="">Select timezone…</option>
                {TIMEZONES.map(tz=><option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Scheduler Poll Interval</label>
              <select style={{...inp,appearance:"none",cursor:"pointer"}} value={form.pollInterval} onChange={e=>set("pollInterval",e.target.value)}>
                {["1","2","5","10","15","30"].map(v=><option key={v} value={v}>{v} minutes</option>)}
              </select>
              <span style={hint}>How often Apps Script checks for approved posts</span>
            </div>
          </div>
          <div style={{padding:"14px 16px",background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)"}}>
            <div style={{fontSize:"0.82rem",fontWeight:600,color:"var(--text-1)",marginBottom:4}}>Google Sheet ID — managed in Vercel</div>
            <div style={{fontSize:"0.78rem",color:"var(--text-3)",lineHeight:1.6}}>
              The Sheet ID lives as a Vercel environment variable (GOOGLE_SHEETS_ID) and cannot be changed from this page.
              To update it: Vercel → Settings → Environment Variables → GOOGLE_SHEETS_ID → Edit → Redeploy.
            </div>
          </div>
        </>}

        {section==="Connections" && <>
          <div style={hdr}>Platform Connections</div>
          <div style={{padding:"12px 14px",background:"var(--blue-dim)",border:"1px solid rgba(79,142,247,0.20)",borderRadius:"var(--radius-sm)",fontSize:"0.78rem",color:"var(--text-2)",lineHeight:1.7,marginBottom:16}}>
            Connections are managed in Buffer and Make.com. Your client connects their social accounts via OAuth — they never share passwords with you.
          </div>
          {[
            {id:"linkedin", label:"LinkedIn",  note:"Personal profile — connects in Buffer",             color:"#0077B5",bg:"rgba(0,119,181,0.12)",  url:"https://buffer.com/manage/channels"},
            {id:"instagram",label:"Instagram", note:"Business account — connects via Buffer + Meta",     color:"#E1306C",bg:"rgba(225,48,108,0.12)", url:"https://buffer.com/manage/channels"},
            {id:"facebook", label:"Facebook",  note:"Facebook Page — connects via Buffer + Meta",        color:"#1877F2",bg:"rgba(24,119,242,0.12)",  url:"https://buffer.com/manage/channels"},
            {id:"buffer",   label:"Buffer",    note:"Publishing engine — all platforms route through Buffer",color:"#00C2A8",bg:"rgba(0,194,168,0.12)",url:"https://buffer.com"},
            {id:"makecom",  label:"Make.com",  note:"Orchestration — receives webhook and calls Buffer", color:"#6D47D9",bg:"rgba(109,71,217,0.12)",  url:"https://make.com"},
          ].map(c=>(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:14,padding:14,background:"var(--bg-input)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",marginBottom:10}}>
              <div style={{width:40,height:40,borderRadius:"var(--radius-sm)",background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:"0.68rem",fontWeight:700,color:c.color}}>{c.id.substring(0,2).toUpperCase()}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:"0.88rem",fontWeight:600,color:"var(--text-1)",marginBottom:2}}>{c.label}</div>
                <div style={{fontSize:"0.72rem",color:"var(--text-3)"}}>{c.note}</div>
              </div>
              <a href={c.url} target="_blank" rel="noopener noreferrer" style={{padding:"6px 14px",borderRadius:20,fontSize:"0.75rem",fontWeight:600,border:`1px solid ${c.color}`,color:c.color,background:"none",cursor:"pointer",textDecoration:"none",fontFamily:"var(--font-body)",whiteSpace:"nowrap"}}>
                Manage →
              </a>
            </div>
          ))}
        </>}

        {section==="Automation" && <>
          <div style={hdr}>Automation Settings</div>
          {[
            {key:"approvalRequired",  title:"Require client approval before publishing",    desc:"Posts stay pending until client approves via their portal at /client"},
            {key:"gmailConfirmation", title:"Send Gmail confirmation after each publish",    desc:"You and the client both receive an email after every post goes live"},
            {key:"autoRetry",         title:"Auto-retry failed posts (up to 3 times)",      desc:"Apps Script retries at the next poll cycle if Make.com returns an error"},
            {key:"analyticsSync",     title:"Daily analytics sync via Make.com Scenario 2", desc:"Runs at 03:00 UTC — populates the Analytics tab in your Google Sheet"},
          ].map(t=>(
            <div key={t.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{flex:1,paddingRight:16}}>
                <div style={{fontSize:"0.875rem",fontWeight:500,color:"var(--text-1)",marginBottom:2}}>{t.title}</div>
                <div style={{fontSize:"0.75rem",color:"var(--text-3)"}}>{t.desc}</div>
              </div>
              <div className={`toggle-switch${toggles[t.key as keyof typeof toggles]?" on":""}`}
                onClick={()=>setToggles(p=>({...p,[t.key]:!p[t.key as keyof typeof p]}))}/>
            </div>
          ))}
          <div style={{marginTop:24,padding:"12px 16px",background:"rgba(245,158,11,0.1)",borderRadius:"var(--radius-md)",border:"1px solid rgba(245,158,11,0.2)",display:"flex",gap:12,alignItems:"flex-start"}}>
            <svg style={{width:18,height:18,marginTop:1,color:"var(--gold)"}} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM10 6v5M10 14h.01"/></svg>
            <div style={{fontSize:"0.8rem",color:"var(--text-2)",lineHeight:1.6}}>
              <strong style={{color:"var(--gold)",display:"block",marginBottom:4}}>UI Demonstration Only</strong>
              These toggles are cosmetic placeholders to demonstrate future functionality. Actual automation (approval routing, auto-retries, etc.) is hardcoded into Apps Script and your Make.com scenarios.
            </div>
          </div>
        </>}

        {section==="Make.com" && <>
          <div style={hdr}>Make.com Integration</div>
          <div style={{marginBottom:16}}>
            <label style={lbl}>Scenario 1 Webhook URL (Post Publisher)</label>
            <input type="url" style={inp} placeholder="https://hook.eu1.make.com/…" value={form.makeWebhookUrl} onChange={e=>set("makeWebhookUrl",e.target.value)}/>
            <span style={hint}>Paste the webhook URL from Make.com → Scenario 1 → Webhook trigger. Also saved to Settings!B1 in your Sheet.</span>
          </div>
          <div style={{marginBottom:16}}>
            <label style={lbl}>Apps Script Callback URL</label>
            <input type="url" style={inp} placeholder="https://script.google.com/macros/s/…/exec" value={form.callbackUrl} onChange={e=>set("callbackUrl",e.target.value)}/>
            <span style={hint}>Your Apps Script Web App URL. Saved to Settings!B2 in your Sheet.</span>
          </div>
          <div style={{padding:"12px 14px",background:"var(--accent-dim)",border:"1px solid rgba(0,194,168,0.20)",borderRadius:"var(--radius-sm)",fontSize:"0.78rem",color:"var(--text-2)",lineHeight:1.7,marginBottom:16}}>
            <strong style={{color:"var(--accent)"}}>HTTP callback URL for Make.com:</strong>
            <div style={{marginTop:6,padding:"6px 10px",background:"var(--bg-input)",borderRadius:"var(--radius-xs)",fontFamily:"var(--font-mono)",fontSize:"0.75rem",color:"var(--text-1)",userSelect:"all",cursor:"text",border:"1px solid var(--border)"}}>
              {typeof window!=="undefined"?window.location.origin:"https://your-app.vercel.app"}/api/publish/callback
            </div>
            <div style={{marginTop:6}}>Add this to the HTTP module at the end of Make.com Scenario 1.</div>
          </div>
        </>}

        {section==="Danger Zone" && <>
          <div style={{...hdr,borderBottom:"1px solid rgba(239,68,68,0.30)",color:"var(--danger)"}}>Danger Zone</div>
          <div style={{padding:16,border:"1px solid rgba(239,68,68,0.25)",borderRadius:"var(--radius-md)",marginBottom:12}}>
            <div style={{fontSize:"0.88rem",fontWeight:600,color:"var(--text-1)",marginBottom:4}}>Sign out and revoke Google access</div>
            <div style={{fontSize:"0.78rem",color:"var(--text-3)",marginBottom:12,lineHeight:1.6}}>
              Signs you out and removes Google Sheets and Drive permissions from this session.
              Your data in Google Sheets is not affected. You can sign back in at any time.
            </div>
            <button className="btn btn-danger btn-sm" disabled={revoking} onClick={revoke}>
              {revoking ? <><span className="spinner"/>Revoking…</> : "Sign out and revoke access"}
            </button>
          </div>
          <div style={{padding:16,border:"1px solid var(--border)",borderRadius:"var(--radius-md)"}}>
            <div style={{fontSize:"0.88rem",fontWeight:600,color:"var(--text-1)",marginBottom:4}}>Vercel Environment Variables</div>
            <div style={{fontSize:"0.78rem",color:"var(--text-3)",marginBottom:12,lineHeight:1.6}}>
              NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_SHEETS_ID, MAKE_CALLBACK_SECRET
              and NEXT_PUBLIC_APP_URL are managed in Vercel and cannot be changed from this page.
            </div>
            <a href="https://vercel.com" target="_blank" rel="noopener noreferrer"
              className="btn btn-secondary btn-sm" style={{textDecoration:"none"}}>
              Open Vercel Dashboard →
            </a>
          </div>
        </>}

        {!["Connections","Danger Zone"].includes(section) && (
          <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:10,marginTop:24,paddingTop:16,borderTop:"1px solid var(--border)"}}>
            {saveMsg && (
              <span style={{fontSize:"0.82rem",fontWeight:500,color:saveMsg.ok?"var(--success)":"var(--danger)",marginRight:"auto"}}>
                {saveMsg.ok?"✓ ":"✗ "}{saveMsg.text}
              </span>
            )}
            <button className="btn btn-secondary" onClick={loadSettings}>Reload from Sheet</button>
            <button className="btn btn-primary" disabled={saving} onClick={save}>
              {saving?<><span className="spinner" style={{marginRight:6}}/>Saving…</>:"Save to Sheet"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}