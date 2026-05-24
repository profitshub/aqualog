import { NextRequest, NextResponse } from "next/server";
import { readStaff } from "@/lib/sheets";
import { LOCATION } from "@/lib/config";

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string };
  if (!email?.trim()) {
    return NextResponse.json({ authorized: false, reason: "Email is required." });
  }

  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    // Sheet not configured yet — block all loggers until admin completes setup
    return NextResponse.json({ authorized: false, reason: "System not configured. Contact admin." });
  }

  try {
    const staff  = await readStaff(LOCATION);
    const member = staff.find(s =>
      s.email.toLowerCase() === email.trim().toLowerCase() && s.active
    );

    if (!member) {
      return NextResponse.json({
        authorized: false,
        reason: "Your email is not authorized for this location. Contact your manager.",
      });
    }
    return NextResponse.json({ authorized: true, name: member.name });
  } catch {
    return NextResponse.json({ authorized: false, reason: "Verification failed. Try again." });
  }
}
