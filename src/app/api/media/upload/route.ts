import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    const token = (session as any).accessToken as string;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing Google access token" }, { status: 401 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const drive = google.drive({ version: "v3", auth });

    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);

    const created = await drive.files.create({
      requestBody: {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: buffer,
      },
      fields: "id,name",
    });

    const fileId = created.data.id;
    if (!fileId) {
      return NextResponse.json({ ok: false, error: "Upload failed: no file ID returned" }, { status: 500 });
    }

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const meta = await drive.files.get({
      fileId,
      fields: "id,name,webViewLink,webContentLink",
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: fileId,
        name: meta.data.name,
        url: meta.data.webContentLink || meta.data.webViewLink,
        viewUrl: meta.data.webViewLink,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
