import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { Readable } from "stream";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large (max 25 MB)" }, { status: 400 });
    }

    const token = (session as any).accessToken as string;
    if (!token) return NextResponse.json({ ok: false, error: "Missing Google access token — sign out and sign back in" }, { status: 401 });

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const drive = google.drive({ version: "v3", auth });

    const ab     = await file.arrayBuffer();
    const buffer = Buffer.from(ab);
    const stream = Readable.from(buffer);

    // Upload to Drive
    const created = await drive.files.create({
      requestBody: {
        name:     file.name,
        mimeType: file.type || "application/octet-stream",
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body:     stream,
      },
      fields: "id,name,mimeType",
    });

    const fileId = created.data.id;
    if (!fileId) return NextResponse.json({ ok: false, error: "Upload failed — no file ID" }, { status: 500 });

    // Make file publicly readable (required for Buffer/Instagram/Facebook to fetch it)
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // Google Drive CDN URL — this is what lh3.googleusercontent.com serves
    // It's a direct byte-stream with no redirect/CAPTCHA, works with Instagram & Facebook APIs
    const cdnUrl     = `https://lh3.googleusercontent.com/d/${fileId}`;
    // Fallback export URL (works for images, may redirect for large files)
    const exportUrl  = `https://drive.google.com/uc?export=download&id=${fileId}`;
    // View URL for humans
    const viewUrl    = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

    return NextResponse.json({
      ok: true,
      data: {
        id:          fileId,
        name:        file.name,
        // url is what gets stored as mediaUrl and sent to Make.com / Buffer
        // Use the CDN URL — no auth wall, direct bytes, works with Instagram/Facebook
        url:         cdnUrl,
        cdnUrl,
        exportUrl,
        viewUrl,
      },
    });
  } catch (err: any) {
    // Surface the exact error so the user can see if it's a scope issue
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}