"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DraftRow = {
  rowIndex: number;
  docLink: string;
  title: string;
  platforms: string;
  targetDate: string;
  stage: string;
  notes: string;
};

export default function TopicsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/drafts")
      .then((r) => r.json())
      .then((res) => {
        if (res.ok && Array.isArray(res.data)) setRows(res.data);
        else setToast(res.error || "Failed to load topics");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 600,
            padding: "12px 20px",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-card)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "var(--danger)",
            fontSize: "0.85rem",
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="page-title">Client topics & ideas</h1>
          <p className="page-subtitle">
            Rows from your Google Sheet &quot;Drafts&quot; tab (submitted via client portal or
            Apps Script).
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" type="button" onClick={load}>
            Refresh
          </button>
          <button className="btn btn-primary" type="button" onClick={() => router.push("/dashboard/compose")}>
            New post
          </button>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {loading && (
          <div className="empty-state">
            <div className="spinner spinner-lg" />
            <p style={{ marginTop: 16, color: "var(--text-3)" }}>Loading Drafts tab…</p>
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="empty-state">
            <div className="empty-title">No topic rows yet</div>
            <p className="empty-desc">
              When clients submit topic ideas, they appear here. Ensure your sheet has a
              &quot;Drafts&quot; tab and Apps Script handles topic submissions.
            </p>
          </div>
        )}
        {!loading &&
          rows.map((r, i) => (
            <div
              key={`${r.rowIndex}-${i}`}
              style={{
                padding: "14px 20px",
                borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--text-1)", marginBottom: 6 }}>
                {r.title || "(no title)"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginBottom: 8 }}>
                Platforms: {r.platforms || "—"} · Stage: {r.stage || "—"} · Row {r.rowIndex}
              </div>
              {r.notes && (
                <div style={{ fontSize: "0.82rem", color: "var(--text-2)", lineHeight: 1.6 }}>
                  {r.notes}
                </div>
              )}
              {r.docLink && (
                <a
                  href={r.docLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "0.78rem", color: "var(--accent)" }}
                >
                  Media / link
                </a>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
