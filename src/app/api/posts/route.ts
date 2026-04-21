import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPost, getClients, getPostById, getPosts, getSettings, updatePostRow } from "@/lib/sheets";
import { sendEmailAsUser } from "@/lib/notify";
import { resolveRole } from "@/lib/rbac";
import type { ApiResult, Platform, PostStatus } from "@/types";

function norm(v: string) {
  return String(v || "").trim().toLowerCase();
}

function getClientPortalUrl(): string {
  const base =
    (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://socialosv1.vercel.app")
      .replace(/\/$/, "");
  return `${base}/client`;
}

export async function GET() {
  const roleResult = await resolveRole();
  if (!roleResult) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const rows = await getPosts(roleResult.token);

    // VA sees everything
    if (roleResult.role === "va") {
      return NextResponse.json<ApiResult>({ ok: true, data: rows });
    }

    // Client sees their own posts
    if (roleResult.role === "client") {
      try {
        const clients = await getClients(roleResult.token);
        
        // Match 1: By exact email
        let myClient = clients.find((c) => norm(c.email) === roleResult.email);

        // Match 2: Fallback to Google Account name if email mismatched
        if (!myClient) {
          const session = await getServerSession(authOptions);
          if (session?.user?.name) {
            const sessionName = norm(session.user.name);
            myClient = clients.find(c => norm(c.name) === sessionName);
          }
        }
        
        // Match 3: If user is the primary master env client AND there's only 1 client in the spreadsheet, assume it's them
        if (!myClient && clients.length === 1 && roleResult.email === norm(process.env.CLIENT_EMAIL || "")) {
          myClient = clients[0];
        }

        if (myClient) {
          // Build a comprehensive set of IDs this client could be filed under
          const myIds = new Set([
            norm(myClient.id), 
            norm(myClient.name), 
            norm(myClient.email),
          ].filter(Boolean));
          
          // Also add CLIENT_EMAIL env var if it matches this client
          const envClientEmail = norm(process.env.CLIENT_EMAIL || "");
          if (envClientEmail && envClientEmail === norm(myClient.email)) {
            myIds.add(envClientEmail);
          }
          
          const scoped = rows.filter((p) => 
            myIds.has(norm(p.clientId)) ||
            norm(p.clientId) === "client" ||
            norm(p.clientId) === "default" ||
            p.clientId === ""
          );
          return NextResponse.json<ApiResult>({ ok: true, data: scoped });
        }
      } catch {
        // Fallback if client lookup fails. Allow seeing default items so portal isn't broken.
      }
      
      // No matching Clients row found.
      // If this is the primary (env-var) client, they should see ALL posts — single-client setup.
      const envClientEmail = norm(process.env.CLIENT_EMAIL || "");
      if (envClientEmail && roleResult.email === envClientEmail) {
        return NextResponse.json<ApiResult>({ ok: true, data: rows });
      }

      // True fallback — unknown client, show only explicitly open posts
      const scopedFallback = rows.filter((p) => 
        norm(p.clientId) === "client" ||
        norm(p.clientId) === "default" ||
        p.clientId === ""
      );
      return NextResponse.json<ApiResult>({ ok: true, data: scopedFallback });
    }

    return NextResponse.json<ApiResult>({ ok: true, data: [] });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const roleResult = await resolveRole();
  if (!roleResult) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  if (roleResult.role !== "va") return NextResponse.json({ ok: false, error: "Only the VA can create posts" }, { status: 403 });

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
    const token = roleResult.token;
    let finalStatus: PostStatus = requestedStatus;

    // Enforce client approval mode based on the Clients sheet.
    // If this client requires approval, scheduling should go to "pending" first.
    let matchedClient: Awaited<ReturnType<typeof getClients>>[number] | null = null;
    try {
      const clients = await getClients(token);
      matchedClient = clients.find(
        (c) =>
          norm(c.id) === norm(clientId) ||
          norm(c.name) === norm(clientId) ||
          norm(c.email) === norm(clientId)
      ) ?? null;

      if (matchedClient?.approvalRequired && requestedStatus === "approved") {
        finalStatus = "pending";
      }
    } catch {
      // If client lookup fails, keep requested status to avoid blocking post creation.
    }

    const id = await createPost(token, {
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
        // Reuse matchedClient from above — no duplicate API call
        const settings = await getSettings(token);
        const clientEmail =
          (matchedClient?.email && matchedClient.email.trim()) ||
          (settings["CLIENT_EMAIL"] || "").trim();
        const portal = getClientPortalUrl();
        if (clientEmail) {
          await sendEmailAsUser(
            token,
            clientEmail,
            "SocialOS - A post is waiting for your approval",
            `Your VA has scheduled content for review.\n\n` +
              `Client portal link (tap to open): ${portal}\n` +
              `Client portal URL: ${portal}\n\n` +
              `Post ID: ${id}\n` +
              `Preview: ${content.substring(0, 280)}${content.length > 280 ? "..." : ""}\n`
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
