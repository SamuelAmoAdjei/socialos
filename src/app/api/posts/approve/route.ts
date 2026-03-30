import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updatePostRow, appendLog } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok:false, error:"Unauthorised" }, { status:401 });

  try {
    const { postId, rowIndex, status, note, content } = await req.json();

    if (!postId || !rowIndex || !status) {
      return NextResponse.json({ ok:false, error:"Missing required fields: postId, rowIndex, status" }, { status:400 });
    }

    const token = (session as any).accessToken as string;

    // Build the update — always update status, optionally update content
    const updates: Parameters<typeof updatePostRow>[2] = { status };
    if (content !== undefined && content !== null && content.trim()) {
      updates.content = content;
    }
    if (note) {
      updates.note = note;
    }

    await updatePostRow(token, rowIndex, updates);

    await appendLog(
      token, "client_action", postId, status,
      [note && `Note: ${note}`, content && `Content updated`].filter(Boolean).join(" | ")
    );

    return NextResponse.json({ ok:true, status });

  } catch (err: any) {
    return NextResponse.json({ ok:false, error:err.message }, { status:500 });
  }
}