/**
 * GET /api/role
 * Returns the role of the signed-in user.
 * 
 * PRIORITY ORDER:
 * 1. Vercel env vars VA_EMAIL / CLIENT_EMAIL  ← most reliable, use this
 * 2. Google Sheet Settings tab                ← fallback if env vars not set
 * 3. Never returns 401/redirect — always returns role: "none" if unknown
 *
 * DEBUG: visit /api/role while signed in to see exactly what is being checked.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function norm(s: string) { return (s ?? "").toLowerCase().trim(); }

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ role: "none", reason: "not_signed_in" }, { status: 401 });
  }

  const userEmail = norm(session.user.email);
  const debug: Record<string, string> = { userEmail };
  const isDev = process.env.NODE_ENV === "development";

  // ── STEP 1: Env vars (set in Vercel → Settings → Environment Variables) ──
  const vaEnv     = norm(process.env.VA_EMAIL     ?? "");
  const clientEnv = norm(process.env.CLIENT_EMAIL ?? "");

  debug.VA_EMAIL_ENV     = vaEnv     || "(NOT SET IN VERCEL)";
  debug.CLIENT_EMAIL_ENV = clientEnv || "(NOT SET IN VERCEL)";

  if (vaEnv && userEmail === vaEnv) {
    return NextResponse.json({ role: "va", source: "env", ...(isDev ? { userEmail, debug } : {}) });
  }
  if (clientEnv && userEmail === clientEnv) {
    return NextResponse.json({ role: "client", source: "env", ...(isDev ? { userEmail, debug } : {}) });
  }

  // ── STEP 2: Sheet Settings tab (uses service account if configured) ─────
  try {
    const token = (session as any).accessToken as string;
    if (!token) throw new Error("No access token");

    const { getSettings, getClients } = await import("@/lib/sheets");
    const settings = await getSettings(token);

    const vaSheet     = norm(settings["VA_EMAIL"]     || settings["va_email"]     || "");
    const clientSheet = norm(settings["CLIENT_EMAIL"] || settings["client_email"] || "");

    debug.VA_EMAIL_SHEET     = vaSheet     || "(empty in Settings tab)";
    debug.CLIENT_EMAIL_SHEET = clientSheet || "(empty in Settings tab)";
    debug.ALL_SETTINGS_KEYS  = Object.keys(settings).join(", ");

    if (vaSheet && userEmail === vaSheet) {
      return NextResponse.json({ role: "va", source: "sheet", ...(isDev ? { userEmail, debug } : {}) });
    }
    if (clientSheet && userEmail === clientSheet) {
      return NextResponse.json({ role: "client", source: "sheet", ...(isDev ? { userEmail, debug } : {}) });
    }

    // Step 3: Check Clients sheet for multi-client support
    try {
      const clients = await getClients(token);
      const match = clients.find((c) => norm(c.email) === userEmail);
      if (match) {
        return NextResponse.json({ role: "client", source: "clients_sheet", ...(isDev ? { userEmail, debug } : {}) });
      }
    } catch { /* clients lookup failed */ }

    return NextResponse.json({
      role: "none",
      source: "sheet",
      ...(isDev ? { userEmail, debug } : {}),
      FIX: "Add VA_EMAIL and CLIENT_EMAIL to Vercel environment variables, or fill them in your Settings sheet B3 and B4",
    });

  } catch (err: any) {
    debug.SHEET_ERROR = err.message;
    return NextResponse.json({
      role: "none",
      source: "error",
      ...(isDev ? { userEmail, debug } : {}),
      FIX: "Set VA_EMAIL in Vercel Environment Variables to fix this",
    });
  }
}