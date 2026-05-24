import { NextRequest, NextResponse } from "next/server";
import { readStaff, getLocations } from "@/lib/sheets";

// Kept for backwards compatibility — new flow uses /api/auth/select-role
export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string };
  if (!email?.trim()) {
    return NextResponse.json({ authorized: false, reason: "Email is required." });
  }

  const normalised = email.trim().toLowerCase();
  const locations  = await getLocations();

  if (locations.length === 0) {
    return NextResponse.json({ authorized: false, reason: "No locations configured. Contact admin." });
  }

  for (const loc of locations) {
    if (!loc.sheetId) continue;
    try {
      const staff  = await readStaff(loc.name, loc.sheetId);
      const member = staff.find(s => s.email.toLowerCase() === normalised);
      if (member) {
        if (!member.active) {
          return NextResponse.json({ authorized: false, reason: "Your access has been deactivated. Contact your manager." });
        }
        return NextResponse.json({ authorized: true, name: member.name, location: loc.id, locationName: loc.name });
      }
    } catch { continue; }
  }

  return NextResponse.json({ authorized: false, reason: "Email not recognised. Contact your manager to be added." });
}
