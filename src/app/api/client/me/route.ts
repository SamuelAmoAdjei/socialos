import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClients, getSettings, updateClientApprovalRequired } from "@/lib/sheets";
import type { ApiResult } from "@/types";

function norm(s: string) {
  return (s ?? "").toLowerCase().trim();
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
    } catch (err: any) {
      return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
    }
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (typeof body.approvalRequired !== "boolean") {
      return NextResponse.json<ApiResult>({ ok: false, error: "approvalRequired boolean required" }, { status: 400 });
    }
    const token = (session as any).accessToken as string;
    const clients = await getClients(token);
    const me = clients.find((c) => norm(c.email) === norm(session.user!.email!));
    if (!me) {
      return NextResponse.json<ApiResult>({ ok: false, error: "No client record for your email" }, { status: 404 });
    }

    await updateClientApprovalRequired(token, session.user!.email!, body.approvalRequired);
    return NextResponse.json<ApiResult>({
      ok: true,
      data: { approvalRequired: body.approvalRequired },
    });
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.toLowerCase().includes("permission")) {
      return NextResponse.json<ApiResult>({
        ok: false,
        error: "This account cannot update approval mode directly. Ask the VA to update it from the Clients page.",
      }, { status: 403 });
    }
    return NextResponse.json<ApiResult>({ ok: false, error: msg }, { status: 500 });
  }
}
