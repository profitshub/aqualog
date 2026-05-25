import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createOAuthClient, sessionCookieHeader, type UserSession } from "@/lib/google-auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/?error=no_code", req.url));

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data: info } = await oauth2.userinfo.get();

    const session: UserSession = {
      email:        info.email!,
      name:         info.name ?? info.email!,
      picture:      info.picture ?? undefined,
      accessToken:  tokens.access_token  ?? undefined,
      refreshToken: tokens.refresh_token ?? undefined,
      expiryDate:   tokens.expiry_date   ?? undefined,
    };

    const res = NextResponse.redirect(new URL("/role", req.url));
    res.headers.set("Set-Cookie", sessionCookieHeader(session));
    return res;
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(new URL("/?error=auth_failed", req.url));
  }
}
