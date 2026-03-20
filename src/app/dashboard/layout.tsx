"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, createContext, useContext } from "react";

/* ── Theme context so children can toggle dark / light ── */
type Theme = "dark" | "light";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});
export const useTheme = () => useContext(ThemeCtx);

/* ── Nav definition ── */
const NAV = [
  {
    group: "Overview",
    items: [
      { label: "Dashboard",    href: "/dashboard",            icon: GridIcon },
      { label: "Compose",      href: "/dashboard/compose",    icon: EditIcon },
    ],
  },
  {
    group: "Publishing",
    items: [
      { label: "Schedule",     href: "/dashboard/schedule",   icon: CalIcon,    badge: "4" },
      { label: "Analytics",    href: "/dashboard/analytics",  icon: ChartIcon },
    ],
  },
  {
    group: "Management",
    items: [
      { label: "Clients",      href: "/dashboard/clients",    icon: UsersIcon },
      { label: "Settings",     href: "/dashboard/settings",   icon: CogIcon },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router  = useRouter();
  const path    = usePathname();
  const [theme, setTheme] = useState<Theme>("dark");
  const [notifOpen, setNotifOpen] = useState(false);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <Spinner />
      </div>
    );
  }

  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark");
  const userName = session.user?.name ?? "VA";
  const initials = userName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  // Current page title
  const pageTitle = (() => {
    const flat = NAV.flatMap(g => g.items);
    const match = [...flat].sort((a, b) => b.href.length - a.href.length)
      .find(i => path.startsWith(i.href));
    return match ? match.label : "Dashboard";
  })();

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <div style={{ display: "flex", minHeight: "100vh", position: "relative", zIndex: 1 }}>

        {/* ── SIDEBAR ── */}
        <aside style={S.sidebar} className="glass">
          {/* Logo */}
          <div style={S.sidebarLogo}>
            <div style={S.logoMark}>
              <LogoIcon />
            </div>
            <span style={S.logoText}>
              Social<span style={{ color: "var(--accent)" }}>OS</span>
            </span>
          </div>

          {/* Nav */}
          <nav style={S.nav}>
            {NAV.map(group => (
              <div key={group.group}>
                <div style={S.navGroup}>{group.group}</div>
                {group.items.map(item => {
                  const active = path === item.href ||
                    (item.href !== "/dashboard" && path.startsWith(item.href));
                  return (
                    <button
                      key={item.href}
                      onClick={() => router.push(item.href)}
                      style={{
                        ...S.navItem,
                        ...(active ? S.navItemActive : {}),
                      }}
                    >
                      {active && <div style={S.activeLine} />}
                      <item.icon active={active} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge && (
                        <span style={S.badge}>{item.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Client selector */}
          <div style={S.sidebarBottom}>
            <div style={S.clientCard}>
              <div style={S.clientLabel}>Active Client</div>
              <select style={S.clientSelect}>
                <option>Acme Corp</option>
                <option>Nova Brands</option>
                <option>Petal Studio</option>
                <option>+ Add New Client</option>
              </select>
              <div style={S.statusRow}>
                <div style={S.statusDot} />
                <span style={S.statusText}>3 posts scheduled this week</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={S.main}>

          {/* Topbar */}
          <header style={S.topbar} className="glass">
            <h1 style={S.topbarTitle}>
              {pageTitle}{" "}
              <span style={{ fontWeight: 300, color: "var(--text-secondary)" }}>
                / {path === "/dashboard" ? "Overview" : pageTitle}
              </span>
            </h1>

            <div style={S.topbarActions}>
              {/* Theme toggle */}
              <div style={S.themeToggle}>
                <button
                  onClick={() => setTheme("dark")}
                  style={{ ...S.themeBtn, ...(theme === "dark" ? S.themeBtnActive : {}) }}
                  aria-label="Dark mode"
                >
                  <MoonIcon />
                </button>
                <button
                  onClick={() => setTheme("light")}
                  style={{ ...S.themeBtn, ...(theme === "light" ? S.themeBtnActive : {}) }}
                  aria-label="Light mode"
                >
                  <SunIcon />
                </button>
              </div>

              {/* Notifications */}
              <button
                style={S.iconBtn}
                onClick={() => setNotifOpen(o => !o)}
                aria-label="Notifications"
              >
                <BellIcon />
                <span style={S.notifDot} />
              </button>

              {/* Avatar */}
              <div style={S.avatar} title={userName}>
                {initials}
              </div>

              {/* Sign out */}
              <button
                style={S.signOutBtn}
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              >
                Sign out
              </button>
            </div>
          </header>

          {/* Notification dropdown */}
          {notifOpen && (
            <div style={S.notifPanel} className="glass anim-fade-in">
              <div style={S.notifHead}>
                <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "0.9rem" }}>
                  Notifications
                </span>
                <button style={{ fontSize: "0.72rem", color: "var(--accent)", cursor: "pointer", background: "none", border: "none" }}
                  onClick={() => setNotifOpen(false)}>
                  Clear all
                </button>
              </div>
              {NOTIFS.map((n, i) => (
                <div key={i} style={S.notifItem}>
                  <div style={{ ...S.notifIcon, background: n.iconBg, color: n.iconColor }}>
                    <n.icon />
                  </div>
                  <div>
                    <p style={{ fontSize: "0.8rem", lineHeight: 1.45 }}>{n.msg}</p>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 3 }}>{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Page content */}
          <div style={S.pageContent}>
            {children}
          </div>
        </main>
      </div>
    </ThemeCtx.Provider>
  );
}

/* ── Notification data ── */
const NOTIFS = [
  { msg: "Post published to LinkedIn and Instagram for Acme Corp", time: "2 minutes ago",
    iconBg: "rgba(6,214,160,0.12)", iconColor: "var(--accent2)", icon: CheckIcon },
  { msg: "Nova Brands has approved 2 draft posts", time: "1 hour ago",
    iconBg: "rgba(79,142,247,0.12)", iconColor: "var(--accent)", icon: InfoIcon },
  { msg: "Petal Studio — X connection requires re-authorisation", time: "3 hours ago",
    iconBg: "rgba(247,201,72,0.12)", iconColor: "var(--accent3)", icon: WarnIcon },
];

/* ── Icon components ── */
const iconProps = { width: 17, height: 17, viewBox: "0 0 20 20", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const };

function GridIcon({ active }: { active?: boolean }) {
  return <svg {...iconProps} style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}>
    <rect x="2" y="2" width="7" height="7" rx="2"/>
    <rect x="11" y="2" width="7" height="7" rx="2"/>
    <rect x="2" y="11" width="7" height="7" rx="2"/>
    <rect x="11" y="11" width="7" height="7" rx="2"/>
  </svg>;
}
function EditIcon({ active }: { active?: boolean }) {
  return <svg {...iconProps} style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}>
    <path d="M14 2l4 4-10 10H4v-4L14 2z"/><path d="M12 4l4 4"/>
  </svg>;
}
function CalIcon({ active }: { active?: boolean }) {
  return <svg {...iconProps} style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}>
    <rect x="2" y="4" width="16" height="14" rx="2"/><path d="M14 2v4M6 2v4M2 8h16"/>
  </svg>;
}
function ChartIcon({ active }: { active?: boolean }) {
  return <svg {...iconProps} style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}>
    <path d="M2 14l4-5 4 3 4-6 4 2"/><path d="M2 18h16"/>
  </svg>;
}
function UsersIcon({ active }: { active?: boolean }) {
  return <svg {...iconProps} style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}>
    <circle cx="8" cy="6" r="3"/><path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/>
    <path d="M14 8a3 3 0 010 5.2M17 18c0-2.5-1-4.3-3-5.2"/>
  </svg>;
}
function CogIcon({ active }: { active?: boolean }) {
  return <svg {...iconProps} style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}>
    <circle cx="10" cy="10" r="3"/>
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/>
  </svg>;
}
function LogoIcon() {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <path d="M10 2L18 6v8l-8 4-8-4V6z"/><path d="M10 2v12M2 6l8 4 8-4"/>
  </svg>;
}
function BellIcon() {
  return <svg {...iconProps}>
    <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z"/>
    <path d="M8 16a2 2 0 004 0"/>
  </svg>;
}
function MoonIcon() {
  return <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
    <path d="M17.3 13.35A7 7 0 017.65 2.7a8 8 0 1010.65 10.65z"/>
  </svg>;
}
function SunIcon() {
  return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="10" cy="10" r="4"/>
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4"/>
  </svg>;
}
function CheckIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 10l4 4 8-8"/>
  </svg>;
}
function InfoIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="10" cy="10" r="8"/><path d="M10 6v5M10 14v.5"/>
  </svg>;
}
function WarnIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M10 2L2 17h16L10 2z"/><path d="M10 9v4M10 14.5v.5"/>
  </svg>;
}
function Spinner() {
  return <div style={{
    width: 32, height: 32, borderRadius: "50%",
    border: "3px solid var(--border)", borderTopColor: "var(--accent)",
    animation: "spin 0.7s linear infinite",
  }}/>;
}

