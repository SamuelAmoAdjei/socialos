/**
 * lib/sheets.ts  — server-side only.
 *
 * Key improvements in this version:
 * 1. Tab name resolver — handles capitalisation mismatches between code and actual sheet tabs
 * 2. Uses drive.readonly scope (not drive.file) so it can access user-created sheets
 * 3. All range strings go through resolveTab() before being sent to the API
 */

import { google } from "googleapis";
import type { Post, Client, AnalyticsRow, PostStatus, Platform } from "@/types";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;

// ── Auth ─────────────────────────────────────────────────────────────────────
function getAuth(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}
function shts(accessToken: string) {
  return google.sheets({ version: "v4", auth: getAuth(accessToken) });
}

// ── Tab name resolver ─────────────────────────────────────────────────────────
// Fetches the real tab names from the sheet once per process restart.
// This means if your tabs are named "posts" or "POSTS" instead of "Posts"
// the code still works — it finds the closest match case-insensitively.
const tabCacheByToken: Record<string, Record<string,string>> = {};

async function resolveTab(accessToken: string, desired: string): Promise<string> {
  // Use a short key so we don't store huge tokens as keys
  const cacheKey = accessToken.slice(-16);

  if (!tabCacheByToken[cacheKey]) {
    try {
      const api = shts(accessToken);
      const meta = await api.spreadsheets.get({ spreadsheetId: SHEET_ID });
      const cache: Record<string,string> = {};
      for (const sheet of meta.data.sheets ?? []) {
        const title = sheet.properties?.title ?? "";
        cache[title]             = title;   // exact
        cache[title.toLowerCase()]= title;  // lowercase key → real title
      }
      tabCacheByToken[cacheKey] = cache;
    } catch {
      return desired;  // if metadata fails, fall back to the desired name
    }
  }

  const cache = tabCacheByToken[cacheKey];
  // Try exact first, then lowercase match
  return cache[desired] ?? cache[desired.toLowerCase()] ?? desired;
}

/** Build a full range string like "Posts!A2:O" using the resolved tab name */
async function r(accessToken: string, tab: string, cells: string): Promise<string> {
  const resolved = await resolveTab(accessToken, tab);
  return `${resolved}!${cells}`;
}

// ── Row converters ────────────────────────────────────────────────────────────
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
    platformPostIds: row[10] ? (() => { try { return JSON.parse(row[10]); } catch { return {}; } })() : {},
    publishedAt:     row[11] ?? "",
    errorMsg:        row[12] ?? "",
    docLink:         row[13] ?? "",
    createdAt:       row[14] ?? "",
  };
}

function rowToClient(row: string[]): Client {
  return {
    id:               row[0] ?? "",
    name:             row[1] ?? "",
    email:            row[2] ?? "",
    timezone:         row[3] ?? "UTC",
    makeWebhookUrl:   row[4] ?? "",
    platforms:        (row[5] ?? "").split(",").filter(Boolean).map(p => p.trim() as Platform),
    approvalRequired: row[6]?.toUpperCase() === "TRUE",
    createdAt:        row[7] ?? "",
  };
}

// ── POSTS ─────────────────────────────────────────────────────────────────────

export async function getPosts(accessToken: string): Promise<(Post & { rowIndex: number })[]> {
  const api = shts(accessToken);
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         await r(accessToken, "Posts", "A2:O"),
  });
  const rows = res.data.values ?? [];
  return rows.map((row, i) => rowToPost(row.map(String), i + 2));
}

export async function getPostById(
  accessToken: string,
  postId: string
): Promise<(Post & { rowIndex: number }) | null> {
  const all = await getPosts(accessToken);
  return all.find(p => p.id === postId) ?? null;
}

