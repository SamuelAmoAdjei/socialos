"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      const result = await signIn("google", {
        callbackUrl: "/dashboard",
        redirect: false,
      });
      if (result?.error) {
        setError("Sign in failed. Please try again.");
        setLoading(false);
      }
      // on success NextAuth will redirect to /dashboard via callbackUrl
    } catch {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <main style={styles.page}>
        <div style={styles.spinner} />
      </main>
    );
  }

  return (
    <main style={styles.page}>
      {/* Background accent blobs */}
      <div style={styles.blob1} />
      <div style={styles.blob2} />

      <div style={styles.card} className="anim-scale-in">
        {/* Logo */}
        <div style={styles.logoRow}>
          <div style={styles.logoMark}>
            <LogoIcon />
          </div>
          <span style={styles.logoText}>
            Social<span style={{ color: "var(--accent)" }}>OS</span>
          </span>
        </div>

        <div style={styles.divider} />

        {/* Heading */}
        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.subheading}>
          Sign in with your Google account to access the VA dashboard.
        </p>

        {/* Error */}
        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Google sign-in button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            ...styles.googleBtn,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? (
            <span style={styles.btnSpinner} />
          ) : (
            <GoogleIcon />
          )}
          <span>{loading ? "Signing in…" : "Continue with Google"}</span>
        </button>

        {/* Footer note */}
        <p style={styles.footerNote}>
          Your Google credentials are never stored by SocialOS. Authentication
          is handled securely by NextAuth.
        </p>

        {/* Scope note */}
        <div style={styles.scopeBox}>
          <ScopeIcon />
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Google Sheets and Drive access will be requested so SocialOS can
            read your post queue and store media. You can revoke this at any
            time in your Google Account settings.
          </span>
        </div>
      </div>

      {/* Version tag */}
      <p style={styles.version}>SocialOS v1.0 — Foundation</p>
    </main>
  );
}

/* ── Sub-components ── */

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
      stroke="white" strokeWidth="2" strokeLinecap="round">
      <path d="M10 2L18 6v8l-8 4-8-4V6z" />
      <path d="M10 2v12M2 6l8 4 8-4" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function ScopeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
      stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round"
      style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v5M10 14v.5" />
    </svg>
  );
}

/* ── Inline styles (no Tailwind dependency at this stage) ── */
const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    zIndex: 1,
  },
  blob1: {
    position: "fixed",
    top: "-10%",
    left: "-10%",
    width: "50vw",
    height: "50vw",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(79,142,247,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  blob2: {
    position: "fixed",
    bottom: "-10%",
    right: "-10%",
    width: "40vw",
    height: "40vw",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,214,160,0.08) 0%, transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  card: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: "440px",
    background: "var(--bg-glass)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "2.5rem 2rem",
    boxShadow: "var(--shadow-lg)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "1.5rem",
  },
  logoMark: {
    width: "40px",
    height: "40px",
    borderRadius: "11px",
    background: "linear-gradient(135deg, var(--accent), var(--accent2))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(79,142,247,0.35)",
    flexShrink: 0,
  },
  logoText: {
    fontFamily: "var(--font-head)",
    fontWeight: 700,
    fontSize: "1.3rem",
    letterSpacing: "-0.02em",
    color: "var(--text-primary)",
  },
  divider: {
    height: "1px",
    background: "var(--border)",
    marginBottom: "1.5rem",
  },
  heading: {
    fontFamily: "var(--font-head)",
    fontSize: "1.5rem",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "var(--text-primary)",
    marginBottom: "0.5rem",
  },
  subheading: {
    fontSize: "0.875rem",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    marginBottom: "1.75rem",
  },
  errorBox: {
    padding: "0.75rem 1rem",
    background: "rgba(255,77,109,0.1)",
    border: "1px solid rgba(255,77,109,0.3)",
    borderRadius: "var(--radius-sm)",
    color: "var(--danger)",
    fontSize: "0.82rem",
    marginBottom: "1rem",
  },
  googleBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "0.875rem 1.25rem",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-primary)",
    fontSize: "0.9rem",
    fontWeight: 500,
    fontFamily: "var(--font-body)",
    transition: "all var(--t) var(--ease)",
    boxShadow: "var(--shadow-sm)",
    marginBottom: "1.5rem",
  },
  footerNote: {
    fontSize: "0.72rem",
    color: "var(--text-muted)",
    lineHeight: 1.6,
    marginBottom: "1rem",
    textAlign: "center",
  },
  scopeBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "0.75rem",
    background: "var(--bg-input)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  spinner: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "3px solid var(--border)",
    borderTopColor: "var(--accent)",
    animation: "spin 0.7s linear infinite",
  },
  btnSpinner: {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    border: "2px solid var(--border)",
    borderTopColor: "var(--accent)",
    display: "inline-block",
    animation: "spin 0.7s linear infinite",
  },
  version: {
    marginTop: "2rem",
    fontSize: "0.72rem",
    color: "var(--text-muted)",
    zIndex: 1,
    position: "relative",
  },
};
