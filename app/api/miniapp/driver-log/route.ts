import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { listMachines } from "@/lib/machines";
import { getDriverLogByMachineAndDate, upsertDriverLog, distanceKm } from "@/lib/driver-logs";
import { todayTashkent } from "@/lib/tz";
import { savePhotoFile, archivePhotoToTelegram } from "@/lib/photo-storage";

function resolveMachine(employeeId: string) {
  return listMachines().find((m) => m.employee1Id === employeeId || m.employee2Id === employeeId) ?? null;
}

/** GET-подобный запрос (POST, т.к. нужен initData в теле): текущее состояние учёта за сегодня. */
export async function PUT(req: NextRequest) {
  const { initData } = await req.json();
  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Сотрудник не найден" }, { status: 403 });
  }
  const machine = resolveMachine(employee.id);
  if (!machine) {
    return NextResponse.json({ ok: false, error: "Вам не назначена машина" }, { status: 404 });
  }
  const log = getDriverLogByMachineAndDate(machine.id, todayTashkent());
  return NextResponse.json({
    ok: true,
    machineNumber: machine.number,
    canFillIn: !employee.role || employee.role === "Водитель",
    log: log
      ? {
          odometerStart: log.odometerStart,
          odometerEnd: log.odometerEnd,
          fuelLiters: log.fuelLiters,
          fuelCost: log.fuelCost,
          comment: log.comment,
          distanceKm: distanceKm(log),
          odometerStartPhotoUrl: log.odometerStartPhotoUrl,
          odometerEndPhotoUrl: log.odometerEndPhotoUrl,
          receiptPhotoUrl: log.receiptPhotoUrl,
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    initData,
    odometerStart,
    odometerEnd,
    fuelLiters,
    fuelCost,
    comment,
    odometerStartPhoto,
    odometerEndPhoto,
    receiptPhoto,
  } = body;

  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Сотрудник не найден" }, { status: 403 });
  }
  const machine = resolveMachine(employee.id);
  if (!machine) {
    return NextResponse.json({ ok: false, error: "Вам не назначена машина" }, { status: 404 });
  }

  const patch: Record<string, number | string | null> = {};
  if (odometerStart !== undefined && odometerStart !== null && odometerStart !== "") {
    patch.odometerStart = Number(odometerStart);
  }
  if (odometerEnd !== undefined && odometerEnd !== null && odometerEnd !== "") {
    patch.odometerEnd = Number(odometerEnd);
  }
  if (fuelLiters !== undefined && fuelLiters !== null && fuelLiters !== "") {
    patch.fuelLiters = Number(fuelLiters);
  }
  if (fuelCost !== undefined && fuelCost !== null && fuelCost !== "") {
    patch.fuelCost = Number(fuelCost);
  }
  if (comment !== undefined) {
    patch.comment = String(comment || "");
  }
  // Фото одометра/чека — доказательство для бухгалтерии, сохраняем на
  // диск и в лог кладём только ссылку.
  if (odometerStartPhoto) {
    const url = await savePhotoFile(odometerStartPhoto);
    if (url) patch.odometerStartPhotoUrl = url;
  }
  if (odometerEndPhoto) {
    const url = await savePhotoFile(odometerEndPhoto);
    if (url) patch.odometerEndPhotoUrl = url;
  }
  if (receiptPhoto) {
    const url = await savePhotoFile(receiptPhoto);
    if (url) patch.receiptPhotoUrl = url;
  }

  const log = upsertDriverLog({
    machineId: machine.id,
    date: todayTashkent(),
    employeeId: employee.id,
    employeeName: employee.fullName,
    machineNumber: machine.number,
    patch,
  });

  // Переносим фото одометра/чека в архивный Telegram-канал в фоне — не
  // задерживаем ответ сотруднику. upsertDriverLog безопасно вызывать
  // повторно (это patch поверх той же записи дня), поэтому просто
  // обновляем ссылки после архивации.
  void (async () => {
    const archivedPatch: Record<string, string> = {};
    if (patch.odometerStartPhotoUrl) {
      const a = await archivePhotoToTelegram(String(patch.odometerStartPhotoUrl), "Одометр — начало дня");
      if (a) archivedPatch.odometerStartPhotoUrl = a;
    }
    if (patch.odometerEndPhotoUrl) {
      const a = await archivePhotoToTelegram(String(patch.odometerEndPhotoUrl), "Одометр — конец дня");
      if (a) archivedPatch.odometerEndPhotoUrl = a;
    }
    if (patch.receiptPhotoUrl) {
      const a = await archivePhotoToTelegram(String(patch.receiptPhotoUrl), "Чек за топливо");
      if (a) archivedPatch.receiptPhotoUrl = a;
    }
    if (Object.keys(archivedPatch).length > 0) {
      upsertDriverLog({
        machineId: machine.id,
        date: todayTashkent(),
        employeeId: employee.id,
        employeeName: employee.fullName,
        machineNumber: machine.number,
        patch: archivedPatch,
      });
    }
  })();

  return NextResponse.json({
    ok: true,
    message: "Сохранено",
    log: {
      odometerStart: log.odometerStart,
      odometerEnd: log.odometerEnd,
      fuelLiters: log.fuelLiters,
      fuelCost: log.fuelCost,
      comment: log.comment,
      distanceKm: distanceKm(log),
      odometerStartPhotoUrl: log.odometerStartPhotoUrl,
      odometerEndPhotoUrl: log.odometerEndPhotoUrl,
      receiptPhotoUrl: log.receiptPhotoUrl,
    },
  });
}
