import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import {
  createOAuthClient, adminSheetsClient, adminDriveClient,
  sessionCookieHeader, type AdminSession,
} from "@/lib/google-auth";
import { HOTEL_NAME, LOCATION } from "@/lib/config";

// Service account email — used to share the sheet so loggers can write logs
const SA_EMAIL = (() => {
  try { return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!).client_email as string; }
  catch { return null; }
})();

// All tabs that AquaLog needs in the spreadsheet
const TABS = [
  {
    name: "Water Logs",
    headers: ["Timestamp","Date","Time","Logger","Logger Email","Location","Meter Point","Reading","Unit","Notes"],
  },
  {
    name: "Temp Logs",
    headers: ["Timestamp","Date","Time","Logger","Logger Email","Location","Area","Temperature (°C)","Min (°C)","Max (°C)","Status","Notes"],
  },
  {
    name: "Staff",
    headers: ["Email","Name","Location","Added By","Added Date","Active"],
  },
  {
    name: "Targets",
    headers: ["Metric","Value","Unit","Location","Period","Notes"],
  },
  {
    name: "Subscriptions",
    headers: ["Email","Name","Subscription JSON","Endpoint","Created At","Active"],
  },
];

const DEFAULT_TARGETS = [
  ["daily_water_limit",       "50",  "m³",   LOCATION, "daily",  "Max daily water consumption"],
  ["temp_compliance_rate",    "100", "%",    LOCATION, "daily",  "% of temp readings within safe range"],
  ["checks_per_area_per_day", "3",   "count",LOCATION, "daily",  "Required logging frequency per monitored area"],
];

async function findOrCreateSpreadsheet(session: AdminSession): Promise<string> {
  const sheets = adminSheetsClient(session);
  const drive  = adminDriveClient(session);
  const title  = `AquaLog — ${HOTEL_NAME}`;

  // Look for existing sheet owned by this admin
  const search = await drive.files.list({
    q: `name = '${title}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: "files(id)",
  });
  if (search.data.files?.length) return search.data.files[0].id!;

  // Create fresh spreadsheet with first tab
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [{ properties: { title: TABS[0].name, gridProperties: { frozenRowCount: 1 } } }],
    },
  });
  const id = created.data.spreadsheetId!;

  // Add remaining tabs in one batch
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: TABS.slice(1).map(t => ({
        addSheet: { properties: { title: t.name, gridProperties: { frozenRowCount: 1 } } },
      })),
    },
  });

  // Write headers for all tabs
  await Promise.all(TABS.map(t =>
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
    requestBody: { values: DEFAULT_TARGETS },
  });

  // Share with service account so logger writes work without admin session
  if (SA_EMAIL) {
    await drive.permissions.create({
      fileId: id,
      requestBody: { type: "user", role: "writer", emailAddress: SA_EMAIL },
      sendNotificationEmail: false,
    });
  }

  return id;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/admin?error=no_code", req.url));

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data: info } = await oauth2.userinfo.get();

    const session: AdminSession = {
      accessToken:   tokens.access_token!,
      refreshToken:  tokens.refresh_token ?? "",
      expiryDate:    tokens.expiry_date ?? Date.now() + 3600_000,
      spreadsheetId: "",
      adminEmail:    info.email!,
      adminName:     info.name ?? info.email!,
    };

    session.spreadsheetId = await findOrCreateSpreadsheet(session);

    const res = NextResponse.redirect(new URL("/admin", req.url));
    res.headers.set("Set-Cookie", sessionCookieHeader(session));
    return res;
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(new URL("/admin?error=auth_failed", req.url));
  }
}
