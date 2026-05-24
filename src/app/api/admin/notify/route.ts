import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders, getSessionSheetId } from "@/lib/google-auth";
import {
  readReminderSchedule, saveReminderSchedule, readSubscriptions,
  deactivateSubscription, type ReminderSchedule,
} from "@/lib/sheets";
import { sendPush } from "@/lib/push";
import type { PushSubscription } from "web-push";

function guard(req: NextRequest) { return readSessionFromHeaders(req.headers); }

export async function GET(req: NextRequest) {
  const session = guard(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sid = getSessionSheetId(session, req.nextUrl.searchParams.get("location"));
  const [schedule, subs] = await Promise.all([readReminderSchedule(sid), readSubscriptions(sid)]);
  return NextResponse.json({
    schedule,
    subscriberCount: subs.length,
    subscribers: subs.map(s => ({ email: s.email, name: s.name, createdAt: s.createdAt })),
  });
}

export async function PUT(req: NextRequest) {
  const session = guard(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sid  = getSessionSheetId(session, req.nextUrl.searchParams.get("location"));
  const body = await req.json() as ReminderSchedule;
  await saveReminderSchedule(body, sid);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const session = guard(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sid  = getSessionSheetId(session, req.nextUrl.searchParams.get("location"));
  const { message } = await req.json() as { message?: string };
  const subs = await readSubscriptions(sid);
  if (subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });
  const payload = { title: "⏰ Time to log — AquaLog", body: message?.trim() || "Please submit your readings.", url: "/log" };
  let sent = 0;
  await Promise.allSettled(subs.map(async (sub) => {
    const r = await sendPush(JSON.parse(sub.subscriptionJson) as PushSubscription, payload);
    if (r === "sent") sent++;
    if (r === "gone") await deactivateSubscription(sub.endpoint, sid).catch(() => null);
  }));
  return NextResponse.json({ ok: true, sent, total: subs.length });
}
