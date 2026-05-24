// ── Admin access ──────────────────────────────────────────────────────────────

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

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
