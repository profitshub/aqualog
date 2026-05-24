import { NextRequest, NextResponse } from "next/server";
import { readRows, SHEETS } from "@/lib/sheets";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

export async function GET(req: NextRequest) {
  const pwd = req.nextUrl.searchParams.get("pwd");
  if (pwd !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [waterRows, tempRows] = await Promise.all([
    readRows(SHEETS.water),
    readRows(SHEETS.temp),
  ]);

  const waterLogs = waterRows.map(r => ({
    type:       "water" as const,
    timestamp:  r[0] ?? "",
    date:       r[1] ?? "",
    time:       r[2] ?? "",
    logger:     r[3] ?? "",
    location:   r[4] ?? "",
    meterPoint: r[5] ?? "",
    reading:    r[6] ?? "",
    unit:       r[7] ?? "",
    notes:      r[8] ?? "",
  }));

  const tempLogs = tempRows.map(r => ({
    type:        "temperature" as const,
    timestamp:   r[0] ?? "",
    date:        r[1] ?? "",
    time:        r[2] ?? "",
    logger:      r[3] ?? "",
    location:    r[4] ?? "",
    area:        r[5] ?? "",
    temperature: r[6] ?? "",
    min:         r[7] ?? "",
    max:         r[8] ?? "",
    status:      r[9] ?? "OK",
    notes:       r[10] ?? "",
  }));

  const all = [...waterLogs, ...tempLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json({ water: waterLogs, temperature: tempLogs, all });
}
