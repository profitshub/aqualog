import { google } from "googleapis";
import { createHmac } from "crypto";

export const OAUTH_SCOPES = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
  );
}

export function getAuthUrl(): string {
  return createOAuthClient().generateAuthUrl({
    access_type: "offline",
    scope: OAUTH_SCOPES,
    prompt: "select_account",
  });
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface UserSession {
  email:         string;
  name:          string;
  picture?:      string;
  role?:         "admin" | "logger";  // undefined = pending role selection
  locationId?:   string;              // set for loggers
  locationName?: string;              // set for loggers
  // Admin OAuth tokens — used to create sheets in admin's Drive
  accessToken?:  string;
  refreshToken?: string;
  expiryDate?:   number;
}

const COOKIE = "aql_session";
const SECRET = process.env.SESSION_SECRET ?? "aqualog-dev-secret-change-in-prod";

function sign(data: string): string {
  const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function unsign(signed: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const data     = signed.slice(0, i);
  const sig      = signed.slice(i + 1);
  const expected = createHmac("sha256", SECRET).update(data).digest("base64url");
  return sig === expected ? data : null;
}

export function encodeSession(s: UserSession): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return sign(payload);
}

export function decodeSession(cookie: string): UserSession | null {
  const payload = unsign(cookie);
  if (!payload) return null;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()) as UserSession; }
  catch { return null; }
}

export function readSessionFromHeaders(headers: Headers): UserSession | null {
  const raw = headers.get("cookie") ?? "";
  const m   = raw.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  if (!m) return null;
  return decodeSession(decodeURIComponent(m[1]));
}

export function sessionCookieHeader(s: UserSession): string {
  const val = encodeURIComponent(encodeSession(s));
  return `${COOKIE}=${val}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
}

export function clearCookieHeader(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
