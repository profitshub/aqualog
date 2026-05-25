import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

function serviceAccount() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
  return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
}

export function getSheetsClient() {
  return google.sheets({ version: "v4", auth: serviceAccount() });
}

function getDriveClient() {
  return google.drive({ version: "v3", auth: serviceAccount() });
}

// Legacy single-sheet ID (kept for backwards compat)
export function sheetId(): string {
  return process.env.GOOGLE_SHEET_ID ?? "";
}

// ── Location registry — auto-created in service account Drive ─────────────────

export interface LocationRecord {
  id:        string;
  name:      string;
  sheetId:   string;
  createdAt: string;
}

const REGISTRY_NAME = "AquaLog Registry";
const MASTER_TABS   = { locations: "Locations" };

// In-memory caches (reset on cold start)
let _masterSheetId: string | null = null;
let _locCache: { data: LocationRecord[]; ts: number } | null = null;

export function invalidateLocationsCache() { _locCache = null; }

async function getMasterSheetId(): Promise<string> {
  if (_masterSheetId) return _masterSheetId;

  const drive = getDriveClient();

  // Search for existing registry file owned by the service account
  const search = await drive.files.list({
    q: `name='${REGISTRY_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  if (search.data.files?.length) {
    _masterSheetId = search.data.files[0].id!;
    return _masterSheetId;
  }

  // First run — create the registry sheet with a Locations tab
  const sheets = getSheetsClient();
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: REGISTRY_NAME },
      sheets: [{ properties: { title: MASTER_TABS.locations, gridProperties: { frozenRowCount: 1 } } }],
    },
  });
  const mid = created.data.spreadsheetId!;

  await sheets.spreadsheets.values.update({
    spreadsheetId: mid,
    range: `'${MASTER_TABS.locations}'!A1:D1`,
    valueInputOption: "RAW",
    requestBody: { values: [["id", "name", "sheetId", "createdAt"]] },
  });

  _masterSheetId = mid;
  return mid;
}

export async function getLocations(): Promise<LocationRecord[]> {
  if (_locCache && Date.now() - _locCache.ts < 3 * 60_000) return _locCache.data;
  const data = await readLocations();
  _locCache = { data, ts: Date.now() };
  return data;
}

export async function readLocations(): Promise<LocationRecord[]> {
  try {
    const mid  = await getMasterSheetId();
    const rows = await readRows(MASTER_TABS.locations, mid);
    return rows.filter(r => r[0] && r[2]).map(r => ({
      id:        r[0],
      name:      r[1] ?? r[0],
      sheetId:   r[2],
      createdAt: r[3] ?? "",
    }));
  } catch { return []; }
}

export async function saveLocation(id: string, name: string, sid: string): Promise<void> {
  const mid = await getMasterSheetId();
  await appendRow(MASTER_TABS.locations, [id, name, sid, new Date().toISOString()], mid);
  invalidateLocationsCache();
}

export async function getSheetIdForLocation(locationId: string): Promise<string> {
  const locs = await getLocations();
  return locs.find(l => l.id === locationId)?.sheetId ?? "";
}

export async function getLocationName(locationId: string): Promise<string> {
  const locs = await getLocations();
  return locs.find(l => l.id === locationId)?.name ?? locationId;
}

// ── Create a new location sheet ───────────────────────────────────────────────

const LOCATION_SHEET_TABS = [
  { name: "Water Logs",     headers: ["Timestamp","Date","Time","Logger","Logger Email","Location","Meter Point","Reading","Unit","Notes"] },
  { name: "Temp Logs",      headers: ["Timestamp","Date","Time","Logger","Logger Email","Location","Area","Temperature (°C)","Min (°C)","Max (°C)","Status","Notes"] },
  { name: "Staff",          headers: ["Email","Name","Location","Added By","Added Date","Active"] },
  { name: "Targets",        headers: ["Metric","Value","Unit","Location","Period","Notes"] },
  { name: "Subscriptions",  headers: ["Email","Name","Subscription JSON","Endpoint","Created At","Active"] },
];

export async function createLocationSheet(locationName: string): Promise<string> {
  const sheets = getSheetsClient();

  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `AquaLog — ${locationName}` },
      sheets: LOCATION_SHEET_TABS.map(t => ({
        properties: { title: t.name, gridProperties: { frozenRowCount: 1 } },
      })),
    },
  });
  const id = created.data.spreadsheetId!;

  // Write headers
  await Promise.all(LOCATION_SHEET_TABS.map(t =>
    sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `'${t.name}'!A1:${String.fromCharCode(64 + t.headers.length)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [t.headers] },
    })
  ));

  // Seed default targets
  await sheets.spreadsheets.values.append({
    spreadsheetId: id,
    range: "'Targets'!A2",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        ["daily_water_limit",        "50",  "m³",    locationName, "daily", "Max daily water consumption"],
        ["temp_compliance_rate",     "100", "%",     locationName, "daily", "% of temp readings within safe range"],
        ["checks_per_area_per_day",  "3",   "count", locationName, "daily", "Required logging frequency per monitored area"],
      ],
    },
  });

  return id;
}

