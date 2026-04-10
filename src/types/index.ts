// ── Post ──────────────────────────────────────────────────────────────────
export type PostStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "partial"
  | "failed"
  | "pending";

export type Platform = "linkedin" | "instagram" | "facebook" | "x" | "tiktok";

export interface Post {
  id:              string;
  clientId:        string;
  content:         string;
  liOverride?:     string;
  xOverride?:      string;
  igOverride?:     string;
  platforms:       Platform[];
  mediaUrl?:       string;
  scheduledAt?:    string;   // ISO string UTC
  status:          PostStatus;
  platformPostIds?: Record<Platform, string>;
  publishedAt?:    string;
  errorMsg?:       string;
  docLink?:        string;
  createdAt:       string;
}

// Row index in Sheets (1-based, row 1 = header)
export interface PostRow extends Post {
  rowIndex: number;
}

// ── Client ────────────────────────────────────────────────────────────────
export interface Client {
  id:              string;
  name:            string;
  email:           string;
  timezone:        string;
  makeWebhookUrl?: string;
  platforms:       Platform[];
  approvalRequired: boolean;
  createdAt:       string;
}

// ── Analytics ────────────────────────────────────────────────────────────
export interface AnalyticsRow {
  date:           string;
  platform:       Platform;
  postId?:        string;
  impressions:    number;
  reach:          number;
  likes:          number;
  comments:       number;
  shares:         number;
  clicks:         number;
  engagementRate: number;
  followerCount:  number;
  followerDelta:  number;
}

// ── API responses ─────────────────────────────────────────────────────────
export interface ApiOk<T = unknown> {
  ok:   true;
  data: T;
}
export interface ApiErr {
  ok:      false;
  error:   string;
  details?: string;
}
export type ApiResult<T = unknown> = ApiOk<T> | ApiErr;

// ── Character limits per platform ────────────────────────────────────────
export const CHAR_LIMITS: Record<Platform, number> = {
  linkedin:  3000,
  instagram: 2200,
  facebook:  63206,
  x:         280,
  tiktok:    2200,
};

// ── Platform display config ───────────────────────────────────────────────
export const PLATFORM_META: Record<Platform, { label: string; short: string; color: string; bg: string }> = {
  linkedin:  { label: "LinkedIn",  short: "LI", color: "#0077B5", bg: "rgba(0,119,181,0.15)"  },
  instagram: { label: "Instagram", short: "IG", color: "#E1306C", bg: "rgba(225,48,108,0.12)" },
  facebook:  { label: "Facebook",  short: "FB", color: "#1877F2", bg: "rgba(24,119,242,0.12)" },
  x:         { label: "X",         short: "X",  color: "#888888", bg: "rgba(255,255,255,0.08)"},
  tiktok:    { label: "TikTok",    short: "TT", color: "#69C9D0", bg: "rgba(105,201,208,0.15)"},
};
