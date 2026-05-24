import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders, getSessionSheetId } from "@/lib/google-auth";
import { readTargets, upsertTarget } from "@/lib/sheets";
import { getLocationName } from "@/lib/config";

function guard(req: NextRequest) { return readSessionFromHeaders(req.headers); }

export async function GET(req: NextRequest) {
  const session = guard(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sid     = getSessionSheetId(session, req.nextUrl.searchParams.get("location"));
  const locName = getLocationName(req.nextUrl.searchParams.get("location") ?? "");
  try {
    return NextResponse.json(await readTargets(locName, sid));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to read targets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = guard(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sid     = getSessionSheetId(session, req.nextUrl.searchParams.get("location"));
  const updates = await req.json() as { metric: string; value: number }[];
  if (!Array.isArray(updates)) return NextResponse.json({ error: "Expected array" }, { status: 400 });
  try {
    await Promise.all(updates.map(u => upsertTarget(u.metric, u.value, sid)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update targets" }, { status: 500 });
  }
}
