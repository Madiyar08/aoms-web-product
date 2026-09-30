import { NextResponse } from "next/server";
import { getPhotoStorageStats } from "@/lib/photo-storage";

// Без этого Next.js может статически оптимизировать простой GET без
// параметров и закэшировать ответ ещё на этапе сборки (когда папки с
// фото могло не быть вообще) — тогда статистика замирает навсегда.
export const dynamic = "force-dynamic";

export async function GET() {
  const stats = getPhotoStorageStats();
  return NextResponse.json({ ok: true, ...stats });
}
