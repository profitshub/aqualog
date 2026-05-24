import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders } from "@/lib/google-auth";
import { todayStats, readTargets, readRows, TABS } from "@/lib/sheets";
import { LOCATION } from "@/lib/config";

export async function GET(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sid = session.spreadsheetId;

  try {
    const [stats, targets, allWater, allTemp] = await Promise.all([
      todayStats(sid),
      readTargets(LOCATION, sid),
      readRows(TABS.water, sid),
      readRows(TABS.temp,  sid),
    ]);

    // Build target map
    const targetMap: Record<string, number> = {};
    targets.forEach(t => { targetMap[t.metric] = t.value; });

    // 7-day compliance trend
    const today  = new Date();
    const trend  = Array.from({ length: 7 }, (_, i) => {
      const d   = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString("en-GB");
      const rows  = allTemp.filter(r => r[1] === label);
      const ok    = rows.filter(r => r[10] === "OK").length;
      return { date: label, total: rows.length, ok, compliance: rows.length > 0 ? Math.round((ok / rows.length) * 100) : null };
    });

    // Unique loggers all time
    const allLoggers = [...new Set([...allWater, ...allTemp].map(r => r[3]).filter(Boolean))];

    return NextResponse.json({
      today:     stats,
      targets:   targetMap,
      trend,
      totalLogs: allWater.length + allTemp.length,
      allLoggers,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sid}/edit`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
