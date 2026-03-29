"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";

const NAV = [
  { group:"Overview", items:[
    { label:"Dashboard", href:"/dashboard",           Icon:GridIco  },
    { label:"Compose",   href:"/dashboard/compose",   Icon:EditIco  },
  ]},
  { group:"Publishing", items:[
    { label:"Schedule",  href:"/dashboard/schedule",  Icon:CalIco,  badge:true },
    { label:"Analytics", href:"/dashboard/analytics", Icon:ChartIco },
  ]},
  { group:"Management", items:[
    { label:"Clients",   href:"/dashboard/clients",   Icon:UsersIco },
    { label:"Settings",  href:"/dashboard/settings",  Icon:CogIco   },
  ]},
];

const PAGE_TITLES: Record<string,string> = {
  "/dashboard":           "Dashboard",
  "/dashboard/compose":   "Compose",
  "/dashboard/schedule":  "Schedule",
  "/dashboard/analytics": "Analytics",
  "/dashboard/clients":   "Clients",
  "/dashboard/settings":  "Settings",
};

type NotifItem = { msg:string; time:string; type:"success"|"info"|"warn" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data:session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();

  /* Theme */
  const [theme, setTheme] = useState<"dark"|"light">("dark");
  useEffect(() => {
    const saved = (localStorage.getItem("sos-theme") ?? "dark") as "dark"|"light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);
  function switchTheme(t: "dark"|"light") {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("sos-theme", t);
  }

  /* Sidebar */
  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("sos-sidebar") === "collapsed") setCollapsed(true);
  }, []);
  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sos-sidebar", next ? "collapsed" : "expanded");
  }

  /* Notification panel */
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs,    setNotifs]    = useState<NotifItem[]>([]);
  const notifRef    = useRef<HTMLDivElement>(null);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (!notifRef.current?.contains(e.target as Node) &&
          !notifBtnRef.current?.contains(e.target as Node))
        setNotifOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* Schedule badge — live count, stable reference */
  const [scheduleBadge, setScheduleBadge] = useState(0);
  const [clients,       setClients]       = useState<{id:string;name:string}[]>([]);
  const [activeClient,  setActiveClient]  = useState<string>("");

  const loadBadge = useCallback(() => {
    fetch("/api/posts").then(r=>r.json()).then(res => {
      if (!res.ok) return;
      const posts = res.data as any[];
      const count = posts.filter((p:any) =>
        p.status === "approved" || p.status === "pending"
      ).length;
      setScheduleBadge(count);

      // Build live notifications from real post data
      const newNotifs: NotifItem[] = [];
      const published = [...posts]
        .filter((p:any) => p.status === "published" || p.status === "partial")
        .sort((a:any,b:any) => new Date(b.publishedAt||0).getTime()-new Date(a.publishedAt||0).getTime())
        .slice(0,2);
      const failed = posts.filter((p:any) => p.status === "failed").slice(0,1);
      const pending = posts.filter((p:any) => p.status === "pending").slice(0,1);

      published.forEach((p:any) => newNotifs.push({
        msg:  `Published: "${p.content.substring(0,50)}${p.content.length>50?"…":""}"`,
        time: p.publishedAt ? new Date(p.publishedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "Recently",
        type: "success",
      }));
      failed.forEach((p:any) => newNotifs.push({
        msg:  `Failed: "${p.content.substring(0,40)}…" — ${p.errorMsg||"check Make.com history"}`,
        time: "Action needed",
        type: "warn",
      }));
      pending.forEach((p:any) => newNotifs.push({
        msg:  `Client approval needed: "${p.content.substring(0,45)}…"`,
        time: "Pending",
        type: "info",
      }));

      if (newNotifs.length === 0) {
        newNotifs.push({ msg:"No recent activity — compose your first post", time:"", type:"info" });
      }
      setNotifs(newNotifs);
    }).catch(()=>{});
  }, []); // empty deps — stable reference, never recreated

  /* Load clients for sidebar — once on mount */
  useEffect(() => {
    fetch("/api/clients").then(r=>r.json()).then(res => {
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        setClients(res.data.map((c:any)=>({id:c.id,name:c.name})));
        setActiveClient(res.data[0].id);
      }
    }).catch(()=>{});
  }, []);

  /* Poll badge + notifs — every 2 minutes, only when authenticated */
  useEffect(() => {
    if (status !== "authenticated") return;
    loadBadge(); // immediate on mount
    const id = setInterval(loadBadge, 120_000); // 2 minutes
    return () => clearInterval(id);
  }, [status, loadBadge]);

  /* Role check — runs ONCE per session */
  const roleChecked = useRef(false);
  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/auth/signin"); return; }
    if (status === "authenticated" && !roleChecked.current) {
      roleChecked.current = true;
      fetch("/api/role").then(r=>r.json()).then(res => {
        if (res.role === "client") router.replace("/client");
        else if (res.role === "none") router.replace("/auth/signin?error=AccessDenied");
        // role === "va" → stay here
      }).catch(()=>{}); // if role check fails, allow through
    }
  }, [status, router]);

  /* Close mobile nav on route change */
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (status === "loading" || !session) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
        minHeight:"100vh", background:"var(--bg-app)" }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  const userName  = session.user?.name ?? "VA";
  const initials  = userName.split(" ").map((w:string) => w[0]).slice(0,2).join("").toUpperCase();
  const pageTitle = PAGE_TITLES[pathname] ?? "Dashboard";

  return (
    <div className="app-shell">

      {/* Mobile overlay */}
      <div className={`mobile-overlay${mobileOpen ? " visible" : ""}`}
        onClick={() => setMobileOpen(false)} />

      {/* SIDEBAR */}
      <aside className={`sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>

        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
              stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <path d="M10 2L18 6v8l-8 4-8-4V6z"/><path d="M10 2v12M2 6l8 4 8-4"/>
            </svg>
          </div>
          <div className="logo-text">Social<em>OS</em></div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(g => (
            <div key={g.group}>
              <div className="nav-group-label">{g.group}</div>
              {g.items.map(item => {
                const active = pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <button
                    key={item.href}
                    className={`nav-item${active ? " active" : ""}`}
                    onClick={() => router.push(item.href)}
                    title={collapsed ? item.label : undefined}
                  >
                    {active && <div className="active-bar" />}
                    <span className="nav-icon"><item.Icon active={active} /></span>
                    <span className="nav-label">{item.label}</span>
                    {"badge" in item && item.badge && scheduleBadge > 0 &&
                      <span className="nav-badge">{scheduleBadge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="collapse-btn" onClick={toggleCollapse}
            title={collapsed ? "Expand" : "Collapse"}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {collapsed ? <path d="M7 4l6 6-6 6"/> : <path d="M13 4l-6 6 6 6"/>}
            </svg>
          </button>
          <div className="client-widget">
            <div className="client-label-sm">Active Client</div>
            {clients.length === 0 ? (
              <div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.45)",padding:"6px 0",lineHeight:1.5}}>
                No clients yet.{" "}
                <span style={{color:"var(--accent)",cursor:"pointer",textDecoration:"underline"}}
                  onClick={() => router.push("/dashboard/clients")}>
                  Add a client
                </span>
              </div>
            ) : (
              <select className="client-select" value={activeClient}
                onChange={e => setActiveClient(e.target.value)}>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <div className="client-status-row">
              <div className="status-pulse"/>
              <span className="status-text-sm">
                {scheduleBadge > 0
                  ? `${scheduleBadge} post${scheduleBadge!==1?"s":""} need attention`
                  : clients.length === 0 ? "Add a client to get started" : "All posts up to date"}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className={`main-content${collapsed ? " sidebar-collapsed" : ""}`}>

        {/* Topbar */}
        <header className="topbar">
          <button className="hamburger" onClick={() => setMobileOpen(o => !o)}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h14M3 10h14M3 14h14"/>
            </svg>
          </button>

          <div className="topbar-title">
            {pageTitle} <span className="sub">/ {pathname === "/dashboard" ? "Overview" : pageTitle}</span>
          </div>

          <div className="topbar-actions">
            <div className="theme-toggle">
              <button className={`theme-opt${theme === "dark" ? " on" : ""}`}
                onClick={() => switchTheme("dark")} aria-label="Dark">
                <MoonIco/>
              </button>
              <button className={`theme-opt${theme === "light" ? " on" : ""}`}
                onClick={() => switchTheme("light")} aria-label="Light">
                <SunIco/>
              </button>
            </div>

            <button ref={notifBtnRef} className="icon-btn"
              onClick={() => { setNotifOpen(o => !o); if (!notifOpen) loadBadge(); }}>
              <BellIco/>
              {notifs.some(n => n.type === "warn") && <div className="notif-badge"/>}
            </button>

            <button className="avatar-btn" title={userName}>{initials}</button>

            <button className="signout-btn"
              onClick={() => signOut({ callbackUrl:"/auth/signin" })}>
              Sign out
            </button>
          </div>
        </header>

        {/* Live notification dropdown */}
        {notifOpen && (
          <div ref={notifRef} className="notif-panel">
            <div className="notif-head">
              <span className="notif-head-title">Notifications</span>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { loadBadge(); setNotifOpen(false); }}>
                Refresh
              </button>
            </div>
            {notifs.map((n,i) => (
              <div key={i} className="notif-item"
                onClick={() => { router.push("/dashboard/schedule"); setNotifOpen(false); }}>
                <div className="notif-dot-icon" style={{
                  background: n.type === "success" ? "var(--success-dim)"
                            : n.type === "warn"    ? "var(--gold-dim)"
                            : "var(--blue-dim)",
                  color: n.type === "success" ? "var(--success)"
                       : n.type === "warn"    ? "var(--gold)"
                       : "var(--blue)",
                }}>
                  {n.type === "success" ? <CheckIco/>
                 : n.type === "warn"    ? <WarnIco/>
                 : <InfoIco/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="notif-msg">{n.msg}</div>
                  {n.time && <div className="notif-time">{n.time}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Page content */}
        <div className="page">{children}</div>
      </main>
    </div>
  );
}

/* Icons */
const ico = { width:18,height:18,viewBox:"0 0 20 20",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const };
function GridIco({active}:{active?:boolean})  { return <svg {...ico} style={{color:active?"var(--accent)":"currentColor"}}><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>; }
function EditIco({active}:{active?:boolean})  { return <svg {...ico} style={{color:active?"var(--accent)":"currentColor"}}><path d="M14 2l4 4-10 10H4v-4L14 2z"/><path d="M12 4l4 4"/></svg>; }
function CalIco({active}:{active?:boolean})   { return <svg {...ico} style={{color:active?"var(--accent)":"currentColor"}}><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M14 2v4M6 2v4M2 8h16"/></svg>; }
function ChartIco({active}:{active?:boolean})  { return <svg {...ico} style={{color:active?"var(--accent)":"currentColor"}}><path d="M2 14l4-5 4 3 4-6 4 2"/><path d="M2 18h16"/></svg>; }
function UsersIco({active}:{active?:boolean})  { return <svg {...ico} style={{color:active?"var(--accent)":"currentColor"}}><circle cx="8" cy="6" r="3"/><path d="M2 18c0-4 2.7-6 6-6s6 2 6 6"/><path d="M14 8a3 3 0 010 5M17 18c0-2.5-1-4-3-5"/></svg>; }
function CogIco({active}:{active?:boolean})   { return <svg {...ico} style={{color:active?"var(--accent)":"currentColor"}}><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/></svg>; }
function BellIco() { return <svg {...ico}><path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z"/><path d="M8 16a2 2 0 004 0"/></svg>; }
function MoonIco() { return <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M17.3 13.35A7 7 0 017.65 2.7a8 8 0 1010.65 10.65z"/></svg>; }
function SunIco()  { return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10" cy="10" r="4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4"/></svg>; }
function CheckIco(){ return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 10l4 4 8-8"/></svg>; }
function InfoIco() { return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="10" cy="10" r="8"/><path d="M10 6v5M10 14v.5"/></svg>; }
function WarnIco() { return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10 2L2 17h16L10 2z"/><path d="M10 9v4M10 14.5v.5"/></svg>; }