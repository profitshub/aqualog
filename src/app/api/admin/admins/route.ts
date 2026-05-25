import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders } from "@/lib/google-auth";
import { getAdminEmails } from "@/lib/config";
import { readAdmins, addAdmin, removeAdmin } from "@/lib/sheets";

function isSuperAdmin(email: string) {
  return getAdminEmails().includes(email.toLowerCase());
}

export async function GET(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const admins = await readAdmins();
    return NextResponse.json({ admins, superAdmins: getAdminEmails() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.email)) return NextResponse.json({ error: "Only super admins can manage admin access." }, { status: 403 });

  const { email, name } = await req.json() as { email?: string; name?: string };
  if (!email?.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (isSuperAdmin(email.trim().toLowerCase())) return NextResponse.json({ error: "This email is already a super admin." }, { status: 409 });

  try {
    await addAdmin(email.trim().toLowerCase(), (name ?? "").trim(), session.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.email)) return NextResponse.json({ error: "Only super admins can remove admin access." }, { status: 403 });

  const { email } = await req.json() as { email?: string };
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  if (isSuperAdmin(email)) return NextResponse.json({ error: "Cannot remove a super admin." }, { status: 409 });

  try {
    await removeAdmin(email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
