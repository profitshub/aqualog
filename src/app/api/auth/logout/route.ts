import { NextResponse } from "next/server";
import { clearCookieHeader } from "@/lib/google-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearCookieHeader());
  return res;
}
