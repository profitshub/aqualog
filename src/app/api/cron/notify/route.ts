import { NextRequest, NextResponse } from "next/server";
import { readSubscriptions, readReminderSchedule, deactivateSubscription } from "@/lib/sheets";
import { sendPush } from "@/lib/push";
import type { PushSubscription } from "web-push";

// WAT = UTC+1
function watNow(): { hour: number; minute: number } {
  const now = new Date(Date.now() + 60 * 60 * 1000);
  return { hour: now.getUTCHours(), minute: now.getUTCMinutes() };
}

// Returns true if current WAT time falls in [reminderTime, reminderTime + 30 min)
function shouldFire(reminderTime: string, wat: { hour: number; minute: number }): boolean {
  const [rh, rm] = reminderTime.split(":").map(Number);
  const reminderMins = rh * 60 + rm;
  const nowMins      = wat.hour * 60 + wat.minute;
  return nowMins >= reminderMins && nowMins < reminderMins + 30;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const schedule = await readReminderSchedule();

    if (!schedule.enabled || schedule.times.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: "reminders disabled or no times set" });
    }

    const wat  = watNow();
    const fire = schedule.times.some(t => shouldFire(t, wat));

    if (!fire) {
      return NextResponse.json({ ok: true, sent: 0, reason: "no reminder due at this time" });
    }

    const subs = await readSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: "no subscribers" });
    }

    const body = schedule.message.trim() || "Please submit your water and temperature readings.";
    const payload = { title: "⏰ Time to log — AquaLog", body, url: "/log" };

    let sent = 0;
    await Promise.allSettled(subs.map(async (sub) => {
      const result = await sendPush(JSON.parse(sub.subscriptionJson) as PushSubscription, payload);
      if (result === "sent") {
        sent++;
      } else if (result === "gone") {
        await deactivateSubscription(sub.endpoint).catch(() => null);
      }
    }));

    return NextResponse.json({ ok: true, sent, total: subs.length });
  } catch (err) {
    console.error("Cron notify error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
