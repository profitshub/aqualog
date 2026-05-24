import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders } from "@/lib/google-auth";
import { readStaff, addStaff, deactivateStaff, getSheetIdForLocation, getLocationName } from "@/lib/sheets";

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
    return NextResponse.json(await readStaff(ctx.locName, ctx.sid));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to read staff" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getGuardAndSid(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { email, name } = await req.json() as { email: string; name: string };
  if (!email || !name) return NextResponse.json({ error: "Email and name required" }, { status: 400 });
  try {
    await addStaff(email.trim().toLowerCase(), name.trim(), ctx.locName, ctx.session.email, ctx.sid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add staff" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await getGuardAndSid(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { email } = await req.json() as { email: string };
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  try {
    await deactivateStaff(email, ctx.sid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to deactivate staff" }, { status: 500 });
  }
}
