import { google } from "googleapis";
import { createHmac } from "crypto";

export const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
  "profile",
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
    prompt: "consent",
  });
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface AdminSession {
  accessToken:   string;
  refreshToken:  string;
  expiryDate:    number;
  spreadsheetId: string;
  adminEmail:    string;
  adminName:     string;
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

export function encodeSession(s: AdminSession): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return sign(payload);
}

export function decodeSession(cookie: string): AdminSession | null {
  const payload = unsign(cookie);
  if (!payload) return null;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()) as AdminSession; }
  catch { return null; }
}

export function readSessionFromHeaders(headers: Headers): AdminSession | null {
  const raw = headers.get("cookie") ?? "";
  const m   = raw.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  if (!m) return null;
  return decodeSession(decodeURIComponent(m[1]));
}

export function sessionCookieHeader(s: AdminSession): string {
  const val = encodeURIComponent(encodeSession(s));
  return `${COOKIE}=${val}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
}

export function clearCookieHeader(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// ── Authenticated clients ─────────────────────────────────────────────────────

export function adminSheetsClient(s: AdminSession) {
  const client = createOAuthClient();
  client.setCredentials({ access_token: s.accessToken, refresh_token: s.refreshToken, expiry_date: s.expiryDate });
  return google.sheets({ version: "v4", auth: client });
}

export function adminDriveClient(s: AdminSession) {
  const client = createOAuthClient();
  client.setCredentials({ access_token: s.accessToken, refresh_token: s.refreshToken, expiry_date: s.expiryDate });
  return google.drive({ version: "v3", auth: client });
}
