import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPost, getSettings } from "@/lib/sheets";
import type { ApiResult, Platform } from "@/types";

function isPermissionError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("caller does not have permission") ||
    m.includes("does not have permission") ||
    m.includes("insufficient permission") ||
    m.includes("permission denied")
  );
}

async function sendTopicToAppsScript(
  token: string,
  content: string,
  platforms: Platform[],
  body: any,
  requestedBy: string
) {
  const settings = await getSettings(token);
  const callbackUrl = settings["CALLBACK_URL"] || settings["callback_url"] || "";
  if (!callbackUrl) {
    return NextResponse.json<ApiResult>({
      ok: false,
      error: "CALLBACK_URL is not configured in Settings. Set it in Dashboard -> Settings -> Make.com.",
    }, { status: 400 });
  }

  const payload = {
    type: "topic_submission",
    topic: {
      title: content,
      platforms,
      notes: body.notes || "",
      mediaUrl: body.mediaUrl || "",
      requestedBy,
    },
  };

  const res = await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json<ApiResult>({
      ok: false,
      error: `Apps Script topic submission failed: ${text.slice(0, 200)}`,
    }, { status: 502 });
  }
  return NextResponse.json<ApiResult>({ ok: true, data: { savedIn: "drafts" } }, { status: 201 });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const token = (session as any).accessToken as string;
    const body = await req.json();
    const content = String(body.content ?? "").trim();
    const platforms = (Array.isArray(body.platforms) ? body.platforms : [])
      .map((p: string) => p.toLowerCase())
      .filter(Boolean) as Platform[];

    if (!content) {
      return NextResponse.json<ApiResult>({ ok: false, error: "Topic is required" }, { status: 400 });
    }
    if (platforms.length === 0) {
      return NextResponse.json<ApiResult>({ ok: false, error: "Select at least one platform" }, { status: 400 });
    }

    const requestedBy = String(session.user?.email || "");

    // Client-originated topic submissions should go through Apps Script first
    // because client accounts often don't have direct write access to all tabs.
    const fromClientPortal =
      !!requestedBy &&
      (String(body.clientId || "").toLowerCase().trim() === requestedBy.toLowerCase().trim());
    if (fromClientPortal) {
      return await sendTopicToAppsScript(token, content, platforms, body, requestedBy);
    }

    // Primary VA path: write as a draft topic into Posts tab.
    try {
      const id = await createPost(token, {
        clientId: body.clientId || session.user?.email || "client",
        content: `[TOPIC IDEA] ${content}`,
        liOverride: undefined,
        xOverride: undefined,
        igOverride: undefined,
        platforms,
        mediaUrl: body.mediaUrl || undefined,
        scheduledAt: "",
        status: "draft",
        docLink: undefined,
      });
      return NextResponse.json<ApiResult>({ ok: true, data: { id, savedIn: "posts" } }, { status: 201 });
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (isPermissionError(msg)) {
        return await sendTopicToAppsScript(token, content, platforms, body, requestedBy);
      }
      throw err;
    }
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}
