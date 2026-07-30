import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { listDistinctDistricts } from "@/lib/atms";

/** Список районов для выбора "правильного района" в форме "Неправильный
 * район" — без этого список пришлось бы вписывать текстом вручную, с
 * риском опечаток (та же проблема, которую решает GPS для координат). */
export async function POST(req: NextRequest) {
  const { initData } = await req.json();
  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, districts: listDistinctDistricts() });
}
