// ── Locations ─────────────────────────────────────────────────────────────────

export const LOCATIONS = [
  { id: "lekki", name: "Golden Tulip Lekki", sheetEnvKey: "SHEET_ID_LEKKI" },
  { id: "oniru", name: "Golden Tulip Oniru", sheetEnvKey: "SHEET_ID_ONIRU" },
] as const;

export type LocationId = "lekki" | "oniru";

export function getLocationName(id: string): string {
  return LOCATIONS.find(l => l.id === id)?.name ?? id;
}

export function getSheetIdForLocation(locationId: string): string {
  const loc = LOCATIONS.find(l => l.id === locationId);
  return (loc ? process.env[loc.sheetEnvKey] : undefined) ?? process.env.GOOGLE_SHEET_ID ?? "";
}

// Legacy — kept so any missed references don't break
export const HOTEL_NAME = "Golden Tulip";
export const LOCATION   = "Golden Tulip Lekki";

// ── Log points / areas ────────────────────────────────────────────────────────

export const WATER_POINTS = [
  { id: "main_meter",  label: "Main Water Meter",  unit: "m³" },
  { id: "pool_level",  label: "Pool Water Level",  unit: "cm" },
  { id: "boiler",      label: "Boiler Feed Meter", unit: "m³" },
];

export const TEMP_AREAS = [
  { id: "kitchen_hot",  label: "Kitchen — Hot Water",     min: 60,  max: 100, unit: "°C" },
  { id: "cold_store_1", label: "Cold Storage #1",         min: 1,   max: 5,   unit: "°C" },
  { id: "cold_store_2", label: "Cold Storage #2",         min: 1,   max: 5,   unit: "°C" },
  { id: "freezer",      label: "Freezer",                 min: -25, max: -18, unit: "°C" },
  { id: "buffet",       label: "Hot Buffet / Bain-Marie", min: 63,  max: 85,  unit: "°C" },
  { id: "pool_water",   label: "Pool Water",              min: 24,  max: 28,  unit: "°C" },
];

export const CHECK_TIMES = ["07:00", "13:00", "18:00"];

export function tempStatus(value: number, min: number, max: number): "OK" | "WARN" | "DANGER" {
  if (value >= min && value <= max) return "OK";
  if (Math.abs(value - min) <= 2 || Math.abs(value - max) <= 2) return "WARN";
  return "DANGER";
}
