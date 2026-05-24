import { NextRequest, NextResponse } from "next/server";
import { addSubscription } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const { email, name, subscription } = await req.json() as {
    email: string; name: string; subscription: unknown;
  };

  if (!email || !subscription) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    await addSubscription(email, name ?? "", JSON.stringify(subscription));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json({ error: "Failed to store subscription" }, { status: 500 });
  }
}
