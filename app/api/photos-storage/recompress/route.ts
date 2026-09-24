import { NextResponse } from "next/server";
import { recompressExistingPhotos } from "@/lib/photo-storage";

export async function POST() {
  const result = await recompressExistingPhotos(30);
  return NextResponse.json({ ok: true, ...result });
}
