/**
 * lib/sheets.ts
 * Server-side only — never import this in a client component.
 *
 * All functions accept an accessToken (from the user's Google OAuth session).
 * The sheet structure mirrors Section 8 of the build documentation.
 */

import { google } from "googleapis";
import type { Post, Client, AnalyticsRow, PostStatus, Platform } from "@/types";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;

// ── Auth client from access token ─────────────────────────────────────────
function getAuth(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

// ── Sheets client ─────────────────────────────────────────────────────────
function sheets(accessToken: string) {
  return google.sheets({ version: "v4", auth: getAuth(accessToken) });
}

// ── Helper: convert Sheets row array → object ─────────────────────────────
function rowToPost(row: string[], rowIndex: number): Post & { rowIndex: number } {
  return {
    rowIndex,
    id:              row[0]  ?? "",
    clientId:        row[1]  ?? "",
    content:         row[2]  ?? "",
    liOverride:      row[3]  ?? "",
    xOverride:       row[4]  ?? "",
    igOverride:      row[5]  ?? "",
    platforms:       (row[6] ?? "").split(",").filter(Boolean).map(p => p.trim() as Platform),
    mediaUrl:        row[7]  ?? "",
    scheduledAt:     row[8]  ?? "",
    status:          (row[9]  ?? "draft") as PostStatus,
    platformPostIds: row[10] ? JSON.parse(row[10]) : {},
    publishedAt:     row[11] ?? "",
    errorMsg:        row[12] ?? "",
    docLink:         row[13] ?? "",
    createdAt:       row[14] ?? "",
  };
}

// ── Helper: convert Sheets row → Client ──────────────────────────────────
function rowToClient(row: string[]): Client {
  return {
    id:               row[0] ?? "",
    name:             row[1] ?? "",
    email:            row[2] ?? "",
    timezone:         row[3] ?? "UTC",
    makeWebhookUrl:   row[4] ?? "",
    platforms:        (row[5] ?? "").split(",").filter(Boolean).map(p => p.trim() as Platform),
    approvalRequired: row[6] === "TRUE",
    createdAt:        row[7] ?? "",
  };
}

// ── POSTS ─────────────────────────────────────────────────────────────────

/** Read all posts from the Posts tab (rows 2 onward). */
export async function getPosts(accessToken: string): Promise<(Post & { rowIndex: number })[]> {
  const api = sheets(accessToken);
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         "Posts!A2:O",
  });
  const rows = res.data.values ?? [];
  return rows.map((row, i) => rowToPost(row.map(String), i + 2));
}

/** Read a single post by ID. Returns null if not found. */
export async function getPostById(
  accessToken: string,
  postId: string
): Promise<(Post & { rowIndex: number }) | null> {
  const all = await getPosts(accessToken);
  return all.find(p => p.id === postId) ?? null;
}

/** Append a new post row. Returns the generated ID. */
export async function createPost(
  accessToken: string,
  data: Omit<Post, "id" | "createdAt" | "publishedAt" | "platformPostIds" | "errorMsg">
): Promise<string> {
  const api = sheets(accessToken);
  const id  = `post_${Date.now()}`;
  const now = new Date().toISOString();

  await api.spreadsheets.values.append({
    spreadsheetId:     SHEET_ID,
    range:             "Posts!A:O",
    valueInputOption:  "USER_ENTERED",
    requestBody: {
      values: [[
        id,
        data.clientId,
        data.content,
        data.liOverride  ?? "",
        data.xOverride   ?? "",
        data.igOverride  ?? "",
        data.platforms.join(","),
        data.mediaUrl    ?? "",
        data.scheduledAt ?? "",
        data.status,
        "{}",   // platformPostIds
        "",     // publishedAt
        "",     // errorMsg
        data.docLink ?? "",
        now,    // createdAt
      ]],
    },
  });
  return id;
}

