"use client";

import { useState, useEffect } from "react";
import type { AnalyticsRow } from "@/types";

const PLATFORMS = ["linkedin", "instagram", "facebook", "x", "tiktok"] as const;
const PLAT_COLORS: Record<string, string> = {
  linkedin: "#0077B5", instagram: "#E1306C", facebook: "#1877F2", x: "#888", tiktok: "#69C9D0",
};

export default function AnalyticsPage() {
  const [data, setData]       = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<string>("all");

  useEffect(() => {
    const url = platform !== "all" ? `/api/analytics?platform=${platform}&limit=30` : "/api/analytics?limit=60";
    fetch(url).then(r => r.json()).then(res => { if (res.ok) setData(res.data); }).finally(() => setLoading(false));
  }, [platform]);

  // Computed totals
  const totals = data.reduce((acc, r) => ({
    impressions: acc.impressions + r.impressions,
    reach:       acc.reach       + r.reach,
    likes:       acc.likes       + r.likes,
    comments:    acc.comments    + r.comments,
    shares:      acc.shares      + r.shares,
  }), { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0 });

  const avgEngagement = data.length > 0
    ? (data.reduce((s, r) => s + r.engagementRate, 0) / data.length).toFixed(2)
    : "0.00";

  // Chart — last 7 days of impressions
  const last7 = [...data].slice(-7);
  const maxImp = Math.max(...last7.map(r => r.impressions), 1);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-head)", fontSize: "1.1rem", fontWeight: 600, marginBottom: 4 }}>Analytics</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Data pulled from your Google Sheet — synced daily by Make.com Scenario 2.</p>
      </div>

      {/* Platform filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", ...PLATFORMS].map(p => (
          <button key={p} onClick={() => setPlatform(p)} style={{ padding: "7px 16px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 500, border: `1px solid ${platform === p ? (PLAT_COLORS[p] || "var(--accent)") : "var(--border)"}`, background: platform === p ? `${PLAT_COLORS[p] || "var(--accent)"}18` : "var(--bg-input)", color: platform === p ? (PLAT_COLORS[p] || "var(--accent)") : "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 0.15s", textTransform: "capitalize" }}>
            {p === "all" ? "All Platforms" : p}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading analytics…</div>
      ) : data.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 48, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>No analytics data yet</div>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.7 }}>Analytics are synced daily by Make.com Scenario 2.<br />Data will appear here once posts have been published and synced.</p>
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
            {[
              { label: "Total Impressions", value: totals.impressions.toLocaleString(), accent: "var(--accent)" },
              { label: "Avg Engagement Rate", value: avgEngagement + "%", accent: "var(--accent2)" },
              { label: "Total Likes", value: totals.likes.toLocaleString(), accent: "var(--accent3)" },
            ].map((m, i) => (
              <div key={i} style={{ background: "var(--bg-card)", backdropFilter: "blur(16px)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 20 }} className={`anim-fade-up stagger-${i + 1}`}>
                <div style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>{m.label}</div>
                <div style={{ fontFamily: "var(--font-head)", fontSize: "1.7rem", fontWeight: 700, letterSpacing: "-0.03em", color: m.accent }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div style={{ background: "var(--bg-card)", backdropFilter: "blur(16px)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 600, marginBottom: 20 }}>Impressions — Last {last7.length} Snapshots</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 160, paddingBottom: 24, position: "relative" }}>
              {/* Y-axis labels */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 136, paddingRight: 8, flexShrink: 0 }}>
                {[maxImp, Math.floor(maxImp / 2), 0].map(v => <span key={v} style={{ fontSize: "0.65rem", color: "var(--text-muted)", lineHeight: 1 }}>{v > 999 ? `${Math.round(v/1000)}k` : v}</span>)}
              </div>
              {/* Bars */}
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
                {last7.map((r, i) => {
                  const h = Math.max(4, (r.impressions / maxImp) * 128);
                  const color = PLAT_COLORS[r.platform] ?? "var(--accent)";
                  return (
                    <div key={i} title={`${r.date}: ${r.impressions.toLocaleString()} impressions`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "default" }}>
                      <div style={{ width: "100%", height: h, borderRadius: "4px 4px 0 0", background: `linear-gradient(180deg,${color},${color}66)`, transition: "height 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
                    </div>
                  );
                })}
              </div>
            </div>
            {/* X labels */}
            <div style={{ display: "flex", paddingLeft: 40, gap: 6 }}>
              {last7.map((r, i) => <span key={i} style={{ flex: 1, fontSize: "0.65rem", color: "var(--text-muted)", textAlign: "center" }}>{r.date.slice(5)}</span>)}
            </div>
          </div>

          {/* Data table */}
          <div style={{ background: "var(--bg-card)", backdropFilter: "blur(16px)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "var(--font-head)", fontSize: "0.95rem", fontWeight: 600 }}>Recent Snapshots</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ background: "var(--bg-input)" }}>
                    {["Date", "Platform", "Impressions", "Reach", "Likes", "Comments", "Shares", "Eng. Rate", "Followers"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().slice(0, 20).map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{r.date}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: `${PLAT_COLORS[r.platform] ?? "#888"}18`, color: PLAT_COLORS[r.platform] ?? "var(--text-muted)", textTransform: "capitalize" }}>{r.platform}</span></td>
                      <td style={{ padding: "10px 14px", fontWeight: 500 }}>{r.impressions.toLocaleString()}</td>
                      <td style={{ padding: "10px 14px" }}>{r.reach.toLocaleString()}</td>
                      <td style={{ padding: "10px 14px" }}>{r.likes.toLocaleString()}</td>
                      <td style={{ padding: "10px 14px" }}>{r.comments.toLocaleString()}</td>
                      <td style={{ padding: "10px 14px" }}>{r.shares.toLocaleString()}</td>
                      <td style={{ padding: "10px 14px", color: r.engagementRate > 4 ? "var(--accent2)" : "var(--text-primary)", fontWeight: 600 }}>{r.engagementRate.toFixed(2)}%</td>
                      <td style={{ padding: "10px 14px" }}>{r.followerCount.toLocaleString()}</td>
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
