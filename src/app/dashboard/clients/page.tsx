"use client";

import { useState, useEffect } from "react";
import type { Client } from "@/types";

const AVATAR_COLORS = [
  "linear-gradient(135deg,var(--accent),#00A896)",
  "linear-gradient(135deg,var(--blue),#6B8FFF)",
  "linear-gradient(135deg,var(--gold),#F09F20)",
  "linear-gradient(135deg,var(--danger),#D4375A)",
];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clients").then(r => r.json())
      .then(res => { if (res.ok) setClients(res.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{clients.length} client{clients.length !== 1 ? "s" : ""} registered</p>
        </div>
        <button className="btn btn-primary">
          <PlusIco/> Add Client
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner spinner-lg"/></div>
      ) : clients.length === 0 ? (
        <div className="card card-pad empty-state">
          <div className="empty-icon"><UsersIco/></div>
          <div className="empty-title">No clients yet</div>
          <p className="empty-desc">
            Add clients to the Clients tab in your Google Sheet, then refresh this page.
          </p>
        </div>
      ) : (
        <div className="card" style={{overflow:"hidden"}}>
          {clients.map((c,i) => (
            <div key={c.id} className="post-item" style={{alignItems:"center"}}>
              <div style={{
                width:42,height:42,borderRadius:"var(--radius-sm)",flexShrink:0,
                background:AVATAR_COLORS[i % AVATAR_COLORS.length],
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"var(--font-head)",fontWeight:700,fontSize:"0.85rem",color:"white",
              }}>
                {c.name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
              </div>
              <div className="post-body">
                <div className="post-preview">{c.name}</div>
                <div className="post-meta">
                  <span>{c.email}</span>
                  <span>{c.timezone}</span>
                  <span>{c.platforms.join(", ")}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:20,flexShrink:0,marginRight:"var(--radius-md)"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:700,color:"var(--text-1)"}}>{c.platforms.length}</div>
                  <div style={{fontSize:"0.65rem",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Platforms</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:"var(--font-head)",fontSize:"0.95rem",fontWeight:700,color:c.approvalRequired?"var(--gold)":"var(--accent)"}}>{c.approvalRequired?"Approval":"Auto"}</div>
                  <div style={{fontSize:"0.65rem",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Mode</div>
                </div>
              </div>
              <span className="pill pill-published">Active</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ico = {width:20,height:20,viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const};
function PlusIco()  { return <svg {...ico}><path d="M10 4v12M4 10h12"/></svg>; }
function UsersIco() { return <svg {...ico}><circle cx="8" cy="6" r="3"/><path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/></svg>; }
