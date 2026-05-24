import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuth() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
  const credentials = JSON.parse(key);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });
}

export function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;

export const SHEETS = {
  water: "Water Logs",
  temp:  "Temperature Logs",
} as const;

// Append a row to the given sheet tab
export async function appendRow(tab: string, values: (string | number)[]) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${tab}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

// Read all rows from a sheet tab (skipping header row)
export async function readRows(tab: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${tab}'!A2:Z`,
  });
  return (res.data.values ?? []) as string[][];
}

// Ensure header rows exist (idempotent — only writes if A1 is empty)
export async function ensureHeaders() {
  const sheets = getSheetsClient();
  const waterHeaders = [
    "Timestamp", "Date", "Time", "Logger", "Location",
    "Meter Point", "Reading", "Unit", "Notes",
  ];
  const tempHeaders = [
    "Timestamp", "Date", "Time", "Logger", "Location",
    "Area", "Temperature (°C)", "Min (°C)", "Max (°C)", "Status", "Notes",
  ];

  async function writeIfEmpty(tab: string, headers: string[]) {
    const check = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${tab}'!A1`,
    });
    if (!check.data.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${tab}'!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [headers] },
      });
    }
  }

  await writeIfEmpty(SHEETS.water, waterHeaders);
  await writeIfEmpty(SHEETS.temp, tempHeaders);
}
