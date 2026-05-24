import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders } from "@/lib/google-auth";
import {
  readReminderSchedule, saveReminderSchedule, readSubscriptions,
  deactivateSubscription, type ReminderSchedule,
} from "@/lib/sheets";
import { sendPush } from "@/lib/push";
import type { PushSubscription } from "web-push";

function guard(req: NextRequest) { return readSessionFromHeaders(req.headers); }

// GET — return current schedule + subscriber stats
export async function GET(req: NextRequest) {
  const session = guard(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sid = session.spreadsheetId;
  const [schedule, subs] = await Promise.all([
    readReminderSchedule(sid),
    readSubscriptions(sid),
  ]);

  return NextResponse.json({
    schedule,
    subscriberCount: subs.length,
    subscribers: subs.map(s => ({ email: s.email, name: s.name, createdAt: s.createdAt })),
  });
}

// PUT — save reminder schedule
export async function PUT(req: NextRequest) {
  const session = guard(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as ReminderSchedule;
  await saveReminderSchedule(body, session.spreadsheetId);
  return NextResponse.json({ ok: true });
}

// POST — send test notification to all subscribers now
export async function POST(req: NextRequest) {
  const session = guard(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await req.json() as { message?: string };
  const sid  = session.spreadsheetId;
  const subs = await readSubscriptions(sid);

  if (subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "No subscribers" });
  }

  const payload = {
    title: "⏰ Time to log — AquaLog",
    body:  message?.trim() || "Test reminder from admin: please submit your readings.",
    url:   "/log",
  };

  let sent = 0;
  await Promise.allSettled(subs.map(async (sub) => {
    const result = await sendPush(JSON.parse(sub.subscriptionJson) as PushSubscription, payload);
    if (result === "sent")  sent++;
    if (result === "gone")  await deactivateSubscription(sub.endpoint, sid).catch(() => null);
  }));

  return NextResponse.json({ ok: true, sent, total: subs.length });
}
