import { NextRequest, NextResponse } from "next/server";
import { readStaff } from "@/lib/sheets";
import { LOCATIONS, getSheetIdForLocation } from "@/lib/config";

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string };
  if (!email?.trim()) {
    return NextResponse.json({ authorized: false, reason: "Email is required." });
  }

  const normalised = email.trim().toLowerCase();

  // Check every location's sheet — first match wins
  for (const loc of LOCATIONS) {
    const sid = getSheetIdForLocation(loc.id);
    if (!sid) continue;
    try {
      const staff  = await readStaff(loc.name, sid);
      const member = staff.find(s => s.email.toLowerCase() === normalised);
      if (member) {
        if (!member.active) {
          return NextResponse.json({ authorized: false, reason: "Your access has been deactivated. Contact your manager." });
        }
        return NextResponse.json({ authorized: true, name: member.name, location: loc.id, locationName: loc.name });
      }
    } catch { continue; }
  }

  const anyConfigured = LOCATIONS.some(l => !!getSheetIdForLocation(l.id));
  if (!anyConfigured) {
    return NextResponse.json({ authorized: false, reason: "System not yet configured. Ask admin to set sheet IDs." });
  }
  return NextResponse.json({ authorized: false, reason: "Email not recognised. Contact your manager to be added." });
}
