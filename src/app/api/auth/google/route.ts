import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-auth";

export async function GET() {
  return NextResponse.redirect(getAuthUrl());
}
