/**
 * GET /api/role
 * Determines the role of the signed-in user.
 * Priority:
 *   1. Vercel env vars VA_EMAIL / CLIENT_EMAIL (fastest, most reliable)
 *   2. Google Sheet Settings tab (allows changing without redeployment)
 *
 * Returns: { role: "va" | "client" | "none", email: string }
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/sheets";

function normalise(email: string) {
  return (email ?? "").toLowerCase().trim();
}

function matchRole(
  userEmail: string,
  vaEmail: string,
  clientEmail: string
): "va" | "client" | "none" {
  const u = normalise(userEmail);
  if (!u) return "none";
  if (vaEmail     && u === normalise(vaEmail))     return "va";
  if (clientEmail && u === normalise(clientEmail)) return "client";
  return "none";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ role:"none", error:"Not signed in" }, { status:401 });
  }

  const userEmail = normalise(session.user.email);

  // ── 1. Try env vars first (always available, no Sheet call needed) ──────────
  const vaEnv     = process.env.VA_EMAIL     ?? "";
  const clientEnv = process.env.CLIENT_EMAIL ?? "";

  if (vaEnv || clientEnv) {
    const role = matchRole(userEmail, vaEnv, clientEnv);
    if (role !== "none") {
      return NextResponse.json({ role, email:userEmail, source:"env" });
    }
  }

  // ── 2. Try Google Sheet Settings tab ────────────────────────────────────────
  try {
    const token    = (session as any).accessToken as string;
    const settings = await getSettings(token);

    const vaSheet     = settings["VA_EMAIL"]     ?? "";
    const clientSheet = settings["CLIENT_EMAIL"] ?? "";

    const role = matchRole(userEmail, vaSheet, clientSheet);
    return NextResponse.json({
      role,
      email: userEmail,
      source: "sheet",
      // Debug info to help troubleshoot
      debug: {
        userEmail,
        vaEmailInSheet:     vaSheet     || "(empty)",
        clientEmailInSheet: clientSheet || "(empty)",
        vaEmailInEnv:       vaEnv       || "(not set)",
        clientEmailInEnv:   clientEnv   || "(not set)",
      }
    });
  } catch (err: any) {
    // Sheet unreachable — if we already checked env vars and got "none", return none
    return NextResponse.json({
      role: "none",
      email: userEmail,
      source: "fallback",
      error: err.message,
      hint: "Set VA_EMAIL and CLIENT_EMAIL in Vercel environment variables as a reliable fallback.",
    });
  }
}