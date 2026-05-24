import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders, getSessionSheetId } from "@/lib/google-auth";
import { readStaff, addStaff, deactivateStaff } from "@/lib/sheets";
import { getLocationName } from "@/lib/config";

function guard(req: NextRequest) { return readSessionFromHeaders(req.headers); }
function loc(req: NextRequest)    { return req.nextUrl.searchParams.get("location"); }

export async function GET(req: NextRequest) {
  const session = guard(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sid      = getSessionSheetId(session, loc(req));
  const locName  = getLocationName(loc(req) ?? "");
  try {
    return NextResponse.json(await readStaff(locName, sid));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to read staff" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = guard(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sid     = getSessionSheetId(session, loc(req));
  const locName = getLocationName(loc(req) ?? "");
  const { email, name } = await req.json() as { email: string; name: string };
  if (!email || !name) return NextResponse.json({ error: "Email and name required" }, { status: 400 });
  try {
    await addStaff(email.trim().toLowerCase(), name.trim(), locName, session.adminEmail, sid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add staff" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = guard(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sid = getSessionSheetId(session, loc(req));
  const { email } = await req.json() as { email: string };
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  try {
    await deactivateStaff(email, sid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to deactivate staff" }, { status: 500 });
  }
}
