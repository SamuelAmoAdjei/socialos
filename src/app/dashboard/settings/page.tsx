"use client";

import { useState } from "react";

const CONNECTIONS = [
  { id: "linkedin",  label: "LinkedIn",  color: "#0077B5", bg: "rgba(0,119,181,0.12)", status: "connected",    note: "Acme Corp — connected"        },
  { id: "instagram", label: "Instagram", color: "#E1306C", bg: "rgba(225,48,108,0.1)", status: "connected",    note: "acmecorp — connected"          },
  { id: "facebook",  label: "Facebook",  color: "#1877F2", bg: "rgba(24,119,242,0.1)", status: "connected",    note: "Acme Corp Page — connected"   },
  { id: "x",         label: "X",         color: "#888",    bg: "rgba(255,255,255,0.06)", status: "connected",  note: "@acmecorp — connected"        },
  { id: "tiktok",    label: "TikTok",    color: "#69C9D0", bg: "rgba(0,0,0,0.15)",    status: "disconnected", note: "Not connected"                },
];

const SETTINGS_NAV = ["General", "Connections", "Automation", "Make.com", "Danger Zone"];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("General");
  const [webhookUrl,    setWebhookUrl]    = useState("");
  const [callbackUrl,   setCallbackUrl]   = useState("");
  const [callbackSecret,setCallbackSecret]= useState("");
  const [toggles, setToggles] = useState({
    approvalRequired: true,
    gmailConfirmation: true,
    autoRetry: true,
    analyticsSync: true,
  });
  const [saved, setSaved] = useState(false);

  function saveSettings() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const formInput: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: "0.85rem" };
  const label: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, display: "block" };
  const card: React.CSSProperties = { background: "var(--bg-card)", backdropFilter: "blur(16px)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24 };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, alignItems: "start" }}>

      {/* Sidebar nav */}
      <div style={{ ...card, padding: 12, position: "sticky", top: 80 }}>
        {SETTINGS_NAV.map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer", background: activeSection === s ? "rgba(79,142,247,0.1)" : "none", color: activeSection === s ? "var(--accent)" : "var(--text-secondary)", border: "none", fontFamily: "var(--font-body)", marginBottom: 2, transition: "all 0.15s" }}>
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={card}>
        {activeSection === "General" && (
          <>
            <div style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 600, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>Your Profile</div>
            <div style={{ marginBottom: 16 }}><label style={label}>Your name</label><input style={formInput} defaultValue="VA Manager" /></div>
            <div style={{ marginBottom: 16 }}><label style={label}>Email address</label><input style={formInput} defaultValue="va@socialos.app" /></div>
            <div style={{ marginBottom: 16 }}><label style={label}>Default timezone</label>
              <select style={formInput}><option>America/New_York (EST)</option><option>Europe/London (GMT)</option><option>America/Los_Angeles (PST)</option><option>Africa/Lagos (WAT)</option></select>
            </div>
            <div style={{ marginBottom: 16 }}><label style={label}>Active Google Sheet ID</label>
              <input style={formInput} placeholder="Paste your Google Sheet ID from the URL" />
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 5 }}>Found in the sheet URL: docs.google.com/spreadsheets/d/<strong>SHEET_ID</strong>/edit</p>
            </div>
          </>
        )}

        {activeSection === "Connections" && (
          <>
            <div style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 600, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>Platform Connections via Make.com</div>
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(79,142,247,0.06)", border: "1px solid rgba(79,142,247,0.2)", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Connections are managed in your Make.com account. Click "Manage in Make.com" to add or revoke platform access. Your client must authorise each platform once via OAuth.
            </div>
            {CONNECTIONS.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", marginBottom: 10, transition: "border-color 0.15s" }}>
                <div style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, color: c.color }}>{c.id.substring(0, 2).toUpperCase()}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: 2 }}>{c.label}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{c.note}</div>
                </div>
                <button style={{ padding: "6px 14px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600, border: `1px solid ${c.status === "connected" ? "var(--accent2)" : "var(--accent)"}`, color: c.status === "connected" ? "var(--accent2)" : "var(--accent)", background: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}>
                  {c.status === "connected" ? "Connected" : "Connect"}
                </button>
              </div>
            ))}
          </>
        )}

        {activeSection === "Automation" && (
          <>
            <div style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 600, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>Automation Settings</div>
            {[
              { key: "approvalRequired", label: "Require client approval before publishing", desc: "Posts stay in pending state until client approves via email link" },
              { key: "gmailConfirmation", label: "Send Gmail confirmation after publish", desc: "You and the client receive an email with links to the live posts" },
              { key: "autoRetry", label: "Auto-retry failed posts", desc: "Retry up to 3 times if Make.com encounters a platform error" },
              { key: "analyticsSync", label: "Daily analytics sync", desc: "Make.com Scenario 2 fetches platform metrics at 03:00 UTC each morning" },
            ].map(t => (
              <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: 3 }}>{t.label}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{t.desc}</div>
                </div>
                <div onClick={() => setToggles(p => ({ ...p, [t.key]: !p[t.key as keyof typeof p] }))}
                  style={{ width: 40, height: 22, borderRadius: 11, background: toggles[t.key as keyof typeof toggles] ? "var(--accent)" : "var(--bg-input)", border: `1px solid ${toggles[t.key as keyof typeof toggles] ? "var(--accent)" : "var(--border)"}`, position: "relative", cursor: "pointer", transition: "all 0.2s", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 2, left: toggles[t.key as keyof typeof toggles] ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
                </div>
              </div>
            ))}
          </>
        )}

        {activeSection === "Make.com" && (
          <>
            <div style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 600, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>Make.com Integration</div>
            <div style={{ marginBottom: 18 }}><label style={label}>Scenario 1 Webhook URL (Post Publisher)</label><input style={formInput} value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hook.eu1.make.com/…" /><p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 5 }}>Paste the webhook URL from your Make.com Scenario 1 trigger module.</p></div>
            <div style={{ marginBottom: 18 }}><label style={label}>Callback URL (for Make.com to call back)</label>
              <div style={{ ...formInput, background: "var(--bg-surface)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", userSelect: "all" as const }}>
                {typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"}/api/publish/callback
              </div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 5 }}>Add this URL to the HTTP module at the end of your Make.com Scenario 1.</p>
            </div>
            <div style={{ marginBottom: 18 }}><label style={label}>Callback Secret (optional but recommended)</label><input style={formInput} type="password" value={callbackSecret} onChange={e => setCallbackSecret(e.target.value)} placeholder="A secret string to verify Make.com callbacks" /><p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 5 }}>Set this in Make.com HTTP module header as: x-socialos-secret</p></div>
            <div style={{ padding: "12px 14px", background: "rgba(6,214,160,0.06)", border: "1px solid rgba(6,214,160,0.2)", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--accent2)" }}>Ops budget:</strong> ~600 ops/month for 1 client posting 2x/day on 3 platforms. Free tier limit: 1,000 ops/month. Upgrade to Make.com Core ($9/month) when adding a second client.
            </div>
          </>
        )}

        {activeSection === "Danger Zone" && (
          <>
            <div style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 600, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid rgba(255,77,109,0.3)", color: "var(--danger)" }}>Danger Zone</div>
            <div style={{ padding: 16, border: "1px solid rgba(255,77,109,0.3)", borderRadius: "var(--radius-md)", marginBottom: 12 }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: 4 }}>Revoke Google access</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 12 }}>This will sign you out and remove Google Sheets/Drive access. You will need to sign in again.</div>
              <button style={{ padding: "8px 16px", background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)", borderRadius: "var(--radius-sm)", color: "var(--danger)", fontSize: "0.8rem", cursor: "pointer", fontFamily: "var(--font-body)" }}>Revoke Access</button>
            </div>
          </>
        )}

        {/* Save button */}
        {activeSection !== "Danger Zone" && activeSection !== "Connections" && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
            <button style={{ padding: "10px 18px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "0.82rem", cursor: "pointer", fontFamily: "var(--font-body)" }}>Reset</button>
            <button onClick={saveSettings} style={{ padding: "10px 22px", background: saved ? "linear-gradient(135deg,var(--accent2),#04A885)" : "linear-gradient(135deg,var(--accent),#6B8FFF)", color: "white", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 0.3s" }}>
              {saved ? "Saved" : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
