/**
 * GET /api/role
 * Returns the role of the currently signed-in user:
 *   { role: "va" }     — email matches VA_EMAIL in Settings sheet
 *   { role: "client" } — email matches CLIENT_EMAIL in Settings sheet
 *   { role: "none" }   — email not recognised
 *
 * This is the gate that separates the VA dashboard from the client portal.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/sheets";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ role: "none", error: "Not signed in" }, { status: 401 });
  }

  const userEmail = session.user.email.toLowerCase().trim();

  try {
    const settings = await getSettings((session as any).accessToken);
    const vaEmail     = (settings["VA_EMAIL"]     ?? "").toLowerCase().trim();
    const clientEmail = (settings["CLIENT_EMAIL"] ?? "").toLowerCase().trim();

    let role: "va" | "client" | "none" = "none";
    if (vaEmail     && userEmail === vaEmail)     role = "va";
    if (clientEmail && userEmail === clientEmail) role = "client";

    return NextResponse.json({ role, email: userEmail });
  } catch (err: any) {
    // If Sheet is unreachable, fall back to env vars as backup
    const vaEnv     = (process.env.VA_EMAIL     ?? "").toLowerCase().trim();
    const clientEnv = (process.env.CLIENT_EMAIL ?? "").toLowerCase().trim();
    let role: "va" | "client" | "none" = "none";
    if (vaEnv     && userEmail === vaEnv)     role = "va";
    if (clientEnv && userEmail === clientEnv) role = "client";
    return NextResponse.json({ role, email: userEmail, fallback: true });
  }
}