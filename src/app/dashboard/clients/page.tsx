"use client";

import { useState, useEffect } from "react";
import type { Client } from "@/types";

const GRAD = ["linear-gradient(135deg,#4F8EF7,#6B8FFF)", "linear-gradient(135deg,#06D6A0,#04A885)", "linear-gradient(135deg,#F7C948,#F09F20)", "linear-gradient(135deg,#FF4D6D,#D4375A)"];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(res => { if (res.ok) setClients(res.data); }).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: "1.1rem", fontWeight: 600, marginBottom: 3 }}>Clients</h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{clients.length} client{clients.length !== 1 ? "s" : ""} registered</p>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "linear-gradient(135deg,var(--accent),#6B8FFF)", color: "white", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)", boxShadow: "0 4px 16px rgba(79,142,247,0.3)" }}>
          + Add Client
        </button>
      </div>

      {loading ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading clients…</div>
      ) : clients.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 48, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>No clients yet</div>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.7 }}>Add clients to the Clients tab in your Google Sheet,<br />then refresh this page.</p>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", backdropFilter: "blur(16px)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {clients.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: i < clients.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <div style={{ width: 42, height: 42, borderRadius: "var(--radius-sm)", background: GRAD[i % GRAD.length], display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "0.85rem", color: "white", flexShrink: 0 }}>
                {c.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{c.email} · {c.timezone} · {c.platforms.join(", ")}</div>
              </div>
              <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}><div style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 700 }}>{c.platforms.length}</div><div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Platforms</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 700, color: c.approvalRequired ? "var(--accent3)" : "var(--accent2)" }}>{c.approvalRequired ? "Approval" : "Auto"}</div><div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mode</div></div>
              </div>
              <div style={{ fontSize: "0.68rem", fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "rgba(6,214,160,0.12)", color: "var(--accent2)", flexShrink: 0 }}>Active</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
