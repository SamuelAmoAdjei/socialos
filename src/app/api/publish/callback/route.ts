/**
 * POST /api/publish/callback
 * Called by Make.com after it finishes publishing to all platforms.
 * Also handles the analytics sync payload (type: "analytics").
 */
import { NextRequest, NextResponse } from "next/server";
import { getPostById, updatePostRow, appendLog, appendAnalytics } from "@/lib/sheets";
import type { Platform } from "@/types";

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

    return NextResponse.json({ ok: true, status: newStatus });

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