/* ── Styles ── */
const S: Record<string, React.CSSProperties> = {
  sidebar: {
    width: "var(--sidebar-w)",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    top: 0, left: 0, bottom: 0,
    zIndex: 100,
  },
  sidebarLogo: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "24px 20px 20px",
    borderBottom: "1px solid var(--border)",
  },
  logoMark: {
    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
    background: "linear-gradient(135deg, var(--accent), var(--accent2))",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 16px rgba(79,142,247,0.35)",
  },
  logoText: {
    fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1.1rem",
    letterSpacing: "-0.02em", color: "var(--text-primary)",
  },
  nav: { flex: 1, padding: "16px 12px", overflowY: "auto" },
  navGroup: {
    fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "var(--text-muted)",
    padding: "0 8px", margin: "16px 0 6px",
  },
  navItem: {
    display: "flex", alignItems: "center", gap: 11,
    width: "100%", padding: "10px 12px",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    fontSize: "0.875rem", fontWeight: 500,
    cursor: "pointer", background: "none", border: "none",
    fontFamily: "var(--font-body)",
    transition: "all var(--t) var(--ease)",
    position: "relative", marginBottom: 2,
    textAlign: "left",
  },
  navItemActive: {
    background: "rgba(79,142,247,0.12)",
    color: "var(--accent)",
  },
  activeLine: {
    position: "absolute", left: 0, top: "50%",
    transform: "translateY(-50%)",
    width: 3, height: 20,
    background: "var(--accent)",
    borderRadius: "0 3px 3px 0",
  },
  badge: {
    background: "var(--accent)", color: "white",
    fontSize: "0.65rem", fontWeight: 700,
    padding: "2px 6px", borderRadius: 20,
    minWidth: 20, textAlign: "center",
  },
  sidebarBottom: { padding: "16px 12px", borderTop: "1px solid var(--border)" },
  clientCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)", padding: 12,
  },
  clientLabel: {
    fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em",
    textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8,
  },
  clientSelect: {
    width: "100%", padding: "7px 10px",
    background: "var(--bg-input)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", color: "var(--text-primary)",
    fontSize: "0.8rem", fontWeight: 500, cursor: "pointer",
  },
  statusRow: { display: "flex", alignItems: "center", gap: 6, marginTop: 8 },
  statusDot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "var(--accent2)",
    boxShadow: "0 0 8px var(--accent2)",
  },
  statusText: { fontSize: "0.72rem", color: "var(--text-secondary)" },
  main: {
    marginLeft: "var(--sidebar-w)", flex: 1,
    display: "flex", flexDirection: "column", minHeight: "100vh",
  },
  topbar: {
    display: "flex", alignItems: "center",
    padding: "16px 28px",
    borderBottom: "1px solid var(--border)",
    position: "sticky", top: 0, zIndex: 50,
    gap: 16,
  },
  topbarTitle: {
    fontFamily: "var(--font-head)", fontSize: "1.2rem", fontWeight: 600,
    letterSpacing: "-0.02em", flex: 1,
  },
  topbarActions: { display: "flex", alignItems: "center", gap: 10 },
  themeToggle: {
    display: "flex",
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", overflow: "hidden", padding: 3,
  },
  themeBtn: {
    width: 32, height: 32, borderRadius: 6,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--text-muted)", cursor: "pointer",
    background: "none", border: "none",
    transition: "all var(--t) var(--ease)",
  },
  themeBtnActive: {
    background: "var(--accent)", color: "white",
    boxShadow: "0 2px 8px rgba(79,142,247,0.4)",
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: "var(--radius-sm)",
    background: "var(--bg-card)", border: "1px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--text-secondary)", cursor: "pointer",
    transition: "all var(--t) var(--ease)",
    position: "relative",
  },
  notifDot: {
    position: "absolute", top: 7, right: 7,
    width: 7, height: 7, background: "var(--danger)",
    borderRadius: "50%", border: "2px solid var(--bg-surface)",
  },
  avatar: {
    width: 38, height: 38, borderRadius: "var(--radius-sm)",
    background: "linear-gradient(135deg, var(--accent), var(--accent2))",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "0.8rem",
    color: "white", cursor: "pointer", flexShrink: 0,
  },
  signOutBtn: {
    padding: "7px 14px",
    background: "var(--bg-input)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", color: "var(--text-secondary)",
    fontSize: "0.78rem", fontWeight: 500, cursor: "pointer",
    fontFamily: "var(--font-body)",
    transition: "all var(--t) var(--ease)",
  },
  notifPanel: {
    position: "absolute", top: 70, right: 20,
    width: 340, borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-lg)", zIndex: 200, overflow: "hidden",
  },
  notifHead: {
    padding: "16px 18px", borderBottom: "1px solid var(--border)",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  notifItem: {
    padding: "13px 18px", borderBottom: "1px solid var(--border)",
    display: "flex", gap: 12, alignItems: "flex-start",
  },
  notifIcon: {
    width: 32, height: 32, borderRadius: "var(--radius-sm)",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  pageContent: { flex: 1, padding: 28 },
};
