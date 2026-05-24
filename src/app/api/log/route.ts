import { NextRequest, NextResponse } from "next/server";
import { appendRow, TABS } from "@/lib/sheets";
import { tempStatus, TEMP_AREAS, getSheetIdForLocation, getLocationName } from "@/lib/config";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const body     = await req.json() as Record<string, unknown>;
    const locationId = (body.location as string) ?? "lekki";
    const sid        = getSheetIdForLocation(locationId);
    const locName    = getLocationName(locationId);
    const now        = new Date();
    const ts         = now.toISOString();
    const date       = format(now, "dd/MM/yyyy");
    const time       = format(now, "HH:mm");

    if (body.type === "water") {
      const { logger, loggerEmail, meterPoint, reading, unit, notes } = body as {
        logger: string; loggerEmail: string; meterPoint: string;
        reading: string; unit: string; notes: string;
      };
      await appendRow(TABS.water, [ts, date, time, logger, loggerEmail ?? "", locName, meterPoint, reading, unit, notes ?? ""], sid);
      return NextResponse.json({ ok: true });
    }

    if (body.type === "temperature") {
      const { logger, loggerEmail, area, temperature, notes } = body as {
        logger: string; loggerEmail: string; area: string; temperature: string; notes: string;
      };
      const cfg    = TEMP_AREAS.find(a => a.id === area);
      const status = cfg ? tempStatus(parseFloat(temperature), cfg.min, cfg.max) : "OK";
      await appendRow(TABS.temp, [ts, date, time, logger, loggerEmail ?? "", locName, area, temperature, cfg?.min ?? "", cfg?.max ?? "", status, notes ?? ""], sid);
      return NextResponse.json({ ok: true, status });
    }

    return NextResponse.json({ error: "Invalid log type" }, { status: 400 });
  } catch (err) {
    console.error("Log error:", err);
    return NextResponse.json({ error: "Failed to write log" }, { status: 500 });
  }
}
