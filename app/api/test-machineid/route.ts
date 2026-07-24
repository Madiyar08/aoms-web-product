import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createEmployee } from "@/lib/employees";
import { createMachine } from "@/lib/machines";
import { createAtm } from "@/lib/atms";
import { ensureDefaultStatuses } from "@/lib/statuses";
import { listCleaningReports } from "@/lib/cleaning-reports";

const TOKEN = "test-mid-token";
function makeInitData(userId: string) {
  const params: Record<string, string> = { user: JSON.stringify({ id: userId, first_name: "T" }), auth_date: String(Math.floor(Date.now()/1000)) };
  const dcs = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(TOKEN).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dcs).digest("hex");
  const usp = new URLSearchParams(params); usp.append("hash", hash);
  return usp.toString();
}

export async function POST() {
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  ensureDefaultStatuses();
  const emp = createEmployee({ fullName: "Тест Экипаж", phone: "", status: "Активен", comments: "", telegramChatId: "5551", role: "Уборщик" });
  const machineA = createMachine({ number: "MACH-A", employee1Id: emp.id, employee2Id: "", status: "На маршруте", comments: "" });
  const atm = createAtm({ code: "MID1", name: "Тест", address: "тест", district: "тест", latitude: "41.3", longitude: "69.3", categoryId: "", workStatusId: "", addressVerified: true, coordsVerified: true, comments: "", source: "test" });
  const initData = makeInitData("5551");

  // Отчёт сдан, когда сотрудник был на MACH-A
  await fetch("http://localhost:3000/api/miniapp/submit-cleaning", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData, atmCode: "MID1", enteredCode: "MID1", photos: [], gpsLat: 41.3, gpsLon: 69.3, workStatusId: "", addressCorrect: true, coordsCorrect: true }),
  });

  // Сотрудника ПЕРЕСАДИЛИ на новую машину MACH-B
  const machineB = createMachine({ number: "MACH-B", employee1Id: emp.id, employee2Id: "", status: "На маршруте", comments: "" });

  const reports = listCleaningReports();
  const report = reports.find((r) => r.atmCode === "MID1");

  return NextResponse.json({
    отчётПривязанКMachineA: report?.machineId === machineA.id,
    отчётНЕпривязанКMachineB: report?.machineId !== machineB.id,
    machineIdЗначение: report?.machineId,
  });
}
