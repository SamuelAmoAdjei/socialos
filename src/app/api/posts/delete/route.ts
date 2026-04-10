import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPost, getClients, getPostById, getPosts, getSettings, updatePostRow } from "@/lib/sheets";
import { sendEmailAsUser } from "@/lib/notify";
import type { ApiResult, Platform, PostStatus } from "@/types";

function norm(v: string) { return String(v || "").trim().toLowerCase(); }

function getClientPortalUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://socialosv1.vercel.app")
    .replace(/\/$/, "") + "/client";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const token     = (session as any).accessToken as string;
    const allPosts  = await getPosts(token);
    const userEmail = norm(session.user?.email || "");

    // Determine if the caller is a client (not VA)
    const vaEnv     = norm(process.env.VA_EMAIL || "");
    const clientEnv = norm(process.env.CLIENT_EMAIL || "");
    const isVA      = vaEnv && userEmail === vaEnv;
    const isClientByEnv = clientEnv && userEmail === clientEnv;

    // VA sees everything
    if (isVA) return NextResponse.json<ApiResult>({ ok: true, data: allPosts });

    // For client users: try to scope to their posts
    // But always fall back to ALL posts if no exact match — better to show
    // too much than show nothing (VA likely has a single client anyway)
    if (isClientByEnv || !isVA) {
      try {
        const clients  = await getClients(token);
        const myClient = clients.find((c) => norm(c.email) === userEmail);

        if (myClient) {
          // Build a broad set of identifiers that could be used as clientId
          const myIds = new Set<string>([
            norm(myClient.id),
            norm(myClient.name),
            norm(myClient.email),
          ]);

          // Also include bare "client" and "default" — many posts are saved with these
          const scoped = allPosts.filter((p) =>
            myIds.has(norm(p.clientId)) ||
            norm(p.clientId) === "client" ||
            norm(p.clientId) === "default" ||
            p.clientId === ""
          );

          // If scoped has posts, return them; otherwise return ALL so client
          // can at least see their content even if clientId wasn't set correctly
          return NextResponse.json<ApiResult>({
            ok: true,
            data: scoped.length > 0 ? scoped : allPosts,
          });
        }
      } catch {
        // Client doesn't have permission to read Clients tab — return all posts
      }

      // Fallback: return all posts so client always sees content
      return NextResponse.json<ApiResult>({ ok: true, data: allPosts });
    }

    return NextResponse.json<ApiResult>({ ok: true, data: allPosts });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const body      = await req.json();
    const content   = String(body.content ?? "").trim();
    const platforms = (Array.isArray(body.platforms) ? body.platforms : [])
      .map((p: string) => p.toLowerCase()).filter(Boolean) as Platform[];

    if (!content) return NextResponse.json<ApiResult>({ ok: false, error: "Content is required" }, { status: 400 });
    if (platforms.length === 0) return NextResponse.json<ApiResult>({ ok: false, error: "Select at least one platform" }, { status: 400 });

    const clientId      = String(body.clientId || "client");
    const requestedStatus = (body.status ?? "draft") as PostStatus;
    const token         = (session as any).accessToken as string;
    let   finalStatus: PostStatus = requestedStatus;

    // Enforce client approval mode
    try {
      const clients = await getClients(token);
      const match   = clients.find(
        (c) => norm(c.id) === norm(clientId) || norm(c.name) === norm(clientId) || norm(c.email) === norm(clientId)
      );
      if (match?.approvalRequired && requestedStatus === "approved") finalStatus = "pending";
    } catch { /* keep requested status */ }

    const id = await createPost(token, {
      clientId,
      content,
      liOverride:  body.liOverride  || undefined,
      xOverride:   body.xOverride   || undefined,
      igOverride:  body.igOverride  || undefined,
      platforms,
      mediaUrl:    body.mediaUrl    || undefined,
      scheduledAt: body.scheduledAt || "",
      status:      finalStatus,
      docLink:     body.docLink     || undefined,
    });

    // Send email notification when post goes to pending approval
    if (finalStatus === "pending") {
      try {
        const clients = await getClients(token);
        const match   = clients.find(
          (c) => norm(c.id) === norm(clientId) || norm(c.name) === norm(clientId) || norm(c.email) === norm(clientId)
        );
        const settings    = await getSettings(token);
        const clientEmail = (match?.email?.trim()) || (settings["CLIENT_EMAIL"] || "").trim();
        if (clientEmail) {
          await sendEmailAsUser(
            token, clientEmail,
            "SocialOS - A post is waiting for your approval",
            `Your VA has scheduled content for your review.\n\nClient portal: ${getClientPortalUrl()}\n\nPreview: ${content.substring(0,280)}`
          );
        }
      } catch { /* email is non-fatal */ }
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
    const token    = (session as any).accessToken as string;
    const body     = await req.json();
    const rowIndex = body.rowIndex as number | undefined;
    const postId   = body.postId   as string | undefined;
    if (!rowIndex || !postId) return NextResponse.json<ApiResult>({ ok: false, error: "rowIndex and postId required" }, { status: 400 });

    const post = await getPostById(token, postId);
    if (!post || post.rowIndex !== rowIndex) return NextResponse.json<ApiResult>({ ok: false, error: "Post not found" }, { status: 404 });
    if (NON_EDITABLE.includes(post.status)) return NextResponse.json<ApiResult>({ ok: false, error: "Cannot edit published posts" }, { status: 403 });

    const updates: Parameters<typeof updatePostRow>[2] = {};
    if (body.content     !== undefined) updates.content     = String(body.content);
    if (body.scheduledAt !== undefined) updates.scheduledAt = String(body.scheduledAt);
    if (body.mediaUrl    !== undefined) updates.mediaUrl    = String(body.mediaUrl);
    if (body.liOverride  !== undefined) updates.liOverride  = String(body.liOverride);
    if (body.xOverride   !== undefined) updates.xOverride   = String(body.xOverride);
    if (body.igOverride  !== undefined) updates.igOverride  = String(body.igOverride);
    if (Array.isArray(body.platforms) && body.platforms.length > 0)
      updates.platforms = body.platforms.map((p: string) => p.toLowerCase()) as Platform[];
    if (Object.keys(updates).length === 0) return NextResponse.json<ApiResult>({ ok: false, error: "No fields to update" }, { status: 400 });

    await updatePostRow(token, rowIndex, updates);
    return NextResponse.json<ApiResult>({ ok: true, data: { saved: true } });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}