import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClients, updateClientApprovalRequired } from "@/lib/sheets";
import type { ApiResult } from "@/types";

function norm(s: string) {
  return (s ?? "").toLowerCase().trim();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  try {
    const token = (session as any).accessToken as string;
    const clients = await getClients(token);
    const me = clients.find((c) => norm(c.email) === norm(session.user!.email!));
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
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
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
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}
