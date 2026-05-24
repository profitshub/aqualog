import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders } from "@/lib/google-auth";
import { appendRow, TABS, getSheetIdForLocation, getLocationName } from "@/lib/sheets";
import { tempStatus, TEMP_AREAS } from "@/lib/config";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session || session.role !== "logger") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body       = await req.json() as Record<string, unknown>;
    const locationId = session.locationId ?? "";
    const sid        = await getSheetIdForLocation(locationId);
    const locName    = session.locationName ?? await getLocationName(locationId);
    const logger     = session.name;
    const loggerEmail = session.email;
    const now        = new Date();
    const ts         = now.toISOString();
    const date       = format(now, "dd/MM/yyyy");
    const time       = format(now, "HH:mm");

    if (body.type === "water") {
      const { meterPoint, reading, unit, notes } = body as {
        meterPoint: string; reading: string; unit: string; notes: string;
      };
      await appendRow(TABS.water, [ts, date, time, logger, loggerEmail, locName, meterPoint, reading, unit, notes ?? ""], sid);
      return NextResponse.json({ ok: true });
    }

    if (body.type === "temperature") {
      const { area, temperature, notes } = body as {
        area: string; temperature: string; notes: string;
      };
      const cfg    = TEMP_AREAS.find(a => a.id === area);
      const status = cfg ? tempStatus(parseFloat(temperature), cfg.min, cfg.max) : "OK";
      await appendRow(TABS.temp, [ts, date, time, logger, loggerEmail, locName, area, temperature, cfg?.min ?? "", cfg?.max ?? "", status, notes ?? ""], sid);
      return NextResponse.json({ ok: true, status });
    }

    return NextResponse.json({ error: "Invalid log type" }, { status: 400 });
  } catch (err) {
    console.error("Log error:", err);
    return NextResponse.json({ error: "Failed to write log" }, { status: 500 });
  }
}
