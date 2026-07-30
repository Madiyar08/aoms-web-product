import { NextRequest, NextResponse } from "next/server";
import { deleteOldPhotos } from "@/lib/photo-storage";

export async function POST(req: NextRequest) {
  const { days } = await req.json();
  const n = Number(days);
  if (!n || n < 30) {
    return NextResponse.json({ ok: false, error: "Минимум 30 дней — защита от случайного удаления свежих фото" }, { status: 400 });
  }
  const result = deleteOldPhotos(n);
  return NextResponse.json({ ok: true, ...result });
}
