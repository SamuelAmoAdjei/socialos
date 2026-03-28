import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok:false, error:"Not signed in" }, { status:401 });

  const token = (session as any).accessToken as string;
  if (!token) return NextResponse.json({ ok:false, error:"No access token in session. Sign out and sign back in." }, { status:400 });

  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) return NextResponse.json({ ok:false, error:"GOOGLE_SHEETS_ID env var not set" }, { status:500 });

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const api = google.sheets({ version:"v4", auth });

    const meta = await api.spreadsheets.get({ spreadsheetId: sheetId });
    const tabs = meta.data.sheets?.map(s => s.properties?.title) ?? [];

    return NextResponse.json({
      ok:    true,
      sheetId,
      tabs,
      tokenLength: token.length,
      message: tabs.length > 0
        ? "Connection successful. Tab names listed above."
        : "Connected but no tabs found.",
    });
  } catch (err: any) {
    return NextResponse.json({
      ok:    false,
      error: err.message,
      code:  err.code,
      sheetId,
      hint:  err.message?.includes("403")
        ? "Permission denied. Sign out and sign back in to get a fresh token with Sheets scope."
        : err.message?.includes("404")
        ? "Sheet not found. Check your GOOGLE_SHEETS_ID in Vercel."
        : "Check the error message above.",
    }, { status: 500 });
  }
}