/**
 * POST /api/media/upload
 * Accepts a multipart file upload, stores it in Google Drive,
 * and returns a publicly shareable URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";
import type { ApiResult } from "@/types";
import { Readable } from "stream";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json<ApiResult>({ ok: false, error: "No file provided" }, { status: 400 });
    }

    // Size limit: 20MB
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json<ApiResult>({ ok: false, error: "File too large (max 20MB)" }, { status: 400 });
    }

    const token = (session as any).accessToken as string;
    const auth  = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const drive = google.drive({ version: "v3", auth });

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);
    const stream      = Readable.from(buffer);

    // Upload to Drive
    const driveRes = await drive.files.create({
      requestBody: {
        name:    file.name,
        mimeType: file.type,
      },
      media: {
        mimeType: file.type,
        body:     stream,
      },
      fields: "id,webViewLink,webContentLink",
    });

    const fileId = driveRes.data.id;
    if (!fileId) throw new Error("Drive upload failed — no file ID returned");

    // Make the file publicly readable
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // Build a direct-view URL
    const url = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

    return NextResponse.json<ApiResult>({ ok: true, data: { url, fileId } }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json<ApiResult>({ ok: false, error: err.message }, { status: 500 });
  }
}