export const TABS = {
  water:   "Water Logs",
  temp:    "Temp Logs",
  staff:   "Staff",
  targets: "Targets",
  subs:    "Subscriptions",
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

// ── Push subscriptions ────────────────────────────────────────────────────────

export interface PushSub {
  email:            string;
  name:             string;
  subscriptionJson: string;
  endpoint:         string;
  createdAt:        string;
  active:           boolean;
}

export async function readSubscriptions(overrideSheetId?: string): Promise<PushSub[]> {
  try {
    const rows = await readRows(TABS.subs, overrideSheetId);
    return rows
      .filter(r => r[0] && (r[5] ?? "TRUE").toUpperCase() !== "FALSE")
      .map(r => ({
        email:            r[0] ?? "",
        name:             r[1] ?? "",
        subscriptionJson: r[2] ?? "{}",
        endpoint:         r[3] ?? "",
        createdAt:        r[4] ?? "",
        active:           (r[5] ?? "TRUE").toUpperCase() !== "FALSE",
      }));
  } catch {
    return [];
  }
}

export async function addSubscription(
  email: string, name: string, subscriptionJson: string, overrideSheetId?: string
) {
  const id      = overrideSheetId ?? sheetId();
  const endpoint = (() => { try { return JSON.parse(subscriptionJson).endpoint ?? ""; } catch { return ""; } })();

  try {
    const rows   = await readRows(TABS.subs, id);
    const rowIdx = rows.findIndex(r => r[3] === endpoint);
    if (rowIdx >= 0) {
      // Reactivate and update name
      const sheets = getSheetsClient();
      await sheets.spreadsheets.values.update({
        spreadsheetId: id,
        range: `'${TABS.subs}'!A${rowIdx + 2}:F${rowIdx + 2}`,
        valueInputOption: "RAW",
        requestBody: { values: [[email, name, subscriptionJson, endpoint, rows[rowIdx][4] ?? "", "TRUE"]] },
      });
    } else {
      await appendRow(TABS.subs, [email, name, subscriptionJson, endpoint, new Date().toISOString(), "TRUE"], id);
    }
  } catch {
    await appendRow(TABS.subs, [email, name, subscriptionJson, endpoint, new Date().toISOString(), "TRUE"], id);
  }
}

export async function deactivateSubscription(endpoint: string, overrideSheetId?: string) {
  const id      = overrideSheetId ?? sheetId();
  const sheets  = getSheetsClient();
  const rows    = await readRows(TABS.subs, id);
  const rowIdx  = rows.findIndex(r => r[3] === endpoint);
  if (rowIdx < 0) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `'${TABS.subs}'!F${rowIdx + 2}`,
    valueInputOption: "RAW",
    requestBody: { values: [["FALSE"]] },
  });
}

// ── Reminder schedule (stored as special rows in Targets tab) ─────────────────

export interface ReminderSchedule {
  enabled: boolean;
  times:   string[];   // ["08:00","12:00","16:00"] in WAT (UTC+1)
  message: string;
}

async function upsertTargetRow(
  metric: string, value: string, notes: string, overrideSheetId?: string
) {
  const id     = overrideSheetId ?? sheetId();
  const sheets = getSheetsClient();
  const rows   = await readRows(TABS.targets, id);
  const rowIdx = rows.findIndex(r => r[0] === metric);
  if (rowIdx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `'${TABS.targets}'!B${rowIdx + 2}:F${rowIdx + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [[value, rows[rowIdx][2] ?? "", rows[rowIdx][3] ?? "", rows[rowIdx][4] ?? "daily", notes]] },
    });
  } else {
    await appendRow(TABS.targets, [metric, value, "", "", "daily", notes], id);
  }
}

export async function readReminderSchedule(overrideSheetId?: string): Promise<ReminderSchedule> {
  try {
    const rows       = await readRows(TABS.targets, overrideSheetId);
    const enabledRow = rows.find(r => r[0] === "reminders_enabled");
    const timesRow   = rows.find(r => r[0] === "reminder_times");
    const msgRow     = rows.find(r => r[0] === "reminder_message");
    return {
      enabled: (enabledRow?.[1] ?? "0") === "1",
      times:   (timesRow?.[5] ?? "").split(",").map(t => t.trim()).filter(Boolean),
      message: msgRow?.[5] ?? "",
    };
  } catch {
    return { enabled: false, times: [], message: "" };
  }
}

export async function saveReminderSchedule(schedule: ReminderSchedule, overrideSheetId?: string) {
  await Promise.all([
    upsertTargetRow("reminders_enabled", schedule.enabled ? "1" : "0", "",                          overrideSheetId),
    upsertTargetRow("reminder_times",    String(schedule.times.length), schedule.times.join(","),    overrideSheetId),
    upsertTargetRow("reminder_message",  "0",                           schedule.message,            overrideSheetId),
  ]);
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
