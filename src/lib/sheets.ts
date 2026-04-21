/**
 * lib/sheets.ts — server-side only.
 *
 * AUTH STRATEGY (in priority order):
 * 1. Google Service Account (GOOGLE_SERVICE_ACCOUNT_KEY env var, base64-encoded JSON)
 *    → Always has access regardless of who is logged in. Best for production.
 * 2. VA Token Relay (VA_REFRESH_TOKEN env var)
 *    → Uses the VA's OAuth refresh token to get a fresh access token.
 *    → Works without service account or sheet sharing. Good for org-managed accounts.
 * 3. User's own OAuth access token (from NextAuth session)
 *    → Works only when the Sheet is shared with the user.
 */
import { google } from "googleapis";
import type { Post, Client, AnalyticsRow, PostStatus, Platform } from "@/types";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;

// ── Strategy 1: Service Account (cached singleton) ────────────────────────────
let _serviceAuth: ReturnType<typeof google.auth.GoogleAuth.prototype.getClient> extends Promise<infer T> ? T : never;
let _serviceAuthResolved = false;

function getServiceAuth() {
  if (_serviceAuthResolved) return _serviceAuth ? google.sheets({ version: "v4", auth: _serviceAuth as any }) : null;
  _serviceAuthResolved = true;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const key = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    _serviceAuth = auth as any;
    return google.sheets({ version: "v4", auth: auth as any });
  } catch (e) {
    console.error("[SocialOS] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:", e);
    return null;
  }
}

// ── Strategy 2: VA Token Relay ────────────────────────────────────────────────
// Set VA_REFRESH_TOKEN in Vercel. The VA can find their token at /api/admin/relay-token.
let _vaAccessToken: string | null = null;
let _vaTokenExpiry = 0;

/**
 * Call at the start of every public async function.
 * Refreshes the VA's access token from their stored refresh token if needed.
 */
async function ensureVaRelay(): Promise<void> {
  // Skip if service account is available (preferred)
  if (getServiceAuth()) return;

  const refreshToken = process.env.VA_REFRESH_TOKEN;
  if (!refreshToken) return;

  // Return if cached token is still valid
  if (_vaAccessToken && Date.now() < _vaTokenExpiry) return;

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("[SocialOS] VA token relay refresh failed:", data);
      return;
    }
    _vaAccessToken = data.access_token;
    _vaTokenExpiry = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;
  } catch (e) {
    console.error("[SocialOS] VA token relay error:", e);
  }
}

// ── User OAuth fallback ───────────────────────────────────────────────────────
function getAuth(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

/**
 * Returns a Google Sheets API client using the best available auth.
 * Priority: Service Account → VA Relay Token → User's own token.
 */
function shts(accessToken: string) {
  const sa = getServiceAuth();
  if (sa) return sa;
  // Use VA relay token if available, otherwise the caller's token
  const effectiveToken = _vaAccessToken || accessToken;
  return google.sheets({ version: "v4", auth: getAuth(effectiveToken) });
}

// ── Tab name resolver ─────────────────────────────────────────────────────────
// Tries to find the real tab name case-insensitively.
// Falls back to the desired name if anything fails — never throws.
async function resolveTab(accessToken: string, desired: string): Promise<string> {
  try {
    const api  = shts(accessToken);
    const meta = await api.spreadsheets.get({ spreadsheetId: SHEET_ID });
    for (const sheet of meta.data.sheets ?? []) {
      const title = sheet.properties?.title ?? "";
      if (title.toLowerCase() === desired.toLowerCase()) return title;
      if (title === desired) return title;
    }
  } catch {
    // If metadata fetch fails, use the desired name as-is
  }
  return desired;
}

async function range(accessToken: string, tab: string, cells: string): Promise<string> {
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
    platformPostIds: (() => { try { return JSON.parse(row[10] || "{}"); } catch { return {}; } })(),
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
  await ensureVaRelay();
  const api = shts(accessToken);
  const rng = await range(accessToken, "Posts", "A2:O");
  const res = await api.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: rng });
  return (res.data.values ?? []).map((row, i) => rowToPost(row.map(String), i + 2));
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
  await ensureVaRelay();
  if (!accessToken) throw new Error("No access token — please sign out and sign back in");
  if (!SHEET_ID)    throw new Error("GOOGLE_SHEETS_ID environment variable is not set");

  const api = shts(accessToken);
  const id  = `post_${Date.now()}`;
  const now = new Date().toISOString();
  const rng = await range(accessToken, "Posts", "A:O");

  await api.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            rng,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        id,
        data.clientId || "default",
        data.content  || "",
        data.liOverride  ?? "",
        data.xOverride   ?? "",
        data.igOverride  ?? "",
        (data.platforms ?? []).join(","),
        data.mediaUrl    ?? "",
        data.scheduledAt ?? "",
        data.status      || "draft",
        "{}",
        "",
        "",
        data.docLink ?? "",
        now,
      ]],
    },
  });
  return id;
}

