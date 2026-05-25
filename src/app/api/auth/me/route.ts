import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders } from "@/lib/google-auth";

export async function GET(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    email:        session.email,
    name:         session.name,
    picture:      session.picture,
    role:         session.role,
    locationId:   session.locationId,
    locationName: session.locationName,
  });
}
