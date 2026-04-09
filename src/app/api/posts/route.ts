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
    // If token lacks scope, try Apps Script as fallback
    const appsScriptUrl = process.env.APPS_SCRIPT_URL;
    if (appsScriptUrl) {
      try {
        const res = await fetch(`${appsScriptUrl}?action=getPosts`, { method: "GET" });
        const data = await res.json();
        if (data.ok) return NextResponse.json<ApiResult>({ ok: true, data: data.posts ?? [] });
      } catch {}
    }
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const body = await req.json();

    // Try direct Sheets write first (works for VA)
    let id: string;
    try {
      id = await createPost((session as any).accessToken, {
        clientId:    body.clientId    ?? "client",
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
    } catch (sheetErr: any) {
      // Fallback: route through Apps Script (for client accounts with limited scope)
      const appsScriptUrl = process.env.APPS_SCRIPT_URL;
      if (!appsScriptUrl) throw sheetErr;
      const asRes = await fetch(appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "create_post", post: body }),
      }).then(r => r.json());
      if (!asRes.ok) throw new Error(asRes.error ?? "Apps Script write failed");
      id = asRes.id ?? `post_${Date.now()}`;
    }

    return NextResponse.json<ApiResult>({ ok: true, data: { id } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}