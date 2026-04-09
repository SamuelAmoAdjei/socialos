/**
 * GET  /api/client/me  — returns the client's record (approvalRequired etc.)
 * PATCH /api/client/me — updates approvalRequired field
 *
 * Uses the VA's token (via APPS_SCRIPT_URL) since the client may not have
 * write access to the Clients tab.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClients } from "@/lib/sheets";
import type { ApiResult } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  const email = session.user.email.toLowerCase().trim();

  try {
    const token   = (session as any).accessToken as string;
    const clients = await getClients(token);
    const match   = clients.find(c => (c.email ?? "").toLowerCase().trim() === email);

    if (!match) {
      // Not found but that's okay — return a safe default
      return NextResponse.json<ApiResult>({
        ok: true,
        data: { approvalRequired: true, found: false },
      });
    }

    return NextResponse.json<ApiResult>({
      ok: true,
      data: {
        id:               match.id,
        name:             match.name,
        email:            match.email,
        timezone:         match.timezone,
        platforms:        match.platforms,
        approvalRequired: match.approvalRequired,
        found:            true,
      },
    });
  } catch (err: any) {
    // Return safe default on error — don't block client from logging in
    return NextResponse.json<ApiResult>({
      ok: true,
      data: { approvalRequired: true, found: false, error: err.message },
    });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const { approvalRequired } = await req.json();
    const email = session.user.email.toLowerCase().trim();

    // Forward to Apps Script which has full Sheets write access
    const appsScriptUrl = process.env.APPS_SCRIPT_URL;
    if (appsScriptUrl) {
      const res = await fetch(appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "client_approval_mode_update",
          clientEmail: email,
          approvalRequired: !!approvalRequired,
        }),
      }).then(r => r.json());

      if (res.ok) {
        return NextResponse.json<ApiResult>({ ok: true, data: { approvalRequired } });
      }
      return NextResponse.json<ApiResult>({ ok: false, error: res.error ?? "Update failed" }, { status: 500 });
    }

    // Fallback: try direct sheet update
    // (this requires the client to have write scope on the Clients tab)
    return NextResponse.json<ApiResult>({
      ok: false,
      error: "APPS_SCRIPT_URL not configured. Set this env var in Vercel.",
    }, { status: 500 });

  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}