export async function updatePostRow(
  accessToken: string,
  rowIndex: number,
  updates: Partial<{
    status:          PostStatus;
    content:         string;
    scheduledAt:     string;
    platformPostIds: Record<string, string>;
    publishedAt:     string;
    errorMsg:        string;
    note:            string;
    platforms:       Platform[];
    mediaUrl:        string;
    liOverride:      string;
    xOverride:       string;
    igOverride:      string;
  }>
) {
  await ensureVaRelay();
  const api     = shts(accessToken);
  const tabName = await resolveTab(accessToken, "Posts");
  const colMap: Record<string,string> = {
    status:"J", platformPostIds:"K", publishedAt:"L", errorMsg:"M", scheduledAt:"I",
    content:"C",
    note:"N",
    platforms:"G",
    mediaUrl: "H",
    liOverride: "D",
    xOverride: "E",
    igOverride: "F",
  };
  await Promise.all(
    Object.entries(updates).map(([key, val]) => {
      const col = colMap[key];
      if (!col) return Promise.resolve();
      let value: string;
      if (key === "platforms" && Array.isArray(val)) {
        value = val.join(",");
      } else if (typeof val === "object" && val !== null) {
        value = JSON.stringify(val);
      } else {
        value = String(val ?? "");
      }
      return api.spreadsheets.values.update({
        spreadsheetId:    SHEET_ID,
        range:            `${tabName}!${col}${rowIndex}`,
        valueInputOption: "RAW",  // RAW preserves line breaks and special chars
        requestBody:      { values: [[value]] },
      });
    })
  );
}

export type DraftTopicRow = {
  rowIndex: number;
  docLink: string;
  title: string;
  platforms: string;
  targetDate: string;
  stage: string;
  notes: string;
};

/** Client-submitted topics and ideas in the Drafts tab (best-effort). */
export async function getDraftTopics(accessToken: string): Promise<DraftTopicRow[]> {
  await ensureVaRelay();
  const api = shts(accessToken);
  const rng = await range(accessToken, "Drafts", "A2:F");
  const res = await api.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: rng });
  return (res.data.values ?? []).map((row, i) => ({
    rowIndex: i + 2,
    docLink:  String(row[0] ?? ""),
    title:    String(row[1] ?? ""),
    platforms: String(row[2] ?? ""),
    targetDate: String(row[3] ?? ""),
    stage:    String(row[4] ?? ""),
    notes:    String(row[5] ?? ""),
  }));
}

/** Append a new row to the Drafts tab (for client topic submissions). */
export async function appendDraftTopic(
  accessToken: string,
  topic: { docLink?: string; title: string; platforms: string; targetDate?: string; stage?: string; notes?: string }
): Promise<void> {
  await ensureVaRelay();
  const api = shts(accessToken);
  const rng = await range(accessToken, "Drafts", "A:F");
  await api.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            rng,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        topic.docLink ?? "",
        topic.title,
        topic.platforms,
        topic.targetDate ?? new Date().toISOString(),
        topic.stage ?? "idea",
        topic.notes ?? "",
      ]],
    },
  });
}

function normEmail(s: string) {
  return (s ?? "").toLowerCase().trim();
}

export async function updateClientApprovalRequired(
  accessToken: string,
  clientEmail: string,
  approvalRequired: boolean
): Promise<void> {
  await ensureVaRelay();
  const api = shts(accessToken);
  const tabName = await resolveTab(accessToken, "Clients");
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A2:H`,
  });
  const rows = res.data.values ?? [];
  const idx = rows.findIndex((row) => normEmail(String(row[2] ?? "")) === normEmail(clientEmail));
  if (idx === -1) throw new Error("Client record not found for this email");
  const rowIndex = idx + 2;
  await api.spreadsheets.values.update({
    spreadsheetId:    SHEET_ID,
    range:            `${tabName}!G${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody:      { values: [[approvalRequired ? "TRUE" : "FALSE"]] },
  });
}

// ── CLIENTS ───────────────────────────────────────────────────────────────────

export async function getClients(accessToken: string): Promise<Client[]> {
  await ensureVaRelay();
  const api = shts(accessToken);
  const rng = await range(accessToken, "Clients", "A2:H");
  const res = await api.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: rng });
  return (res.data.values ?? []).map(row => rowToClient(row.map(String)));
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
  await ensureVaRelay();
  const api = shts(accessToken);
  const id  = "client_" + Date.now();
  const rng = await range(accessToken, "Clients", "A:H");
  await api.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            rng,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        id, client.name, client.email, client.timezone,
        client.makeWebhookUrl ?? "", client.platforms.join(","),
        client.approvalRequired ? "TRUE" : "FALSE",
        new Date().toISOString(),
      ]],
    },
  });
  return id;
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────

export async function getSettings(accessToken: string): Promise<Record<string,string>> {
  await ensureVaRelay();
  const api = shts(accessToken);
  const rng = await range(accessToken, "Settings", "A1:B20");
  const res = await api.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: rng });
  const settings: Record<string,string> = {};
  for (const row of (res.data.values ?? [])) {
    const k = String(row[0] ?? "").trim();
    const v = String(row[1] ?? "").trim();
    if (k) {
      settings[k]             = v;  // exact key
      settings[k.toUpperCase()] = v; // uppercase key too
    }
  }
  return settings;
}

export async function updateSettings(
  accessToken: string,
  updates: Record<string,string>
) {
  await ensureVaRelay();
  const api     = shts(accessToken);
  const tabName = await resolveTab(accessToken, "Settings");
  const res     = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${tabName}!A1:B20`,
  });
  const rows = res.data.values ?? [];

  const data = Object.entries(updates).map(([key, value]) => {
    const idx = rows.findIndex(r => String(r[0]).trim() === key);
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
  await ensureVaRelay();
  const api = shts(accessToken);
  const rng = await range(accessToken, "Analytics", "A2:L");
  const res = await api.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: rng });
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
  await ensureVaRelay();
  const api = shts(accessToken);
  const rng = await range(accessToken, "Analytics", "A:L");
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
    range:            rng,
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
  await ensureVaRelay();
  const api = shts(accessToken);
  const rng = await range(accessToken, "Log", "A:E");
  await api.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            rng,
    valueInputOption: "USER_ENTERED",
    requestBody:      { values: [[new Date().toISOString(), fn, postId, action, details]] },
  });
}