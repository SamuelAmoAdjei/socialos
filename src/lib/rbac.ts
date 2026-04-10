/**
 * Role-Based Access Control (RBAC) helper for SocialOS.
 * Determines user role from env vars first, then falls back to the Settings sheet.
 * Used by API routes to enforce proper access boundaries.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type UserRole = "va" | "client" | "none";

function norm(s: string) {
  return (s ?? "").toLowerCase().trim();
}

export interface RoleResult {
  role: UserRole;
  email: string;
  token: string;
}

/**
 * Resolves the current user's role and returns their email + access token.
 * Returns null if not authenticated.
 *
 * PRIORITY ORDER:
 * 1. VA_EMAIL / CLIENT_EMAIL env vars (set in Vercel)
 * 2. Google Sheet Settings tab (VA_EMAIL / CLIENT_EMAIL keys)
 * 3. Clients sheet — if the user's email matches a client row → "client"
 * 4. Default → "none"
 */
export async function resolveRole(): Promise<RoleResult | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const email = norm(session.user.email);
  const token = (session as any).accessToken as string;
  if (!token) return null;

  // Step 1: Check env vars — fastest and most reliable
  const vaEnv = norm(process.env.VA_EMAIL ?? "");
  const clientEnv = norm(process.env.CLIENT_EMAIL ?? "");

  if (vaEnv && email === vaEnv) return { role: "va", email, token };
  if (clientEnv && email === clientEnv) return { role: "client", email, token };

  // Step 2: Check Settings sheet
  try {
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
    const settings: Record<string, string> = {};
    rows.forEach(([k, v]) => {
      if (k) settings[norm(String(k))] = norm(String(v ?? ""));
    });

    const vaSheet = settings["va_email"] || "";
    const clientSheet = settings["client_email"] || "";

    if (vaSheet && email === vaSheet) return { role: "va", email, token };
    if (clientSheet && email === clientSheet) return { role: "client", email, token };
  } catch {
    // Settings lookup failed — continue to clients check
  }

  // Step 3: Check Clients sheet — if email matches any client row
  try {
    const { getClients } = await import("@/lib/sheets");
    const clients = await getClients(token);
    const match = clients.find((c) => norm(c.email) === email);
    if (match) return { role: "client", email, token };
  } catch {
    // Clients lookup failed
  }

  // Step 4: Fallback — authenticated but unrecognised
  return { role: "none", email, token };
}

/**
 * Quick check — returns true if the user is a VA.
 */
export async function requireVA(): Promise<RoleResult | null> {
  const result = await resolveRole();
  if (!result || result.role !== "va") return null;
  return result;
}

/**
 * Quick check — returns true if the user is a client.
 */
export async function requireClient(): Promise<RoleResult | null> {
  const result = await resolveRole();
  if (!result || result.role !== "client") return null;
  return result;
}

/**
 * Allows VA or client — returns null if unauthenticated or role is "none".
 */
export async function requireAuth(): Promise<RoleResult | null> {
  const result = await resolveRole();
  if (!result || result.role === "none") return null;
  return result;
}
