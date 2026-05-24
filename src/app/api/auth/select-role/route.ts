import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders, sessionCookieHeader } from "@/lib/google-auth";
import { getAdminEmails } from "@/lib/config";
import { getLocations, readStaff } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { role } = await req.json() as { role?: string };
  if (role !== "admin" && role !== "logger") {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const email = session.email.toLowerCase();

  // ── Admin verification ────────────────────────────────────────────────────
  if (role === "admin") {
    const allowed = getAdminEmails();
    if (!allowed.includes(email)) {
      return NextResponse.json({
        error: "Your account has not been granted admin access. Contact the system administrator.",
        denied: true,
      }, { status: 403 });
    }

    const updated = { ...session, role: "admin" as const };
    const res = NextResponse.json({ ok: true, redirect: "/admin" });
    res.headers.set("Set-Cookie", sessionCookieHeader(updated));
    return res;
  }

  // ── Logger verification ───────────────────────────────────────────────────
  const locations = await getLocations();

  if (locations.length === 0) {
    return NextResponse.json({
      error: "No locations have been set up yet. Contact your admin.",
      denied: true,
    }, { status: 403 });
  }

  for (const loc of locations) {
    if (!loc.sheetId) continue;
    try {
      const staff  = await readStaff(loc.name, loc.sheetId);
      const member = staff.find(s => s.email.toLowerCase() === email);
      if (member) {
        if (!member.active) {
          return NextResponse.json({
            error: "Your access has been deactivated. Contact your manager.",
            denied: true,
          }, { status: 403 });
        }
        const updated = {
          ...session,
          role:         "logger" as const,
          locationId:   loc.id,
          locationName: loc.name,
          name:         member.name || session.name,
        };
        const res = NextResponse.json({ ok: true, redirect: "/log" });
        res.headers.set("Set-Cookie", sessionCookieHeader(updated));
        return res;
      }
    } catch { continue; }
  }

  return NextResponse.json({
    error: "Your email hasn't been added to any location. Contact your admin to get access.",
    denied: true,
  }, { status: 403 });
}
