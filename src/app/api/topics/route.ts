/**
 * POST /api/topics
 * Called by the client portal when submitting a topic idea.
 * 
 * Strategy:
 *   1. Try to write directly to the Posts Sheet (works if client has Sheets scope)
 *   2. Always also forward to Apps Script (for email notification + Drafts tab)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPost } from "@/lib/sheets";
import type { ApiResult, Platform } from "@/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const body = await req.json();
    const { content, platforms, mediaUrl, clientId } = body;

    if (!content?.trim()) {
      return NextResponse.json<ApiResult>({ ok: false, error: "Topic content is required" }, { status: 400 });
    }

    const token = (session as any).accessToken as string;
    let postId: string | null = null;

    // 1. Write to Posts tab as a draft (with [TOPIC] prefix so VA can filter)
    try {
      postId = await createPost(token, {
        clientId:    clientId ?? session.user?.email ?? "client",
        content:     `[TOPIC IDEA] ${content}`,
        platforms:   (platforms ?? []) as Platform[],
        mediaUrl:    mediaUrl ?? "",
        scheduledAt: "",
        status:      "draft",
      });
    } catch (sheetErr: any) {
      // If direct write fails (client scope issue), we'll rely on Apps Script path below
      console.error("Direct sheet write failed for topic:", sheetErr.message);
    }

    // 2. Also forward to Apps Script for Drafts tab + email notification
    const appsScriptUrl = process.env.APPS_SCRIPT_URL;
    if (appsScriptUrl) {
      try {
        await fetch(appsScriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "topic_submission",
            topic: {
              title:       content,
              platforms:   platforms ?? [],
              mediaUrl:    mediaUrl ?? "",
              requestedBy: session.user?.email ?? "client",
            },
          }),
        });
      } catch (asErr: any) {
        // Non-fatal — direct write may have already succeeded
        console.error("Apps Script forward failed:", asErr.message);
      }
    }

    // If neither worked, return error
    if (!postId && !appsScriptUrl) {
      return NextResponse.json<ApiResult>({
        ok: false,
        error: "Could not save topic. Check APPS_SCRIPT_URL env var or Google Sheets connection.",
      }, { status: 500 });
    }

    return NextResponse.json<ApiResult>({
      ok: true,
      data: { id: postId, message: "Topic submitted successfully" },
    }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}