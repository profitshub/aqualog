import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function serviceAccount() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
  return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
}

export function getSheetsClient() {
  return google.sheets({ version: "v4", auth: serviceAccount() });
}

// Spreadsheet ID: admin's sheet (shared with service account after OAuth setup)
export function sheetId(): string {
  return process.env.GOOGLE_SHEET_ID ?? "";
}

export const TABS = {
  water:   "Water Logs",
  temp:    "Temp Logs",
  staff:   "Staff",
  targets: "Targets",
} as const;

// ── Generic helpers ───────────────────────────────────────────────────────────

export async function appendRow(tab: string, values: (string | number)[], overrideSheetId?: string) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: overrideSheetId ?? sheetId(),
    range: `'${tab}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

export async function readRows(tab: string, overrideSheetId?: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: overrideSheetId ?? sheetId(),
    range: `'${tab}'!A2:Z`,
  });
  return (res.data.values ?? []) as string[][];
}

// ── Staff management ──────────────────────────────────────────────────────────

export interface StaffMember {
  email:     string;
  name:      string;
  location:  string;
  addedBy:   string;
  addedDate: string;
  active:    boolean;
}

export async function readStaff(location: string, overrideSheetId?: string): Promise<StaffMember[]> {
  const rows = await readRows(TABS.staff, overrideSheetId);
  return rows
    .filter(r => r[0] && (!location || (r[2] ?? "").toLowerCase() === location.toLowerCase()))
    .map(r => ({
      email:     r[0] ?? "",
      name:      r[1] ?? "",
      location:  r[2] ?? "",
      addedBy:   r[3] ?? "",
      addedDate: r[4] ?? "",
      active:    (r[5] ?? "TRUE").toUpperCase() !== "FALSE",
    }));
}

export async function addStaff(
  email: string, name: string, location: string,
  addedBy: string, overrideSheetId?: string
) {
  const now = new Date().toLocaleDateString("en-GB");
  await appendRow(TABS.staff, [email, name, location, addedBy, now, "TRUE"], overrideSheetId);
}

export async function deactivateStaff(email: string, overrideSheetId?: string) {
  const id     = overrideSheetId ?? sheetId();
  const sheets = getSheetsClient();

  // Find the row
  const rows   = await readRows(TABS.staff, id);
  const rowIdx = rows.findIndex(r => r[0]?.toLowerCase() === email.toLowerCase());
  if (rowIdx < 0) return;

  // Row index in sheet = rowIdx + 2 (1-indexed + header row)
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `'${TABS.staff}'!F${rowIdx + 2}`,
    valueInputOption: "RAW",
    requestBody: { values: [["FALSE"]] },
  });
}

// ── Targets ───────────────────────────────────────────────────────────────────

export interface Target {
  metric:  string;
  value:   number;
  unit:    string;
  location: string;
  period:  string;
  notes:   string;
}

export async function readTargets(location?: string, overrideSheetId?: string): Promise<Target[]> {
  const rows = await readRows(TABS.targets, overrideSheetId);
  return rows
    .filter(r => r[0] && (!location || (r[3] ?? "").toLowerCase() === (location ?? "").toLowerCase()))
    .map(r => ({
      metric:   r[0] ?? "",
      value:    parseFloat(r[1] ?? "0"),
      unit:     r[2] ?? "",
      location: r[3] ?? "",
      period:   r[4] ?? "daily",
      notes:    r[5] ?? "",
    }));
}

export async function upsertTarget(
  metric: string, value: number, overrideSheetId?: string
) {
  const id     = overrideSheetId ?? sheetId();
  const sheets = getSheetsClient();
  const rows   = await readRows(TABS.targets, id);
  const rowIdx = rows.findIndex(r => r[0] === metric);

  if (rowIdx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `'${TABS.targets}'!B${rowIdx + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [[String(value)]] },
    });
  } else {
    await appendRow(TABS.targets, [metric, String(value), "", "", "daily", ""], id);
  }
}

// ── Log compliance stats ──────────────────────────────────────────────────────

export async function todayStats(overrideSheetId?: string) {
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const [waterRows, tempRows] = await Promise.all([
    readRows(TABS.water,  overrideSheetId),
    readRows(TABS.temp,   overrideSheetId),
  ]);

  const todayWater = waterRows.filter(r => r[1] === today);
  const todayTemp  = tempRows.filter(r  => r[1] === today);

  // Total water consumed today (sum of readings for main meter)
  const waterTotal = todayWater
    .filter(r => r[6] === "main_meter")
    .reduce((sum, r) => sum + parseFloat(r[7] ?? "0"), 0);

  // Temp compliance
  const allReadings   = todayTemp.length;
  const okReadings    = todayTemp.filter(r => r[10] === "OK").length;
  const compliance    = allReadings > 0 ? Math.round((okReadings / allReadings) * 100) : null;
  const dangerReadings = todayTemp.filter(r => r[10] === "DANGER");

  // Unique loggers today
  const loggers = [...new Set([...todayWater, ...todayTemp].map(r => r[3]))].filter(Boolean);

  return {
    date: today,
    waterLogs:    todayWater.length,
    tempLogs:     todayTemp.length,
    waterTotal:   +waterTotal.toFixed(2),
    compliance,
    dangerCount:  dangerReadings.length,
    dangerItems:  dangerReadings.map(r => ({ area: r[6], temp: r[7], logger: r[3], time: r[2] })),
    loggers,
    totalLogs:    todayWater.length + todayTemp.length,
  };
}
