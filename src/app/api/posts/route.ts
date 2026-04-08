import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPost, getClients, getPostById, getPosts, getSettings, updatePostRow } from "@/lib/sheets";
import { sendEmailAsUser } from "@/lib/notify";
import type { ApiResult, Platform, PostStatus } from "@/types";

function norm(v: string) {
  return String(v || "").trim().toLowerCase();
}

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

    const clientId = String(body.clientId || "client");
    const requestedStatus = (body.status ?? "draft") as PostStatus;
    const token = (session as any).accessToken as string;
    let finalStatus: PostStatus = requestedStatus;

    // Enforce client approval mode based on the Clients sheet.
    // If this client requires approval, scheduling should go to "pending" first.
    try {
      const clients = await getClients(token);
      const match = clients.find(
        (c) =>
          norm(c.id) === norm(clientId) ||
          norm(c.name) === norm(clientId) ||
          norm(c.email) === norm(clientId)
      );

      if (match?.approvalRequired && requestedStatus === "approved") {
        finalStatus = "pending";
      }
    } catch {
      // If client lookup fails, keep requested status to avoid blocking post creation.
    }

    const id = await createPost((session as any).accessToken as string, {
      clientId,
      content,
      liOverride: body.liOverride || undefined,
      xOverride: body.xOverride || undefined,
      igOverride: body.igOverride || undefined,
      platforms,
      mediaUrl: body.mediaUrl || undefined,
      scheduledAt: body.scheduledAt || "",
      status: finalStatus,
      docLink: body.docLink || undefined,
    });

    if (finalStatus === "pending") {
      try {
        const clients = await getClients(token);
        const match = clients.find(
          (c) =>
            norm(c.id) === norm(clientId) ||
            norm(c.name) === norm(clientId) ||
            norm(c.email) === norm(clientId)
        );
        const settings = await getSettings(token);
        const clientEmail =
          (match?.email && match.email.trim()) ||
          (settings["CLIENT_EMAIL"] || "").trim();
        const appBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
        const portal = appBase ? `${appBase}/client` : "/client";
        if (clientEmail) {
          await sendEmailAsUser(
            token,
            clientEmail,
            "SocialOS — a post is waiting for your approval",
            `Your VA has scheduled content for review.\n\n` +
              `Open your client portal: ${portal}\n\n` +
              `Post ID: ${id}\n` +
              `Preview: ${content.substring(0, 280)}${content.length > 280 ? "…" : ""}\n`
          );
        }
      } catch {
        // Gmail scope or quota — post still created
      }
    }

    return NextResponse.json<ApiResult>({ ok: true, data: { id, status: finalStatus } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}

const NON_EDITABLE: PostStatus[] = ["published", "partial", "publishing"];

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const token = (session as any).accessToken as string;
    const body = await req.json();
    const rowIndex = body.rowIndex as number | undefined;
    const postId = body.postId as string | undefined;
    if (!rowIndex || !postId) {
      return NextResponse.json<ApiResult>({ ok: false, error: "rowIndex and postId required" }, { status: 400 });
    }

    const post = await getPostById(token, postId);
    if (!post || post.rowIndex !== rowIndex) {
      return NextResponse.json<ApiResult>({ ok: false, error: "Post not found" }, { status: 404 });
    }
    if (NON_EDITABLE.includes(post.status)) {
      return NextResponse.json<ApiResult>(
        { ok: false, error: "Cannot edit published or in-flight posts" },
        { status: 403 }
      );
    }

    const updates: Parameters<typeof updatePostRow>[2] = {};
    if (body.content !== undefined) updates.content = String(body.content);
    if (body.scheduledAt !== undefined) updates.scheduledAt = String(body.scheduledAt);
    if (body.mediaUrl !== undefined) updates.mediaUrl = String(body.mediaUrl);
    if (body.liOverride !== undefined) updates.liOverride = String(body.liOverride);
    if (body.xOverride !== undefined) updates.xOverride = String(body.xOverride);
    if (body.igOverride !== undefined) updates.igOverride = String(body.igOverride);
    if (Array.isArray(body.platforms) && body.platforms.length > 0) {
      updates.platforms = body.platforms.map((p: string) => p.toLowerCase()) as Platform[];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<ApiResult>({ ok: false, error: "No fields to update" }, { status: 400 });
    }

    await updatePostRow(token, rowIndex, updates);
    return NextResponse.json<ApiResult>({ ok: true, data: { saved: true } });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}
