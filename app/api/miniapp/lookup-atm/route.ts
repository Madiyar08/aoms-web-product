import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId, getTodayDistrictsForEmployee } from "@/lib/miniapp";
import { findAtmByCode } from "@/lib/atms";
import { listCategories } from "@/lib/categories";

/**
 * Поиск банкомата по ID во ВСЕЙ базе (используется, когда ID не найден в
 * сегодняшнем маршруте — п.1/п.2 ТЗ). Возвращает, входит ли найденный
 * банкомат в один из районов, назначенных сотруднику на сегодня:
 *  - тот же район → можно оформить как "вне маршрута" (внеочередная
 *    очистка допускается — штатный сценарий, не мошенничество);
 *  - другой район → клиент должен отказать в оформлении.
 *
 * ИСКЛЮЧЕНИЕ: банкоматы категории "Внутри здания" (или любой другой с
 * excludedFromRouting) отклоняются всегда, независимо от района — это
 * вообще не зона ответственности экипажа (занимается арендодатель), а
 * не вопрос "в маршруте или нет".
 */
export async function POST(req: NextRequest) {
  const { initData, code } = await req.json();

  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Сотрудник не найден" }, { status: 403 });
  }

  const trimmed = String(code || "").trim();
  if (!trimmed) {
    return NextResponse.json({ ok: false, error: "ID не указан" }, { status: 400 });
  }

  const atm = findAtmByCode(trimmed);
  if (!atm) {
    return NextResponse.json({ ok: false, error: "Банкомат с таким ID не найден в базе." }, { status: 404 });
  }

  if (atm.categoryId) {
    const category = listCategories().find((c) => c.id === atm.categoryId);
    if (category?.excludedFromRouting) {
      return NextResponse.json(
        {
          ok: false,
          error: `Банкомат «${atm.name}» — категория «${category.name}». Обслуживание не входит в обязанности экипажа.`,
        },
        { status: 403 }
      );
    }
  }

  const todayDistricts = getTodayDistrictsForEmployee(employee.id);
  const sameDistrict = todayDistricts.includes(atm.district);

  return NextResponse.json({
    ok: true,
    sameDistrict,
    atm: {
      id: atm.id,
      code: atm.code,
      name: atm.name,
      address: atm.address,
      district: atm.district,
      latitude: atm.latitude,
      longitude: atm.longitude,
    },
  });
}
