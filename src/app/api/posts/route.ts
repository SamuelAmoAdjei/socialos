import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPost, getPosts } from "@/lib/sheets";
import type { ApiResult, Platform, PostStatus } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const rows = await getPosts((session as any).accessToken as string);
    return NextResponse.json<ApiResult>({ ok: true, data: rows });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const body = await req.json();
    const content = String(body.content ?? "").trim();
    const platforms = (Array.isArray(body.platforms) ? body.platforms : [])
      .map((p: string) => p.toLowerCase())
      .filter(Boolean) as Platform[];

    if (!content) {
      return NextResponse.json<ApiResult>({ ok: false, error: "Content is required" }, { status: 400 });
    }
    if (platforms.length === 0) {
      return NextResponse.json<ApiResult>({ ok: false, error: "Select at least one platform" }, { status: 400 });
    }

    const status = (body.status ?? "draft") as PostStatus;
    const id = await createPost((session as any).accessToken as string, {
      clientId: body.clientId || "client",
      content,
      liOverride: body.liOverride || undefined,
      xOverride: body.xOverride || undefined,
      igOverride: body.igOverride || undefined,
      platforms,
      mediaUrl: body.mediaUrl || undefined,
      scheduledAt: body.scheduledAt || "",
      status,
      docLink: body.docLink || undefined,
    });

    return NextResponse.json<ApiResult>({ ok: true, data: { id } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}