export async function createPost(
  accessToken: string,
  data: Omit<Post, "id" | "createdAt" | "publishedAt" | "platformPostIds" | "errorMsg">
): Promise<string> {
  const api = shts(accessToken);
  const id  = `post_${Date.now()}`;
  const now = new Date().toISOString();

  await api.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            await r(accessToken, "Posts", "A:O"),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[
      id, data.clientId, data.content,
      data.liOverride ?? "", data.xOverride ?? "", data.igOverride ?? "",
      data.platforms.join(","), data.mediaUrl ?? "",
      data.scheduledAt ?? "", data.status,
      "{}", "", "", data.docLink ?? "", now,
    ]]},
  });
  return id;
}

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
  const api = shts(accessToken);
  const tabName = await resolveTab(accessToken, "Posts");
  const colMap: Record<string,string> = {
    status:"J", platformPostIds:"K", publishedAt:"L", errorMsg:"M", scheduledAt:"I",
  };
  await Promise.all(
    Object.entries(updates).map(([key, val]) => {
      const col = colMap[key];
      if (!col) return Promise.resolve();
      const value = typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
      return api.spreadsheets.values.update({
        spreadsheetId:    SHEET_ID,
        range:            `${tabName}!${col}${rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody:      { values: [[value]] },
      });
    })
  );
}

// ── CLIENTS ───────────────────────────────────────────────────────────────────

export async function getClients(accessToken: string): Promise<Client[]> {
  const api = shts(accessToken);
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         await r(accessToken, "Clients", "A2:H"),
  });
  const rows = res.data.values ?? [];
  return rows.map(row => rowToClient(row.map(String)));
}

export async function getClientById(
  accessToken: string,
  clientId: string
): Promise<Client | null> {
  const all = await getClients(accessToken);
  return all.find(c => c.id === clientId) ?? null;
}

export async function createClient(
  accessToken: string,
  client: Omit<Client, "createdAt">
): Promise<string> {
  const api = shts(accessToken);
  const id  = "client_" + Date.now();
  await api.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            await r(accessToken, "Clients", "A:H"),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[
      id, client.name, client.email, client.timezone,
      client.makeWebhookUrl ?? "", client.platforms.join(","),
      client.approvalRequired ? "TRUE" : "FALSE",
      new Date().toISOString(),
    ]]},
  });
  return id;
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────

export async function getSettings(accessToken: string): Promise<Record<string,string>> {
  const api = shts(accessToken);
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         await r(accessToken, "Settings", "A1:B20"),
  });
  const settings: Record<string,string> = {};
  for (const [key, value] of (res.data.values ?? [])) {
    if (key) settings[String(key)] = String(value ?? "");
  }
  return settings;
}

export async function updateSettings(
  accessToken: string,
  updates: Record<string,string>
) {
  const api = shts(accessToken);
  const tabName = await resolveTab(accessToken, "Settings");

  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${tabName}!A1:B20`,
  });
  const rows = res.data.values ?? [];

  const data = Object.entries(updates).map(([key, value]) => {
    const idx = rows.findIndex(r => String(r[0]) === key);
    if (idx === -1) return null;
    return { range:`${tabName}!B${idx + 1}`, values:[[value]] };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  if (data.length === 0) return;

  await api.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody:   { valueInputOption:"USER_ENTERED", data },
  });
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────

export async function getAnalytics(
  accessToken: string,
  options?: { platform?: string; limit?: number }
): Promise<AnalyticsRow[]> {
  const api = shts(accessToken);
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         await r(accessToken, "Analytics", "A2:L"),
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
  if (options?.limit)    rows = rows.slice(-options.limit);
  return rows;
}

export async function appendAnalytics(
  accessToken: string,
  rows: Omit<AnalyticsRow, "engagementRate">[]
) {
  const api = shts(accessToken);
  const values = rows.map(rw => {
    const eng = rw.impressions > 0
      ? (((rw.likes + rw.comments + rw.shares) / rw.impressions) * 100).toFixed(2)
      : "0";
    return [rw.date, rw.platform, rw.postId ?? "", rw.impressions, rw.reach,
            rw.likes, rw.comments, rw.shares, rw.clicks, eng,
            rw.followerCount, rw.followerDelta];
  });
  await api.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            await r(accessToken, "Analytics", "A:L"),
    valueInputOption: "USER_ENTERED",
    requestBody:      { values },
  });
}

// ── LOG ───────────────────────────────────────────────────────────────────────

export async function appendLog(
  accessToken: string,
  fn: string,
  postId: string,
  action: string,
  details = ""
) {
  const api = shts(accessToken);
  await api.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            await r(accessToken, "Log", "A:E"),
    valueInputOption: "USER_ENTERED",
    requestBody:      { values: [[new Date().toISOString(), fn, postId, action, details]] },
  });
}