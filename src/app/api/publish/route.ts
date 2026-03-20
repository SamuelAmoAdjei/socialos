import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPost, getSettings, appendLog, updatePostRow, getPosts } from "@/lib/sheets";
import type { ApiResult, Platform } from "@/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  const token = (session as any).accessToken as string;

  try {
    const body = await req.json();

    // 1. Save post to Sheets with status = "publishing"
    const id = await createPost(token, {
      clientId:    body.clientId ?? "default",
      content:     body.content  ?? "",
      liOverride:  body.liOverride,
      xOverride:   body.xOverride,
      igOverride:  body.igOverride,
      platforms:   (body.platforms ?? []) as Platform[],
      mediaUrl:    body.mediaUrl,
      scheduledAt: body.scheduledAt ?? new Date().toISOString(),
      status:      "publishing",
      docLink:     body.docLink,
    });

    // 2. Get Make.com webhook URL from Settings tab
    const settings = await getSettings(token);
    const webhookUrl = body.webhookUrl ?? settings["MAKE_WEBHOOK_URL"] ?? process.env.MAKE_WEBHOOK_URL;

    if (!webhookUrl) {
      // No webhook configured — save as approved for manual scheduling
      const posts = await getPosts(token);
      const post  = posts.find(p => p.id === id);
      if (post) await updatePostRow(token, post.rowIndex, { status: "approved" });
      return NextResponse.json<ApiResult>({
        ok: true,
        data: { id, warning: "No Make.com webhook configured. Post saved as approved." },
      });
    }

    // 3. Build payload for Make.com
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/publish/callback`;
    const payload = {
      post_id:  id,
      content:  body.content ?? "",
      platform_content: {
        linkedin:  body.liOverride  || body.content,
        x:         body.xOverride   || (body.content ?? "").substring(0, 280),
        instagram: body.igOverride  || body.content,
        facebook:  body.content,
        tiktok:    body.content,
      },
      media_url:    body.mediaUrl ?? null,
      platforms:    (body.platforms ?? []).map((p: string) => p.toLowerCase()),
      callback_url: callbackUrl,
    };

    // 4. Fire webhook to Make.com (non-blocking — return immediately)
    const makeRes = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    if (!makeRes.ok) {
      const errText = await makeRes.text();
      const posts = await getPosts(token);
      const post  = posts.find(p => p.id === id);
      if (post) await updatePostRow(token, post.rowIndex, { status: "failed", errorMsg: errText });
      await appendLog(token, "publish", id, "webhook_failed", errText);
      return NextResponse.json<ApiResult>({ ok: false, error: "Make.com rejected the request: " + errText }, { status: 502 });
    }

    await appendLog(token, "publish", id, "webhook_sent", `platforms: ${payload.platforms.join(",")}`);
    return NextResponse.json<ApiResult>({ ok: true, data: { id, status: "publishing" } });

  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}
