import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/sheets";
import type { ApiResult } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok:false, error:"Unauthorised" }, { status:401 });
  try {
    const settings = await getSettings((session as any).accessToken);
    return NextResponse.json<ApiResult>({ ok:true, data: settings });
  } catch (err:any) {
    return NextResponse.json<ApiResult>({ ok:false, error:err.message }, { status:500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok:false, error:"Unauthorised" }, { status:401 });
  try {
    const body = await req.json();
    await updateSettings((session as any).accessToken, body);
    return NextResponse.json<ApiResult>({ ok:true, data: body });
  } catch (err:any) {
    return NextResponse.json<ApiResult>({ ok:false, error:err.message }, { status:500 });
  }
}