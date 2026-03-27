"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      const result = await signIn("google", { callbackUrl:"/dashboard", redirect:false });
      if (result?.error) {
        setError("Sign in failed. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <main style={S.page}>
        <div className="spinner spinner-lg" />
      </main>
    );
  }

  return (
    <main style={S.page}>
      {/* Gradient blobs */}
      <div style={S.blob1} />
      <div style={S.blob2} />

      <div className="anim-scale-in" style={S.card}>
        {/* Logo */}
        <div style={S.logoRow}>
          <div style={S.logoMark}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
              stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <path d="M10 2L18 6v8l-8 4-8-4V6z" />
              <path d="M10 2v12M2 6l8 4 8-4" />
            </svg>
          </div>
          <span style={S.logoText}>
            Social<em style={{ color:"var(--accent)", fontStyle:"normal" }}>OS</em>
          </span>
        </div>

        <div style={S.divider} />

        <h1 style={S.heading}>Welcome back</h1>
        <p  style={S.subheading}>
          Sign in with your Google account to access the VA dashboard.
        </p>

        {error && <div style={S.errorBox}>{error}</div>}

        {/* Google sign-in button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{ ...S.googleBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? <span className="spinner" /> : <GoogleIcon />}
          <span>{loading ? "Signing in…" : "Continue with Google"}</span>
        </button>

        <p style={S.footerNote}>
          Your credentials are never stored by SocialOS.
          Authentication is handled securely by NextAuth.
        </p>

        <div style={S.scopeBox}>
          <InfoIcon />
          <span style={{ fontSize:"0.72rem", color:"var(--text-3)", lineHeight:1.5 }}>
            Google Sheets and Drive access will be requested so SocialOS can
            read your post queue. You can revoke this at any time in your Google
            Account settings.
          </span>
        </div>
      </div>

      <p style={S.version}>SocialOS VA Dashboard</p>
    </main>
  );
}

/* ── Icons ── */
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
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
      stroke="var(--text-3)" strokeWidth="1.6" strokeLinecap="round"
      style={{ flexShrink:0, marginTop:2 }}>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v5M10 14v.5" />
    </svg>
  );
}

/* ── Styles — all using CSS variables, no hardcoded numbers ── */
const S: Record<string, React.CSSProperties> = {
  page: {
    position:"relative", minHeight:"100vh",
    display:"flex", flexDirection:"column",
    alignItems:"center", justifyContent:"center",
    padding:"2rem 1rem", zIndex:1,
  },
  blob1: {
    position:"fixed", top:"-10%", left:"-10%",
    width:"50vw", height:"50vw", borderRadius:"50%",
    background:"radial-gradient(circle, rgba(0,194,168,0.10) 0%, transparent 70%)",
    pointerEvents:"none", zIndex:0,
  },
  blob2: {
    position:"fixed", bottom:"-10%", right:"-10%",
    width:"40vw", height:"40vw", borderRadius:"50%",
    background:"radial-gradient(circle, rgba(79,142,247,0.08) 0%, transparent 70%)",
    pointerEvents:"none", zIndex:0,
  },
  card: {
    position:"relative", zIndex:1,
    width:"100%", maxWidth:"440px",
    background:"var(--bg-glass)",
    backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
    border:"1px solid var(--border)",
    borderRadius:"var(--radius-xl)",
    padding:"2.5rem 2rem",
    boxShadow:"var(--shadow-lg)",
  },
  logoRow:   { display:"flex", alignItems:"center", gap:"10px", marginBottom:"1.5rem" },
  logoMark:  {
    width:"40px", height:"40px", borderRadius:"11px", flexShrink:0,
    background:"linear-gradient(135deg, var(--accent), #00A896)",
    display:"flex", alignItems:"center", justifyContent:"center",
    boxShadow:"0 4px 16px var(--accent-glow)",
  },
  logoText:  { fontFamily:"var(--font-head)", fontWeight:700, fontSize:"1.3rem", letterSpacing:"-0.02em", color:"var(--text-1)" },
  divider:   { height:"1px", background:"var(--border)", marginBottom:"1.5rem" },
  heading:   { fontFamily:"var(--font-head)", fontSize:"1.5rem", fontWeight:600, letterSpacing:"-0.02em", color:"var(--text-1)", marginBottom:"0.5rem" },
  subheading:{ fontSize:"0.875rem", color:"var(--text-2)", lineHeight:1.6, marginBottom:"1.75rem" },
  errorBox:  {
    padding:"0.75rem 1rem",
    background:"var(--danger-dim)", border:"1px solid rgba(239,68,68,0.3)",
    borderRadius:"var(--radius-sm)", color:"var(--danger)",
    fontSize:"0.82rem", marginBottom:"1rem",
  },
  googleBtn: {
    width:"100%", display:"flex", alignItems:"center",
    justifyContent:"center", gap:"12px",
    padding:"0.875rem 1.25rem",
    background:"var(--bg-surface)", border:"1px solid var(--border)",
    borderRadius:"var(--radius-md)",
    color:"var(--text-1)", fontSize:"0.9rem", fontWeight:500,
    fontFamily:"var(--font-body)",
    transition:"all var(--t-base) var(--ease)",
    boxShadow:"var(--shadow-sm)", marginBottom:"1.5rem",
  },
  footerNote:{ fontSize:"0.72rem", color:"var(--text-3)", lineHeight:1.6, marginBottom:"1rem", textAlign:"center" },
  scopeBox:  {
    display:"flex", alignItems:"flex-start", gap:"8px",
    padding:"0.75rem", background:"var(--bg-input)",
    borderRadius:"var(--radius-sm)", border:"1px solid var(--border)",
  },
  version:   { marginTop:"2rem", fontSize:"0.72rem", color:"var(--text-3)", zIndex:1, position:"relative" },
};
