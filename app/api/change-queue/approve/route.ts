import { NextRequest, NextResponse } from "next/server";
import { manuallyApplyChangeRequest } from "@/lib/atm-change-history";

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  const ok = manuallyApplyChangeRequest(String(id || ""));
  return NextResponse.json({ ok });
}
