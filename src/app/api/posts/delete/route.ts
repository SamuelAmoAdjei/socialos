import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";
import type { ApiResult } from "@/types";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const { rowIndex } = await req.json();
    if (!rowIndex) return NextResponse.json({ ok: false, error: "Missing rowIndex" }, { status: 400 });

    const token = (session as any).accessToken as string;
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });

    const api = google.sheets({ version: "v4", auth });
    const meta = await api.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const postsSheet = meta.data.sheets?.find((s) => s.properties?.title?.toLowerCase() === "posts");
    const sheetId = postsSheet?.properties?.sheetId ?? 0;

    await api.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });

    return NextResponse.json<ApiResult>({ ok: true, data: { deleted: rowIndex } });
  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}
