import webpush from "web-push";

let ready = false;

function init() {
  if (ready) return;
  const subject = process.env.VAPID_SUBJECT;
  const pub     = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv    = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pub || !priv) return;
  webpush.setVapidDetails(subject, pub, priv);
  ready = true;
}

export type SendResult = "sent" | "gone" | "error";

export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string; url?: string }
): Promise<SendResult> {
  init();
  if (!ready) return "error";
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return "sent";
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode === 410) return "gone";
    console.error("Push send error:", err);
    return "error";
  }
}
