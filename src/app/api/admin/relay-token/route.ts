/**
 * GET /api/admin/relay-token
 *
 * VA-only endpoint. Returns the VA's refresh token so they can copy it
 * to Vercel env vars as VA_REFRESH_TOKEN.
 *
 * This enables the "VA Token Relay" strategy: the system uses the VA's
 * credentials to read/write the Google Sheet on behalf of clients who
 * don't have direct Sheet access.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveRole } from "@/lib/rbac";

export async function GET() {
  const roleResult = await resolveRole();
  if (!roleResult || roleResult.role !== "va") {
    return NextResponse.json(
      { ok: false, error: "Only the VA can access this endpoint. Sign in with the VA account." },
      { status: 403 }
    );
  }

  const session = await getServerSession(authOptions);
  const refreshToken = (session as any)?.refreshToken as string | undefined;

  if (!refreshToken) {
    return NextResponse.json({
      ok: false,
      error: "No refresh token found. Sign out and sign back in (Google must issue a new refresh token).",
      fix: "After signing out, when you sign back in Google will issue a fresh refresh token.",
    });
  }

  // Check if VA_REFRESH_TOKEN is already set
  const existing = process.env.VA_REFRESH_TOKEN;

  return NextResponse.json({
    ok: true,
    data: {
      refreshToken,
      alreadyConfigured: !!existing,
      instructions: [
        "1. Copy the refreshToken value below.",
        "2. Go to Vercel → your project → Settings → Environment Variables.",
        "3. Add a new variable: Key = VA_REFRESH_TOKEN, Value = (paste the token).",
        "4. Check all environments (Production, Preview, Development).",
        "5. Redeploy your project.",
        "",
        "This allows the client portal to read/write the Google Sheet using your VA credentials,",
        "even when the client's Google account doesn't have direct Sheet access.",
      ],
    },
  });
}
