import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders } from "@/lib/google-auth";
import {
  readReminderSchedule, saveReminderSchedule, readSubscriptions,
  deactivateSubscription, getSheetIdForLocation, type ReminderSchedule,
} from "@/lib/sheets";
import { sendPush } from "@/lib/push";
import type { PushSubscription } from "web-push";

async function getGuardAndSid(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session || session.role !== "admin") return null;
  const location = req.nextUrl.searchParams.get("location") ?? "";
  const sid      = await getSheetIdForLocation(location);
  return { session, sid };
}

export async function GET(req: NextRequest) {
  const ctx = await getGuardAndSid(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [schedule, subs] = await Promise.all([readReminderSchedule(ctx.sid), readSubscriptions(ctx.sid)]);
  return NextResponse.json({
    schedule,
    subscriberCount: subs.length,
    subscribers: subs.map(s => ({ email: s.email, name: s.name, createdAt: s.createdAt })),
  });
}

export async function PUT(req: NextRequest) {
  const ctx = await getGuardAndSid(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as ReminderSchedule;
  await saveReminderSchedule(body, ctx.sid);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const ctx = await getGuardAndSid(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { message } = await req.json() as { message?: string };
  const subs = await readSubscriptions(ctx.sid);
  if (subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });
  const payload = { title: "⏰ Time to log — AquaLog", body: message?.trim() || "Please submit your readings.", url: "/log" };
  let sent = 0;
  await Promise.allSettled(subs.map(async (sub) => {
    const r = await sendPush(JSON.parse(sub.subscriptionJson) as PushSubscription, payload);
    if (r === "sent") sent++;
    if (r === "gone") await deactivateSubscription(sub.endpoint, ctx.sid).catch(() => null);
  }));
  return NextResponse.json({ ok: true, sent, total: subs.length });
}
