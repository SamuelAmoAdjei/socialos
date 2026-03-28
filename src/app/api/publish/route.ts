import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPost, getSettings, appendLog, updatePostRow, getPosts } from "@/lib/sheets";
import type { ApiResult, Platform } from "@/types";

/** Derive the app's public URL robustly — works on Vercel and localhost */
function getBaseUrl(req: NextRequest): string {
  // 1. Prefer explicit env var
  const envUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && !envUrl.includes("undefined")) return envUrl.replace(/\/$/, "");

  // 2. Derive from request headers (works on Vercel)
  const host   = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto  = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;

  return "https://socialosv1.vercel.app";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok:false, error:"Unauthorised" }, { status:401 });

  const token = (session as any).accessToken as string;

  try {
    const body = await req.json();
    const selectedPlatforms: Platform[] = (body.platforms ?? []).map((p:string) => p.toLowerCase() as Platform);

    if (selectedPlatforms.length === 0) {
      return NextResponse.json<ApiResult>({ ok:false, error:"No platforms selected" }, { status:400 });
    }

    // 1. Save post to Sheet with status = "publishing"
    const id = await createPost(token, {
      clientId:    body.clientId    ?? "default",
      content:     body.content     ?? "",
      liOverride:  body.liOverride,
      xOverride:   body.xOverride,
      igOverride:  body.igOverride,
      platforms:   selectedPlatforms,
      mediaUrl:    body.mediaUrl,
      scheduledAt: body.scheduledAt ?? new Date().toISOString(),
      status:      "publishing",
      docLink:     body.docLink,
    });

    // 2. Get webhook URL
    const settings   = await getSettings(token);
    const webhookUrl = settings["MAKE_WEBHOOK_URL"] ?? process.env.MAKE_WEBHOOK_URL ?? "";

    if (!webhookUrl || webhookUrl === "placeholder") {
      const posts = await getPosts(token);
      const post  = posts.find(p => p.id === id);
      if (post) await updatePostRow(token, post.rowIndex, { status:"approved" });
      return NextResponse.json<ApiResult>({
        ok:true,
        data:{ id, warning:"No Make.com webhook configured. Post saved as approved." },
      });
    }

    // 3. Build platform-specific content — ONLY for selected platforms
    // Make.com uses this to know which Buffer profiles to post to
    const platformContent: Record<string,string> = {};
    selectedPlatforms.forEach(p => {
      switch(p) {
        case "linkedin":  platformContent.linkedin  = body.liOverride || body.content; break;
        case "x":         platformContent.x          = body.xOverride  || (body.content ?? "").substring(0,280); break;
        case "instagram": platformContent.instagram  = body.igOverride || body.content; break;
        case "facebook":  platformContent.facebook   = body.content; break;
        case "tiktok":    platformContent.tiktok     = body.content; break;
      }
    });

    const baseUrl      = getBaseUrl(req);
    const callbackUrl  = `${baseUrl}/api/publish/callback`;

    const payload = {
      post_id:          id,
      content:          body.content ?? "",
      platform_content: platformContent,            // Only selected platforms
      platforms:        selectedPlatforms,           // Array Make.com uses to filter Buffer profiles
      media_url:        body.mediaUrl || null,
      callback_url:     callbackUrl,
      access_token:     token,                       // For callback to write back to Sheet
    };

    // 4. Fire webhook
    const makeRes = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type":"application/json" },
      body:    JSON.stringify(payload),
    });

    if (!makeRes.ok) {
      const errText = await makeRes.text();
      const posts = await getPosts(token);
      const post  = posts.find(p => p.id === id);
      if (post) await updatePostRow(token, post.rowIndex, { status:"failed", errorMsg:errText.substring(0,200) });
      await appendLog(token, "publish", id, "webhook_failed", errText);
      return NextResponse.json<ApiResult>({
        ok:false, error:`Make.com error ${makeRes.status}: ${errText.substring(0,200)}`
      }, { status:502 });
    }

    await appendLog(token, "publish", id, "webhook_sent", `platforms: ${selectedPlatforms.join(",")}`);
    return NextResponse.json<ApiResult>({ ok:true, data:{ id, status:"publishing", platforms:selectedPlatforms } });

  } catch (err:any) {
    return NextResponse.json<ApiResult>({ ok:false, error:err.message }, { status:500 });
  }
}