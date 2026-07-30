import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData, runAntifraudChecks } from "@/lib/telegram-webapp";
import { findEmployeeByChatId, isAtmInTodayRoute } from "@/lib/miniapp";
import { getAtmById, findAtmByCode, updateAtm } from "@/lib/atms";
import { listMachines } from "@/lib/machines";
import { getStatusById } from "@/lib/statuses";
import { listCategories } from "@/lib/categories";
import { createCleaningReport, updateCleaningReport } from "@/lib/cleaning-reports";
import { notifyManagerReport, notifyCleaningReportToGroup } from "@/lib/notifications";
import { formatTashkentDateTime } from "@/lib/tz";
import { savePhotoFile, archivePhotoToTelegram } from "@/lib/photo-storage";
import { submitChangeRequest } from "@/lib/atm-change-history";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    initData,
    atmId,
    atmCode,
    enteredCode,
    photoData,
    photos,
    gpsLat,
    gpsLon,
    gpsAccuracy,
    photoFromCamera,
    clientTime,
    workStatusId,
    addressCorrect,
    coordsCorrect,
    locationComment,
    isNewAtmReport,
  } = body;

  // 1. Проверяем, что запрос реально из Telegram Mini App этого сотрудника
  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность (Telegram)" }, { status: 401 });
  }

  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Сотрудник не найден. Обратитесь к руководителю." }, { status: 403 });
  }

  // 2. Определяем банкомат: обычный отчёт из маршрута приходит с atmId,
  // "Внеочередная очистка" — по вручную введённому коду (atmId пустой).
  // Код может совпасть с уже существующим банкоматом (тогда подтягиваем
  // его координаты для антифрода) или быть полностью новым — это
  // допустимо, отчёт всё равно принимается, просто без сверки расстояния.
  const codeForLookup = String(enteredCode ?? atmCode ?? "").trim();
  const atm = atmId ? getAtmById(atmId) : codeForLookup ? findAtmByCode(codeForLookup) : null;
  if (!atmId && !codeForLookup) {
    return NextResponse.json(
      { ok: false, error: "Не указан ни ID банкомата из маршрута, ни код, введённый вручную." },
      { status: 400 }
    );
  }
  if (atmId && !atm) {
    return NextResponse.json({ ok: false, error: "Банкомат с таким ID не найден." }, { status: 404 });
  }

  const resolvedAtmId = atm?.id ?? "";
  const resolvedAtmCode = atm?.code ?? codeForLookup;

  // 3. Проверка ID, введённого сотрудником вручную на месте, против того,
  // что реально должно быть по этому банкомату — сотрудник не видит код
  // заранее в приложении, должен прочитать его с самого устройства.
  const codeMismatch = Boolean(atm && atm.code && codeForLookup && atm.code.trim() !== codeForLookup);

  const statusRecord = workStatusId ? getStatusById(String(workStatusId)) : null;

  // 4а. Банкоматы категории "Внутри здания" — не зона ответственности
  // экипажей вообще (этим занимается арендодатель), не просто "вне
  // маршрута". Сотрудникам объясняли устно несколько раз, но отчёты всё
  // равно продолжали приходить — теперь система отказывает сама, а не
  // полагается на память сотрудника.
  if (atm && atm.categoryId) {
    const category = listCategories().find((c) => c.id === atm.categoryId);
    if (category?.excludedFromRouting) {
      return NextResponse.json(
        {
          ok: false,
          error: `Банкомат «${atm.name}» — категория «${category.name}». Обслуживание не входит в обязанности экипажа (занимается арендодатель). Отчёт не принят.`,
        },
        { status: 403 }
      );
    }
  }

  // 4б. Антифрод — НЕ блокирует, только помечает. "Вне маршрута"
  // (банкомат есть в базе, но не назначен на сегодня) — штатный
  // сценарий, внеочередная очистка допускается: сотрудники регулярно
  // убирают банкоматы вне строгого порядка, и это не мошенничество.
  const inRoute = atm ? isAtmInTodayRoute(employee.id, atm.id) : false;

  const antifraud = runAntifraudChecks({
    atmLat: atm ? parseFloat(atm.latitude) : NaN,
    atmLon: atm ? parseFloat(atm.longitude) : NaN,
    gpsLat: parseFloat(String(gpsLat)),
    gpsLon: parseFloat(String(gpsLon)),
    hasPhoto: Boolean(photoData),
    photoFromCamera: Boolean(photoFromCamera),
    inRoute,
  });
  if (codeMismatch) {
    antifraud.flags.push(`Введённый ID (${codeForLookup}) не совпадает с ID банкомата в маршруте (${atm?.code})`);
  }

  // 5. Сохраняем отчёт (принимается всегда). Фото сохраняем файлом на
  // диск (Volume) и в БД кладём только короткую ссылку — раньше сюда
  // писался целиком base64 (обычно 1-5 МБ на каждое фото), и база быстро
  // разрасталась.
  // Сохраняем все фото файлами (не base64 в БД). Поддерживаем и старый
  // одиночный photoData, и новый массив photos (минимум 5 с телефона).
  const allPhotoInputs: string[] =
    Array.isArray(photos) && photos.length > 0 ? photos : photoData ? [photoData] : [];
  const photoUrls = (
    await Promise.all(allPhotoInputs.map((p) => savePhotoFile(p)))
  ).filter((u): u is string => Boolean(u));
  const photoUrl = photoUrls[0] || "";
  // Машина сотрудника ПРЯМО СЕЙЧАС — фиксируем как факт в самом отчёте,
  // не вычисляем заново при каждом чтении (см. комментарий в модели).
  const employeeMachine = listMachines().find(
    (m) => m.employee1Id === employee.id || m.employee2Id === employee.id
  );

  const report = createCleaningReport({
    atmId: resolvedAtmId,
    atmCode: resolvedAtmCode,
    employeeId: employee.id,
    employeeName: employee.fullName,
    machineId: employeeMachine?.id || "",
    photoData: photoUrl,
    photosJson: photoUrls.length > 0 ? JSON.stringify(photoUrls) : undefined,
    gpsLat: String(gpsLat),
    gpsLon: String(gpsLon),
    clientTime: clientTime || new Date().toISOString(),
    inRoute,
    distanceMeters: antifraud.distanceMeters,
    antifraudFlags: antifraud.flags,
    enteredCode: codeForLookup,
    codeMismatch,
    reportedWorkStatusId: String(workStatusId || ""),
    reportedWorkStatusName: statusRecord?.name || "",
    addressCorrect: Boolean(addressCorrect),
    coordsCorrect: Boolean(coordsCorrect),
    locationComment: String(locationComment || ""),
  });

  // 6. Помечаем банкомат обслуженным сегодня — это и зелёный статус, и
  // приоритет в будущих маршрутах (п.10: недавно очищенные — в конец
  // очереди).
  //
  // Подтверждение адреса/координат теперь обрабатывается в ОБЕ стороны, но
  // по-разному: "верно" — это просто подтверждение существующих данных,
  // применяется сразу (ничего не меняется, риска нет). А вот "неверно"
  // ТЕПЕРЬ уходит в единую очередь подтверждения (lib/atm-change-history)
  // вместо немедленного сброса флага одним отчётом — новое значение
  // координат берётся из GPS сотрудника, и реально меняет данные банкомата
  // только после 3 независимых наблюдений в разные дни (см. интервью
  // по плану: раньше один отчёт с "неверно" тут же портил доверенный флаг).
  if (atm) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
    updateAtm(atm.id, {
      lastCleanedDate: today,
      ...(addressCorrect === true ? { addressVerified: true } : {}),
      ...(coordsCorrect === true ? { coordsVerified: true } : {}),
    });
    if ((addressCorrect === false || coordsCorrect === false) && gpsLat != null && gpsLon != null) {
      submitChangeRequest({
        atmId: atm.id,
        atmCode: atm.code,
        changeType: "location",
        oldAddress: atm.address,
        oldLat: atm.latitude,
        oldLon: atm.longitude,
        newLat: String(gpsLat),
        newLon: String(gpsLon),
        comment: String(locationComment || ""),
        employeeId: employee.id,
        employeeName: employee.fullName,
      });
    }
  }

  // Заявка "Новый банкомат (нет в базе)" — банкомата формально ещё нет,
  // отчёт об очистке уже принят и сохранён (никогда не блокируем), а
  // создание РЕАЛЬНОЙ записи в atms — отдельная асинхронная заявка.
  // После 3 независимых подтверждений (тот же порог) банкомат появится
  // в справочнике, и этот и будущие отчёты по его коду привяжутся сами.
  if (isNewAtmReport && !atm && codeForLookup && gpsLat != null && gpsLon != null) {
    submitChangeRequest({
      atmId: "",
      atmCode: codeForLookup,
      changeType: "new_atm",
      newLat: String(gpsLat),
      newLon: String(gpsLon),
      newAddressText: String(locationComment || ""),
      comment: String(locationComment || ""),
      employeeId: employee.id,
      employeeName: employee.fullName,
    });
  }

  // 7 и 8. Отправку в Telegram НЕ ждём (без await): раньше сотрудник ждал,
  // пока все фото (до 5) уйдут в группу и, при антифроде, руководителю —
  // это занимало много секунд, телефон на мобильной связи обрывал
  // соединение (ECONNRESET / "aborted" в логах), а в приложении долго
  // висело "Отправка…". Теперь отчёт уже сохранён, поэтому отвечаем
  // сотруднику сразу, а доставку в Telegram выполняем в фоне. Если она
  // не удастся — отчёт всё равно сохранён в системе и виден руководителю.
  const backgroundNotify = async () => {
    try {
      // Переносим фото на диске в архивный Telegram-канал ПОСЛЕ ответа
      // сотруднику — освобождает место на диске, но не задерживает
      // "Отчёт принят". Если канал не настроен/недоступен — фото
      // остаётся на диске (archivePhotoToTelegram вернёт null), это не
      // ошибка, а нормальный запасной вариант.
      let reportForNotify = report;
      if (photoUrls.length > 0) {
        const archivedUrls = await Promise.all(
          photoUrls.map((u) => archivePhotoToTelegram(u, `Отчёт: ${resolvedAtmCode || atm?.name || "банкомат"}`))
        );
        const finalUrls = archivedUrls.map((archived, i) => archived || photoUrls[i]);
        if (finalUrls.some((u, i) => u !== photoUrls[i])) {
          updateCleaningReport(report.id, {
            photoData: finalUrls[0] || "",
            photosJson: finalUrls.length > 0 ? JSON.stringify(finalUrls) : undefined,
          });
          reportForNotify = {
            ...report,
            photoData: finalUrls[0] || "",
            photosJson: finalUrls.length > 0 ? JSON.stringify(finalUrls) : undefined,
          };
        }
      }

      await notifyCleaningReportToGroup(reportForNotify, atm);
      if (antifraud.flags.length > 0) {
        const accNote = gpsAccuracy ? ` (точность GPS: ${Math.round(Number(gpsAccuracy))} м)` : "";
        await notifyManagerReport(
          [
            "⚠️ <b>Антифрод: подозрительный отчёт об очистке</b>",
            `Банкомат: ${resolvedAtmCode || "без кода"}${atm ? ` — ${atm.name}` : " (введён вручную, не найден в базе)"}`,
            `Сотрудник: ${employee.fullName}`,
            `Причины: ${antifraud.flags.join("; ")}${accNote}`,
            `Время: ${formatTashkentDateTime(new Date())}`,
          ].join("\n")
        );
      }
    } catch {
      /* доставка в Telegram не критична: отчёт уже сохранён */
    }
  };
  void backgroundNotify();

  return NextResponse.json({
    ok: true,
    reportId: report.id,
    inRoute,
    codeMismatch,
    antifraudFlags: antifraud.flags,
    message: inRoute
      ? "Отчёт принят, спасибо!"
      : "Отчёт принят. Банкомат был вне вашего маршрута — руководитель уведомлён (это не ошибка).",
  });
}
