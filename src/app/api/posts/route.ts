import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPosts, createPost } from "@/lib/sheets";
import type { ApiResult, PostStatus, Platform } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const posts = await getPosts((session as any).accessToken);
    return NextResponse.json<ApiResult>({ ok: true, data: posts });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const body = await req.json();
    const id = await createPost((session as any).accessToken, {
      clientId:    body.clientId    ?? "default",
      content:     body.content     ?? "",
      liOverride:  body.liOverride,
      xOverride:   body.xOverride,
      igOverride:  body.igOverride,
      platforms:   (body.platforms  ?? []) as Platform[],
      mediaUrl:    body.mediaUrl,
      scheduledAt: body.scheduledAt,
      status:      (body.status     ?? "draft") as PostStatus,
      docLink:     body.docLink,
    });
    return NextResponse.json<ApiResult>({ ok: true, data: { id } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}
