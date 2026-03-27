"use client";

import { useState, useEffect } from "react";
import type { AnalyticsRow } from "@/types";

const PLAT_COLORS: Record<string,string> = {
  linkedin:"#0077B5", instagram:"#E1306C",
  facebook:"#1877F2", x:"#888", tiktok:"#69C9D0",
};

const PLATFORMS = ["linkedin","instagram","facebook","x","tiktok"] as const;

export default function AnalyticsPage() {
  const [data,     setData]     = useState<AnalyticsRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [platform, setPlatform] = useState("all");

  useEffect(() => {
    const url = platform !== "all"
      ? `/api/analytics?platform=${platform}&limit=30`
      : "/api/analytics?limit=60";
    setLoading(true);
    fetch(url).then(r => r.json())
      .then(res => { if (res.ok) setData(res.data); })
      .finally(() => setLoading(false));
  }, [platform]);

  const totals = data.reduce((a,r) => ({
    impressions: a.impressions + r.impressions,
    likes:       a.likes       + r.likes,
    comments:    a.comments    + r.comments,
    shares:      a.shares      + r.shares,
  }), { impressions:0, likes:0, comments:0, shares:0 });

  const avgEng = data.length > 0
    ? (data.reduce((s,r) => s + r.engagementRate, 0) / data.length).toFixed(2)
    : "0.00";

  const last7  = [...data].slice(-7);
  const maxImp = Math.max(...last7.map(r => r.impressions), 1);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Data synced daily from your connected platforms via Make.com Scenario 2.</p>
      </div>

      {/* Platform filter */}
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {["all",...PLATFORMS].map(p => (
          <button key={p}
            onClick={() => setPlatform(p)}
            style={{
              padding:"7px 16px", borderRadius:20,
              fontSize:"0.78rem", fontWeight:500,
              border:`1px solid ${platform===p ? (PLAT_COLORS[p]||"var(--accent)") : "var(--border)"}`,
              background: platform===p ? `${PLAT_COLORS[p]||"var(--accent)"}18` : "var(--bg-input)",
              color: platform===p ? (PLAT_COLORS[p]||"var(--accent)") : "var(--text-2)",
              cursor:"pointer", fontFamily:"var(--font-body)",
              transition:"all var(--t-fast) var(--ease)", textTransform:"capitalize",
            }}>
            {p === "all" ? "All Platforms" : p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner spinner-lg"/></div>
      ) : data.length === 0 ? (
        <div className="card card-pad empty-state">
          <div className="empty-icon">
            <ChartIco/>
          </div>
          <div className="empty-title">No analytics data yet</div>
          <p className="empty-desc">Analytics sync daily at 03:00 UTC via Make.com Scenario 2. Data appears here after the first sync following a published post.</p>
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid-3" style={{marginBottom:20}}>
            {[
              { label:"Total Impressions",  value:totals.impressions.toLocaleString(), color:"var(--accent)" },
              { label:"Avg Engagement Rate",value:`${avgEng}%`,                        color:"var(--success)" },
              { label:"Total Likes",         value:totals.likes.toLocaleString(),       color:"var(--gold)" },
            ].map((m,i) => (
              <div key={i} className="card stat-card anim-fade-up">
                <div style={{fontSize:"0.78rem",fontWeight:500,color:"var(--text-2)",marginBottom:8}}>{m.label}</div>
                <div style={{fontFamily:"var(--font-head)",fontSize:"1.7rem",fontWeight:700,letterSpacing:"-0.03em",color:m.color}}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="card card-pad" style={{marginBottom:20}}>
            <div className="card-head">
              <span className="card-title">Impressions — Last {last7.length} Snapshots</span>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",gap:8,height:160,position:"relative"}}>
              <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",height:136,paddingRight:8,flexShrink:0}}>
                {[maxImp,Math.floor(maxImp/2),0].map(v => (
                  <span key={v} style={{fontSize:"0.65rem",color:"var(--text-3)",lineHeight:1}}>
                    {v>999?`${Math.round(v/1000)}k`:v}
                  </span>
                ))}
              </div>
              <div style={{flex:1,display:"flex",alignItems:"flex-end",gap:6,borderBottom:"1px solid var(--border)",paddingBottom:4}}>
                {last7.map((r,i) => {
                  const h = Math.max(4,(r.impressions/maxImp)*128);
                  const c = PLAT_COLORS[r.platform] ?? "var(--accent)";
                  return (
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}
                      title={`${r.date}: ${r.impressions.toLocaleString()}`}>
                      <div style={{width:"100%",height:h,borderRadius:"4px 4px 0 0",background:`linear-gradient(180deg,${c},${c}55)`,transition:"height 0.8s var(--ease)"}}/>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{display:"flex",paddingLeft:40,gap:6,marginTop:6}}>
              {last7.map((r,i) => (
                <span key={i} style={{flex:1,fontSize:"0.65rem",color:"var(--text-3)",textAlign:"center"}}>{r.date.slice(5)}</span>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
              <span className="card-title">Recent Snapshots</span>
            </div>
            <div style={{overflowX:"auto"}}>
              <table className="data-table">
                <thead>
                  <tr>
                    {["Date","Platform","Impressions","Reach","Likes","Comments","Shares","Eng. %","Followers"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().slice(0,20).map((r,i) => (
                    <tr key={i}>
                      <td style={{color:"var(--text-3)"}}>{r.date}</td>
                      <td><span style={{fontSize:"0.72rem",fontWeight:600,padding:"2px 8px",borderRadius:12,background:`${PLAT_COLORS[r.platform]??"#888"}18`,color:PLAT_COLORS[r.platform]??"var(--text-3)",textTransform:"capitalize"}}>{r.platform}</span></td>
                      <td style={{fontWeight:500}}>{r.impressions.toLocaleString()}</td>
                      <td>{r.reach.toLocaleString()}</td>
                      <td>{r.likes.toLocaleString()}</td>
                      <td>{r.comments.toLocaleString()}</td>
                      <td>{r.shares.toLocaleString()}</td>
                      <td style={{color:r.engagementRate>4?"var(--success)":"var(--text-1)",fontWeight:600}}>{r.engagementRate.toFixed(2)}%</td>
                      <td>{r.followerCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const ico = {width:24,height:24,viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeWidth:1.6,strokeLinecap:"round" as const};
function ChartIco() { return <svg {...ico}><path d="M2 14l4-5 4 3 4-6 4 2"/><path d="M2 18h16"/></svg>; }