/** Update specific columns of an existing row by its 1-based rowIndex. */
export async function updatePostRow(
  accessToken: string,
  rowIndex: number,
  updates: Partial<{
    status:          PostStatus;
    scheduledAt:     string;
    platformPostIds: Record<string, string>;
    publishedAt:     string;
    errorMsg:        string;
  }>
) {
  const api = sheets(accessToken);
  const colMap: Record<string, string> = {
    status:          "J",
    platformPostIds: "K",
    publishedAt:     "L",
    errorMsg:        "M",
    scheduledAt:     "I",
  };

  await Promise.all(
    Object.entries(updates).map(([key, val]) => {
      const col = colMap[key];
      if (!col) return Promise.resolve();
      const value = typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
      return api.spreadsheets.values.update({
        spreadsheetId:    SHEET_ID,
        range:            `Posts!${col}${rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[value]] },
      });
    })
  );
}

// ── CLIENTS ───────────────────────────────────────────────────────────────

/** Read all clients from the Clients tab. */
export async function getClients(accessToken: string): Promise<Client[]> {
  const api = sheets(accessToken);
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         "Clients!A2:H",
  });
  const rows = res.data.values ?? [];
  return rows.map(row => rowToClient(row.map(String)));
}

/** Get a single client by ID. */
export async function getClientById(
  accessToken: string,
  clientId: string
): Promise<Client | null> {
  const all = await getClients(accessToken);
  return all.find(c => c.id === clientId) ?? null;
}

/** Read the Make.com webhook URL and settings from the Settings tab. */
export async function getSettings(accessToken: string): Promise<Record<string, string>> {
  const api = sheets(accessToken);
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         "Settings!A1:B10",
  });
  const rows = res.data.values ?? [];
  const settings: Record<string, string> = {};
  rows.forEach(([key, value]) => {
    if (key) settings[String(key)] = String(value ?? "");
  });
  return settings;
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────

/** Read analytics rows — optionally filtered by platform. */
export async function getAnalytics(
  accessToken: string,
  options?: { platform?: string; limit?: number }
): Promise<AnalyticsRow[]> {
  const api = sheets(accessToken);
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         "Analytics!A2:L",
  });
  let rows = (res.data.values ?? []).map(row => ({
    date:           row[0] ?? "",
    platform:       (row[1] ?? "linkedin") as Platform,
    postId:         row[2] ?? "",
    impressions:    Number(row[3] ?? 0),
    reach:          Number(row[4] ?? 0),
    likes:          Number(row[5] ?? 0),
    comments:       Number(row[6] ?? 0),
    shares:         Number(row[7] ?? 0),
    clicks:         Number(row[8] ?? 0),
    engagementRate: Number(row[9] ?? 0),
    followerCount:  Number(row[10] ?? 0),
    followerDelta:  Number(row[11] ?? 0),
  }));

  if (options?.platform) rows = rows.filter(r => r.platform === options.platform);
  if (options?.limit) rows = rows.slice(-options.limit);
  return rows;
}

/** Append analytics rows (called by the Make.com webhook callback). */
export async function appendAnalytics(
  accessToken: string,
  rows: Omit<AnalyticsRow, "engagementRate">[]
) {
  const api = sheets(accessToken);
  const values = rows.map(r => {
    const eng = r.impressions > 0
      ? (((r.likes + r.comments + r.shares) / r.impressions) * 100).toFixed(2)
      : "0";
    return [r.date, r.platform, r.postId ?? "", r.impressions, r.reach,
            r.likes, r.comments, r.shares, r.clicks, eng,
            r.followerCount, r.followerDelta];
  });

  await api.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            "Analytics!A:L",
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/** Append a row to the Log tab. */
export async function appendLog(
  accessToken: string,
  fn: string,
  postId: string,
  action: string,
  details = ""
) {
  const api = sheets(accessToken);
  await api.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            "Log!A:E",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[new Date().toISOString(), fn, postId, action, details]],
    },
  });
}
