import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createEmployee } from "@/lib/employees";
import { createMachine } from "@/lib/machines";
import { createAtm } from "@/lib/atms";
import { createScheduleEntry } from "@/lib/schedule";
import { listCategories, ensureDefaultCategories } from "@/lib/categories";
import { buildReportRows } from "@/lib/reports";
import { createCleaningReport } from "@/lib/cleaning-reports";

const TOKEN = "test-block-token";
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
  ensureDefaultCategories();
  const insideCat = listCategories().find((c) => c.name === "Внутри здания")!;

  const emp = createEmployee({ fullName: "Тест Блок", phone: "", status: "Активен", comments: "", telegramChatId: "8881", role: "Уборщик" });
  const machine = createMachine({ number: "BLOCK-1", employee1Id: emp.id, employee2Id: "", status: "На маршруте", comments: "" });

  const atmInside = createAtm({
    code: "INSIDE1", name: "Внутри здания тест", address: "", district: "БлокРайон",
    latitude: "41.30", longitude: "69.30", categoryId: insideCat.id, workStatusId: "",
    addressVerified: true, coordsVerified: true, comments: "", source: "test",
  });
  const atmNotInRoute = createAtm({
    code: "NOTINROUTE1", name: "Не в маршруте тест", address: "", district: "БлокРайон",
    latitude: "41.31", longitude: "69.31", categoryId: "", workStatusId: "",
    addressVerified: true, coordsVerified: true, comments: "", source: "test",
  });

  const initData = makeInitData("8881");

  // Попытка 1: отчёт по банкомату "Внутри здания" — должен отклониться
  const res1 = await fetch("http://localhost:3000/api/miniapp/submit-cleaning", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData, atmCode: "INSIDE1", enteredCode: "INSIDE1", photos: [], gpsLat: 41.30, gpsLon: 69.30, workStatusId: "", addressCorrect: true, coordsCorrect: true }),
  });
  const data1 = await res1.json();

  // Попытка 2: отчёт по банкомату НЕ в сегодняшнем маршруте — должен отклониться
  const res2 = await fetch("http://localhost:3000/api/miniapp/submit-cleaning", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData, atmCode: "NOTINROUTE1", enteredCode: "NOTINROUTE1", photos: [], gpsLat: 41.31, gpsLon: 69.31, workStatusId: "", addressCorrect: true, coordsCorrect: true }),
  });
  const data2 = await res2.json();

  // === Тест KPI по точкам: 4 банкомата рядом (в одной точке) + расписание на сегодня, KPI=1 ===
  const today = new Date().toISOString().slice(0, 10);
  const schedule = createScheduleEntry({ machineId: machine.id, date: today, districts: ["КластерРайон"], kpiTarget: 1, comments: "" });

  const clusterAtms = [];
  for (let i = 0; i < 4; i++) {
    clusterAtms.push(createAtm({
      code: `CLUSTER${i}`, name: `Кластер ${i}`, address: "", district: "КластерРайон",
      latitude: String(41.320 + i * 0.00001), longitude: String(69.320 + i * 0.00001), // все в пределах ~2м друг от друга
      categoryId: "", workStatusId: "", addressVerified: true, coordsVerified: true, comments: "", source: "test",
    }));
  }
  for (const a of clusterAtms) {
    createCleaningReport({
      atmId: a.id, atmCode: a.code, employeeId: emp.id, employeeName: emp.fullName, machineId: machine.id,
      photoData: "", gpsLat: a.latitude, gpsLon: a.longitude, clientTime: new Date().toISOString(),
      inRoute: false, distanceMeters: 0, antifraudFlags: [], enteredCode: a.code, codeMismatch: false,
      reportedWorkStatusId: "", reportedWorkStatusName: "", addressCorrect: true, coordsCorrect: true, locationComment: "",
    });
  }

  const reportRows = buildReportRows({});
  const clusterRow = reportRows.find((r) => r.machineNumber === "BLOCK-1" && r.date === today);

  return NextResponse.json({
    "Внутри здания отклонён": data1.ok === false,
    "текст ошибки 1": data1.error,
    "Не в маршруте отклонён": data2.ok === false,
    "текст ошибки 2": data2.error,
    "4 банкомата рядом = сколько точек по KPI": clusterRow?.doneStops,
    "банкоматов всего (не точек)": clusterRow?.doneTotal,
    "KPI% (при цели=1 точка)": clusterRow?.donePct,
  });
}
