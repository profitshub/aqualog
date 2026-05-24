import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders, getSessionSheetId } from "@/lib/google-auth";
import { readRows, TABS } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sid = getSessionSheetId(session, req.nextUrl.searchParams.get("location"));

  const [waterRows, tempRows] = await Promise.all([
    readRows(TABS.water, sid),
    readRows(TABS.temp,  sid),
  ]);

  // Water: [ts, date, time, logger, loggerEmail, location, meterPoint, reading, unit, notes]
  const waterLogs = waterRows.map(r => ({
    type:        "water" as const,
    timestamp:   r[0]  ?? "",
    date:        r[1]  ?? "",
    time:        r[2]  ?? "",
    logger:      r[3]  ?? "",
    loggerEmail: r[4]  ?? "",
    location:    r[5]  ?? "",
    meterPoint:  r[6]  ?? "",
    reading:     r[7]  ?? "",
    unit:        r[8]  ?? "",
    notes:       r[9]  ?? "",
  }));

  // Temp: [ts, date, time, logger, loggerEmail, location, area, temp, min, max, status, notes]
  const tempLogs = tempRows.map(r => ({
    type:        "temperature" as const,
    timestamp:   r[0]  ?? "",
    date:        r[1]  ?? "",
    time:        r[2]  ?? "",
    logger:      r[3]  ?? "",
    loggerEmail: r[4]  ?? "",
    location:    r[5]  ?? "",
    area:        r[6]  ?? "",
    temperature: r[7]  ?? "",
    min:         r[8]  ?? "",
    max:         r[9]  ?? "",
    status:      (r[10] ?? "OK") as "OK" | "WARN" | "DANGER",
    notes:       r[11] ?? "",
  }));

  const all = [...waterLogs, ...tempLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json({ water: waterLogs, temperature: tempLogs, all });
}
