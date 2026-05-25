import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders } from "@/lib/google-auth";
import { getLocations, createLocationSheet, saveLocation } from "@/lib/sheets";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET(req: NextRequest) {
  const session = readSessionFromHeaders(req.headers);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await getLocations());
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to read locations" }, { status: 500 });
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
    console.error(err);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}
