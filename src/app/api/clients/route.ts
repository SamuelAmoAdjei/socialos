import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClients, createClient } from "@/lib/sheets";
import { google } from "googleapis";
import type { ApiResult } from "@/types";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok:false, error:"Unauthorised" }, { status:401 });
  try {
    const clients = await getClients((session as any).accessToken);
    return NextResponse.json<ApiResult>({ ok:true, data:clients });
  } catch (err:any) {
    return NextResponse.json<ApiResult>({ ok:false, error:err.message }, { status:500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok:false, error:"Unauthorised" }, { status:401 });
  try {
    const body = await req.json();
    const token = (session as any).accessToken as string;

    // Update existing client when clientId is provided.
    if (body.clientId) {
      const clients = await getClients(token);
      const idx = clients.findIndex(c => c.id === body.clientId);
      if (idx === -1) {
        return NextResponse.json<ApiResult>({ ok:false, error:"Client not found" }, { status:404 });
      }
      const rowIndex = idx + 2; // header row is 1

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });
      const api = google.sheets({ version:"v4", auth });

      const meta = await api.spreadsheets.get({ spreadsheetId: SHEET_ID });
      const clientsSheet = meta.data.sheets?.find(
        s => s.properties?.title?.toLowerCase() === "clients"
      );
      const tabName = clientsSheet?.properties?.title || "Clients";

      await api.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: [
            { range: `${tabName}!B${rowIndex}`, values: [[body.name ?? ""]] },
            { range: `${tabName}!C${rowIndex}`, values: [[body.email ?? ""]] },
            { range: `${tabName}!D${rowIndex}`, values: [[body.timezone ?? "UTC"]] },
            { range: `${tabName}!E${rowIndex}`, values: [[body.makeWebhookUrl ?? ""]] },
            { range: `${tabName}!F${rowIndex}`, values: [[Array.isArray(body.platforms) ? body.platforms.join(",") : ""]] },
            { range: `${tabName}!G${rowIndex}`, values: [[body.approvalRequired ? "TRUE" : "FALSE"]] },
          ],
        },
      });

      return NextResponse.json<ApiResult>({ ok:true, data:{ id: body.clientId, updated:true } });
    }

    const id = await createClient(token, {
      id:"", name:body.name??"", email:body.email??"",
      timezone:body.timezone??"UTC", makeWebhookUrl:body.makeWebhookUrl??"",
      platforms:body.platforms??[], approvalRequired:body.approvalRequired??true,
    });
    return NextResponse.json<ApiResult>({ ok:true, data:{ id, created:true } }, { status:201 });
  } catch (err:any) {
    return NextResponse.json<ApiResult>({ ok:false, error:err.message }, { status:500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok:false, error:"Unauthorised" }, { status:401 });
  try {
    const { clientId } = await req.json();
    if (!clientId) return NextResponse.json({ ok:false, error:"Missing clientId" }, { status:400 });

    const token = (session as any).accessToken as string;

    // Find the row index of this client
    const clients = await getClients(token);
    const idx = clients.findIndex(c => c.id === clientId);
    if (idx === -1) return NextResponse.json({ ok:false, error:"Client not found" }, { status:404 });

    const rowIndex = idx + 2; // 1-based, row 1 = header

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const api  = google.sheets({ version:"v4", auth });

    // Get sheet ID (gid) for the Clients tab
    const meta = await api.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const clientsSheet = meta.data.sheets?.find(
      s => s.properties?.title?.toLowerCase() === "clients"
    );
    const sheetGid = clientsSheet?.properties?.sheetId ?? 0;

    await api.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests:[{
          deleteDimension:{
            range:{
              sheetId:    sheetGid,
              dimension:  "ROWS",
              startIndex: rowIndex - 1,
              endIndex:   rowIndex,
            }
          }
        }]
      }
    });

    return NextResponse.json<ApiResult>({ ok:true, data:{ deleted:clientId } });
  } catch (err:any) {
    return NextResponse.json<ApiResult>({ ok:false, error:err.message }, { status:500 });
  }
}