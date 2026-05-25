import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders } from "@/lib/google-auth";
import { getLocations, getMasterSheetId, createLocationSheet, saveLocation } from "@/lib/sheets";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [locs, { id: registryId, fromEnv }] = await Promise.all([getLocations(), getMasterSheetId()]);
    return NextResponse.json({ locations: locs, registryId, needsEnvVar: !fromEnv });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await req.json() as { name?: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: "Location name is required" }, { status: 400 });
  }

  const locationName = name.trim();
  const locationId   = slugify(locationName);

  // Check for duplicates
  const existing = await getLocations();
  if (existing.some(l => l.id === locationId || l.name.toLowerCase() === locationName.toLowerCase())) {
    return NextResponse.json({ error: "A location with that name already exists" }, { status: 409 });
  }

  try {
    const sheetId = await createLocationSheet(locationName);
    await saveLocation(locationId, locationName, sheetId);
    return NextResponse.json({ ok: true, id: locationId, name: locationName, sheetId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("create location error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
