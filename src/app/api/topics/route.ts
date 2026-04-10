import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPost, getSettings } from "@/lib/sheets";
import type { ApiResult, Platform } from "@/types";

async function getAppsScriptUrl(token: string): Promise<string> {
  // Check env vars first — fastest
  const envUrl = process.env.APPS_SCRIPT_WEB_APP_URL || process.env.CALLBACK_URL || "";
  if (envUrl) return envUrl;
  // Fall back to Settings sheet
  try {
    const settings = await getSettings(token);
    return settings["CALLBACK_URL"] || settings["callback_url"] || "";
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const token       = (session as any).accessToken as string;
    const body        = await req.json();
    const content     = String(body.content ?? "").trim();
    const platforms   = (Array.isArray(body.platforms) ? body.platforms : [])
      .map((p: string) => p.toLowerCase()).filter(Boolean) as Platform[];
    const requestedBy = String(session.user?.email || "");

    if (!content) return NextResponse.json<ApiResult>({ ok: false, error: "Topic is required" }, { status: 400 });
    if (platforms.length === 0) return NextResponse.json<ApiResult>({ ok: false, error: "Select at least one platform" }, { status: 400 });

    // STRATEGY: try direct Sheets write first (works when user has Sheets access),
    // then fall back to Apps Script. This means topics ALWAYS work regardless of
    // whether APPS_SCRIPT_WEB_APP_URL is configured.

    let directWriteId: string | null = null;
    let directWriteError: string | null = null;

    try {
      directWriteId = await createPost(token, {
        clientId:    body.clientId || requestedBy || "client",
        content:     `[TOPIC IDEA] ${content}`,
        platforms,
        mediaUrl:    body.mediaUrl || undefined,
        scheduledAt: "",
        status:      "draft",
      });
    } catch (err: any) {
      directWriteError = err.message;
    }

    // Also notify VA via Apps Script (non-fatal — don't fail if not configured)
    const appsScriptUrl = await getAppsScriptUrl(token);
    if (appsScriptUrl) {
      try {
        await fetch(appsScriptUrl, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "topic_submission",
            topic: {
              title:       content,
              platforms,
              notes:       body.notes || "",
              mediaUrl:    body.mediaUrl || "",
              requestedBy,
            },
          }),
        });
      } catch { /* non-fatal — direct write already succeeded */ }
    }

    if (directWriteId) {
      return NextResponse.json<ApiResult>({ ok: true, data: { id: directWriteId, savedIn: "posts" } }, { status: 201 });
    }

    // If direct write failed and Apps Script is configured, try that as final fallback
    if (appsScriptUrl) {
      const res  = await fetch(appsScriptUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "topic_submission",
          topic: { title: content, platforms, notes: body.notes || "", mediaUrl: body.mediaUrl || "", requestedBy },
        }),
      });
      const text = await res.text();
      if (res.ok) return NextResponse.json<ApiResult>({ ok: true, data: { savedIn: "drafts" } }, { status: 201 });
      return NextResponse.json<ApiResult>({
        ok: false,
        error: `Could not save topic. Direct Sheets error: ${directWriteError}. Apps Script error: ${text.slice(0, 200)}`,
      }, { status: 502 });
    }

    // Both failed
    return NextResponse.json<ApiResult>({
      ok: false,
      error: directWriteError || "Failed to submit topic. Check Google Sheets connection.",
    }, { status: 500 });

  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}