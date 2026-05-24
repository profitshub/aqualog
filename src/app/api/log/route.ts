import { NextRequest, NextResponse } from "next/server";
import { appendRow, ensureHeaders, SHEETS } from "@/lib/sheets";
import { LOCATION, tempStatus, TEMP_AREAS } from "@/lib/config";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const now  = new Date();
    const ts   = now.toISOString();
    const date = format(now, "dd/MM/yyyy");
    const time = format(now, "HH:mm");

    await ensureHeaders();

    if (body.type === "water") {
      const { logger, meterPoint, reading, unit, notes } = body as {
        logger: string; meterPoint: string; reading: string; unit: string; notes: string;
      };
      await appendRow(SHEETS.water, [
        ts, date, time, logger, LOCATION, meterPoint, reading, unit, notes ?? "",
      ]);
      return NextResponse.json({ ok: true });
    }

    if (body.type === "temperature") {
      const { logger, area, temperature, notes } = body as {
        logger: string; area: string; temperature: string; notes: string;
      };
      const areaConfig = TEMP_AREAS.find(a => a.id === area);
      const tempNum = parseFloat(temperature);
      const status = areaConfig
        ? tempStatus(tempNum, areaConfig.min, areaConfig.max)
        : "OK";

      await appendRow(SHEETS.temp, [
        ts, date, time, logger, LOCATION, area,
        temperature,
        areaConfig?.min ?? "",
        areaConfig?.max ?? "",
        status,
        notes ?? "",
      ]);
      return NextResponse.json({ ok: true, status });
    }

    return NextResponse.json({ error: "Invalid log type" }, { status: 400 });
  } catch (err) {
    console.error("Log error:", err);
    return NextResponse.json({ error: "Failed to write log" }, { status: 500 });
  }
}
