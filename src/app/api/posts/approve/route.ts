import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updatePostRow, appendLog } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok:false, error:"Unauthorised" }, { status:401 });

  try {
    const { postId, rowIndex, status, note } = await req.json();

    if (!postId || !rowIndex || !status) {
      return NextResponse.json({ ok:false, error:"Missing required fields" }, { status:400 });
    }

    const token = (session as any).accessToken as string;

    await updatePostRow(token, rowIndex, { status });

    await appendLog(
      token, "client_action", postId, status,
      note ? `Client note: ${note}` : ""
    );

    return NextResponse.json({ ok:true, status });

  } catch (err: any) {
    return NextResponse.json({ ok:false, error:err.message }, { status:500 });
  }
}

