/**
 * POST /api/publish/callback
 * Called by Make.com after it finishes publishing to all platforms.
 * Also handles the analytics sync payload (type: "analytics").
 */
import { NextRequest, NextResponse } from "next/server";
import { getPostById, updatePostRow, appendLog, appendAnalytics, getClients, getSettings } from "@/lib/sheets";
import { sendEmailAsUser } from "@/lib/notify";
import type { Platform } from "@/types";

function norm(v: string) {
  return String(v || "").trim().toLowerCase();
}

function getClientPortalUrl(): string {
  const base =
    (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://socialosv1.vercel.app")
      .replace(/\/$/, "");
  return `${base}/client`;
}

// The callback uses a shared secret instead of a user session
// because Make.com calls it server-to-server.
const CALLBACK_SECRET = process.env.MAKE_CALLBACK_SECRET ?? "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify shared secret if configured
    const incomingSecret = req.headers.get("x-socialos-secret") ?? body.secret ?? "";
    if (CALLBACK_SECRET && incomingSecret !== CALLBACK_SECRET) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // ── Analytics sync (from Make.com Scenario 2) ──────────────────────
    if (body.type === "analytics") {
      const accessToken = body.accessToken || body.access_token;
      const { data } = body;
      if (!accessToken || !Array.isArray(data)) {
        return NextResponse.json({ ok: false, error: "Missing accessToken or data" }, { status: 400 });
      }
      await appendAnalytics(accessToken, data);
      return NextResponse.json({ ok: true });
    }

    // ── Publish result (from Make.com Scenario 1) ─────────────────────
    const post_id = body.post_id || body.postId;
    const access_token = body.access_token || body.accessToken;
    const rawResults = body.results || body.aggregated_results || body.platform_results;
    const results = Array.isArray(rawResults)
      ? rawResults
      : rawResults && typeof rawResults === "object"
        ? Object.entries(rawResults).map(([platform, item]: [string, any]) => ({
            platform,
            status: item?.status || "failed",
            post_id: item?.post_id || "",
            error: item?.error || "",
          }))
        : [];

    if (!post_id || !Array.isArray(results) || results.length === 0 || !access_token) {
      return NextResponse.json({ ok: false, error: "Missing post_id, results, or access_token" }, { status: 400 });
    }

    // Find the post row
    const post = await getPostById(access_token, post_id);
    if (!post) {
      return NextResponse.json({ ok: false, error: `Post ${post_id} not found` }, { status: 404 });
    }

    const successes = results.filter((r: any) => r.status === "success");
    const failures  = results.filter((r: any) => r.status === "failed");

    const platformPostIds: Partial<Record<Platform, string>> = {};
    successes.forEach((r: any) => {
      platformPostIds[r.platform as Platform] = r.post_id;
    });

    const newStatus =
      failures.length === 0     ? "published"  :
      successes.length === 0    ? "failed"      :
                                  "partial";

    const errorMsg = failures.length > 0
      ? failures.map((f: any) => `${f.platform}: ${f.error}`).join(" | ")
      : "";

    await updatePostRow(access_token, post.rowIndex, {
      status:          newStatus as any,
      platformPostIds: platformPostIds as any,
      publishedAt:     new Date().toISOString(),
      errorMsg,
    });

    await appendLog(
      access_token,
      "callback",
      post_id,
      newStatus,
      JSON.stringify(results)
    );

    if (newStatus === "published" || newStatus === "partial") {
      try {
        const clients = await getClients(access_token);
        const match = clients.find(
          (c) =>
            norm(c.id) === norm(post.clientId) ||
            norm(c.name) === norm(post.clientId) ||
            norm(c.email) === norm(post.clientId)
        );
        const settings = await getSettings(access_token);
        const clientEmail =
          (match?.email && match.email.trim()) ||
          (settings["CLIENT_EMAIL"] || "").trim();
        const vaEmail = (settings["VA_EMAIL"] || "").trim();
        const portal = getClientPortalUrl();
        if (clientEmail) {
          const subj =
            newStatus === "published"
              ? "SocialOS - Your post was published"
              : "SocialOS - Your post was partially published";
          await sendEmailAsUser(
            access_token,
            clientEmail,
            subj,
            `Status: ${newStatus}\n\n` +
              `Post ID: ${post_id}\n` +
              (post.content ? `Content preview: ${post.content.substring(0, 400)}${post.content.length > 400 ? "..." : ""}\n\n` : "") +
              `Client portal link (tap to open): ${portal}\n` +
              `Client portal URL: ${portal}\n` +
              (errorMsg ? `\nNote: ${errorMsg}\n` : "")
          );
        }
        if (vaEmail && clientEmail && vaEmail.toLowerCase() !== clientEmail.toLowerCase()) {
          await sendEmailAsUser(
            access_token,
            vaEmail,
            `SocialOS - Publish complete (${newStatus})`,
            `Post ${post_id} finished as ${newStatus}.\n${errorMsg ? errorMsg + "\n" : ""}`
          );
        }
      } catch {
        // gmail.send missing or quota — sheet still updated
      }
    }

    return NextResponse.json({ ok: true, status: newStatus });

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
