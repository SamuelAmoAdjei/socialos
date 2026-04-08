import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClients, getSettings, updateClientApprovalRequired } from "@/lib/sheets";
import type { ApiResult } from "@/types";

function norm(s: string) {
  return (s ?? "").toLowerCase().trim();
}

async function resolveAppsScriptUrl(token: string): Promise<string> {
  const envUrl = process.env.APPS_SCRIPT_WEB_APP_URL || process.env.CALLBACK_URL || "";
  if (envUrl) return envUrl;
  try {
    const settings = await getSettings(token);
    return settings["CALLBACK_URL"] || settings["callback_url"] || "";
  } catch {
    return "";
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  const token = (session as any).accessToken as string;
  const email = norm(session.user!.email!);

  try {
    const clients = await getClients(token);
    const me = clients.find((c) => norm(c.email) === email);
    if (!me) {
      return NextResponse.json<ApiResult>({ ok: false, error: "No client record for your email" }, { status: 404 });
    }
    return NextResponse.json<ApiResult>({
      ok: true,
      data: {
        id: me.id,
        name: me.name,
        email: me.email,
        approvalRequired: me.approvalRequired,
      },
    });
  } catch {
    // Fallback for client accounts that cannot read the Clients tab directly.
    // Keep portal usable and default to safest mode (approval required).
    try {
      const settings = await getSettings(token);
      const settingsEmail = norm(settings["CLIENT_EMAIL"] || "");
      if (!settingsEmail || settingsEmail !== email) {
        return NextResponse.json<ApiResult>({ ok: false, error: "No client record for your email" }, { status: 404 });
      }
      return NextResponse.json<ApiResult>({
        ok: true,
        data: {
          id: settingsEmail,
          name: settings["CLIENT_NAME"] || session.user?.name || "Client",
          email: settingsEmail,
          approvalRequired: true,
          readonly: true,
        },
      });
    } catch {
      const envClientEmail = norm(process.env.CLIENT_EMAIL || "");
      if (envClientEmail && envClientEmail === email) {
        return NextResponse.json<ApiResult>({
          ok: true,
          data: {
            id: envClientEmail,
            name: session.user?.name || "Client",
            email: envClientEmail,
            approvalRequired: true,
            readonly: true,
          },
        });
      }
      return NextResponse.json<ApiResult>({
        ok: false,
        error: "Client profile unavailable. Add CLIENT_EMAIL in env or share sheet access.",
      }, { status: 500 });
    }
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  let requestedApprovalRequired: boolean | undefined;
  try {
    const body = await req.json();
    if (typeof body.approvalRequired !== "boolean") {
      return NextResponse.json<ApiResult>({ ok: false, error: "approvalRequired boolean required" }, { status: 400 });
    }
    requestedApprovalRequired = body.approvalRequired;
    const token = (session as any).accessToken as string;
    const clients = await getClients(token);
    const me = clients.find((c) => norm(c.email) === norm(session.user!.email!));
    if (!me) {
      return NextResponse.json<ApiResult>({ ok: false, error: "No client record for your email" }, { status: 404 });
    }

    await updateClientApprovalRequired(token, session.user!.email!, body.approvalRequired);
    return NextResponse.json<ApiResult>({
      ok: true,
      data: { approvalRequired: requestedApprovalRequired },
    });
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.toLowerCase().includes("permission")) {
      if (typeof requestedApprovalRequired !== "boolean") {
        return NextResponse.json<ApiResult>({ ok: false, error: "approvalRequired boolean required" }, { status: 400 });
      }
      const token = (session as any).accessToken as string;
      const callbackUrl = await resolveAppsScriptUrl(token);
      if (!callbackUrl) {
        return NextResponse.json<ApiResult>({
          ok: false,
          error: "No fallback Apps Script URL configured. Set APPS_SCRIPT_WEB_APP_URL in Vercel.",
        }, { status: 400 });
      }

      const res = await fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "client_approval_mode_update",
          clientEmail: session.user!.email!,
          approvalRequired: requestedApprovalRequired,
          requestedBy: session.user!.email!,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        return NextResponse.json<ApiResult>({
          ok: false,
          error: `Fallback update failed: ${text.slice(0, 180)}`,
        }, { status: 502 });
      }
      return NextResponse.json<ApiResult>({
        ok: true,
        data: { approvalRequired: requestedApprovalRequired, via: "apps_script" },
      });
    }
    return NextResponse.json<ApiResult>({ ok: false, error: msg }, { status: 500 });
  }
}
