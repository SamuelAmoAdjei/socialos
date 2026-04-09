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

  // ── STEP 1: Env vars (set in Vercel → Settings → Environment Variables) ──
  const vaEnv     = norm(process.env.VA_EMAIL     ?? "");
  const clientEnv = norm(process.env.CLIENT_EMAIL ?? "");

  debug.VA_EMAIL_ENV     = vaEnv     || "(NOT SET IN VERCEL)";
  debug.CLIENT_EMAIL_ENV = clientEnv || "(NOT SET IN VERCEL)";

  if (vaEnv && userEmail === vaEnv) {
    return NextResponse.json({ role: "va", source: "env", userEmail, debug });
  }
  if (clientEnv && userEmail === clientEnv) {
    return NextResponse.json({ role: "client", source: "env", userEmail, debug });
  }

  // ── STEP 2: Sheet Settings tab ───────────────────────────────────────────
  try {
    const token = (session as any).accessToken as string;
    if (!token) throw new Error("No access token");

    // Read Settings tab directly without going through the sheets lib
    // to avoid any tab-resolver caching issues
    const { google } = await import("googleapis");
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const api = google.sheets({ version: "v4", auth });

    const sheetId = process.env.GOOGLE_SHEETS_ID!;
    const res = await api.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Settings!A1:B20",
    });

    const rows = res.data.values ?? [];
    const settings: Record<string,string> = {};
    rows.forEach(([k, v]) => { if (k) settings[norm(String(k))] = norm(String(v ?? "")); });

    // Try both lowercase and uppercase versions of the key
    const vaSheet     = settings["va_email"]     || settings["VA_EMAIL"]     || "";
    const clientSheet = settings["client_email"] || settings["CLIENT_EMAIL"] || "";

    debug.VA_EMAIL_SHEET     = vaSheet     || "(empty in Settings tab)";
    debug.CLIENT_EMAIL_SHEET = clientSheet || "(empty in Settings tab)";
    debug.ALL_SETTINGS_KEYS  = Object.keys(settings).join(", ");

    if (vaSheet && userEmail === vaSheet) {
      return NextResponse.json({ role: "va", source: "sheet", userEmail, debug });
    }
    if (clientSheet && userEmail === clientSheet) {
      return NextResponse.json({ role: "client", source: "sheet", userEmail, debug });
    }

    return NextResponse.json({
      role: "none",
      source: "sheet",
      userEmail,
      debug,
      FIX: "Add VA_EMAIL and CLIENT_EMAIL to Vercel environment variables, or fill them in your Settings sheet B3 and B4",
    });

  } catch (err: any) {
    debug.SHEET_ERROR = err.message;
    return NextResponse.json({
      role: "none",
      source: "error",
      userEmail,
      debug,
      FIX: "CRITICAL: Set VA_EMAIL=" + userEmail + " in Vercel Environment Variables to fix this immediately",
    });
  }
}
