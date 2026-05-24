import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders } from "@/lib/google-auth";
import { readTargets, upsertTarget, getSheetIdForLocation, getLocationName } from "@/lib/sheets";

async function getGuardAndSid(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session || session.role !== "admin") return null;
  const location = req.nextUrl.searchParams.get("location") ?? "";
  const sid      = await getSheetIdForLocation(location);
  const locName  = await getLocationName(location);
  return { session, sid, locName };
}

export async function GET(req: NextRequest) {
  const ctx = await getGuardAndSid(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await readTargets(ctx.locName, ctx.sid));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to read targets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getGuardAndSid(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const updates = await req.json() as { metric: string; value: number }[];
  if (!Array.isArray(updates)) return NextResponse.json({ error: "Expected array" }, { status: 400 });
  try {
    await Promise.all(updates.map(u => upsertTarget(u.metric, u.value, ctx.sid)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update targets" }, { status: 500 });
  }
}
