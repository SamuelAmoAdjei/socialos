import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAnalytics } from "@/lib/sheets";
import type { ApiResult } from "@/types";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") ?? undefined;
  const limit    = searchParams.get("limit") ? Number(searchParams.get("limit")) : 30;

  try {
    const rows = await getAnalytics((session as any).accessToken, { platform, limit });
    return NextResponse.json<ApiResult>({ ok: true, data: rows });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}
