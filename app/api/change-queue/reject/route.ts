import { NextRequest, NextResponse } from "next/server";
import { rejectChangeRequest } from "@/lib/atm-change-history";

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  const ok = rejectChangeRequest(String(id || ""));
  return NextResponse.json({ ok });
}
