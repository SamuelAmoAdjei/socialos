import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPost, getSettings, appendLog, updatePostRow, getPosts } from "@/lib/sheets";
import type { ApiResult, Platform } from "@/types";

function getBaseUrl(req: NextRequest): string {
  const envUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && !envUrl.includes("undefined")) return envUrl.replace(/\/$/, "");
  const host  = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return "https://socialosv1.vercel.app";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok:false, error:"Unauthorised — please sign in" }, { status:401 });

  const token = (session as any).accessToken as string;
  if (!token)  return NextResponse.json({ ok:false, error:"No access token — sign out and sign back in" }, { status:401 });

  try {
    const body              = await req.json();
    const selectedPlatforms = (body.platforms ?? []).map((p:string) => p.toLowerCase() as Platform);

    if (selectedPlatforms.length === 0) {
      return NextResponse.json<ApiResult>({ ok:false, error:"Select at least one platform" }, { status:400 });
    }

    const content    = body.content    ?? "";
    const liOverride = body.liOverride || content;
    const xOverride  = (body.xOverride || content).substring(0, 280);
    const igOverride = body.igOverride || content;

    // 1. Save post to Sheet
    const id = await createPost(token, {
      clientId:    body.clientId || "client",
      content,
      liOverride:  body.liOverride || undefined,
      xOverride:   body.xOverride  || undefined,
      igOverride:  body.igOverride || undefined,
      platforms:   selectedPlatforms,
      mediaUrl:    body.mediaUrl   || undefined,
      scheduledAt: body.scheduledAt ?? new Date().toISOString(),
      status:      "publishing",
      docLink:     body.docLink    || undefined,
    });

    // 2. Get settings
    const settings   = await getSettings(token);
    const webhookUrl = settings["MAKE_WEBHOOK_URL"] ?? process.env.MAKE_WEBHOOK_URL ?? "";

    if (!webhookUrl || webhookUrl === "placeholder") {
      const posts = await getPosts(token);
      const post  = posts.find(p => p.id === id);
      if (post) await updatePostRow(token, post.rowIndex, { status:"approved" });
      return NextResponse.json<ApiResult>({
        ok:true, data:{ id, warning:"No Make.com webhook. Post saved as approved." },
      });
    }

    // 3. Build platform-specific text for Make.com Router branches
    // IMPORTANT: each key holds the ACTUAL TEXT for that platform — not an object
    const platformContent: Record<string,string> = {};
    selectedPlatforms.forEach((p: Platform) => {
      switch(p) {
        case "linkedin":  platformContent.linkedin  = liOverride; break;
        case "x":         platformContent.x          = xOverride;  break;
        case "instagram": platformContent.instagram  = igOverride; break;
        case "facebook":  platformContent.facebook   = content;    break;
        case "tiktok":    platformContent.tiktok     = content;    break;
      }
    });

    const baseUrl     = getBaseUrl(req);
    const callbackUrl = `${baseUrl}/api/publish/callback`;

    const payload = {
      post_id:          id,
      // ── Simple text fields for Make.com ──
      // In Make.com Buffer module: use {{1.text}} for the selected platform's content
      // OR use {{1.platform_content.linkedin}}, {{1.platform_content.facebook}}, etc.
      text:             content,                  // Fallback: use this if not using Router
      linkedin_text:    liOverride,               // For LinkedIn branch
      instagram_text:   igOverride,               // For Instagram branch
      facebook_text:    content,                  // For Facebook branch
      x_text:           xOverride,                // For X branch

      // Full object for Router-based setups
      platform_content: platformContent,
      platforms:        selectedPlatforms,
      media_url:        body.mediaUrl || null,
      callback_url:     callbackUrl,
      access_token:     token,                    // Make.com passes this back to callback
    };

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
        ok:false, error:`Make.com ${makeRes.status}: ${errText.substring(0,200)}`
      }, { status:502 });
    }

    await appendLog(token, "publish", id, "webhook_sent", `platforms: ${selectedPlatforms.join(",")}`);
    return NextResponse.json<ApiResult>({ ok:true, data:{ id, status:"publishing", platforms:selectedPlatforms } });

  } catch (err:any) {
    return NextResponse.json<ApiResult>({ ok:false, error:err.message }, { status:500 });
  }
}