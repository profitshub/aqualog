import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders, getSessionSheetId } from "@/lib/google-auth";
import { todayStats, readTargets, readRows, TABS } from "@/lib/sheets";
import { getLocationName } from "@/lib/config";

export async function GET(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const location = req.nextUrl.searchParams.get("location");
  const sid      = getSessionSheetId(session, location);
  const locName  = location ? getLocationName(location) : undefined;

  try {
    const [stats, targets, allWater, allTemp] = await Promise.all([
      todayStats(sid),
      readTargets(locName, sid),
      readRows(TABS.water, sid),
      readRows(TABS.temp,  sid),
    ]);

    const targetMap: Record<string, number> = {};
    targets.forEach(t => { targetMap[t.metric] = t.value; });

    const today = new Date();
    const trend = Array.from({ length: 7 }, (_, i) => {
      const d     = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString("en-GB");
      const rows  = allTemp.filter(r => r[1] === label);
      const ok    = rows.filter(r => r[10] === "OK").length;
      return { date: label, total: rows.length, ok, compliance: rows.length > 0 ? Math.round((ok / rows.length) * 100) : null };
    });

    const allLoggers = [...new Set([...allWater, ...allTemp].map(r => r[3]).filter(Boolean))];

    return NextResponse.json({
      today,
      targets:   targetMap,
      trend,
      totalLogs: allWater.length + allTemp.length,
      allLoggers,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sid}/edit`,
      sheetId: sid,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
