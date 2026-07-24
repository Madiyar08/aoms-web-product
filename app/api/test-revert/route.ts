import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createEmployee } from "@/lib/employees";
import { createMachine } from "@/lib/machines";
import { createAtm } from "@/lib/atms";
import { listCategories, ensureDefaultCategories } from "@/lib/categories";

const TOKEN = "test-revert-token";
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

  const emp = createEmployee({ fullName: "Тест Откат", phone: "", status: "Активен", comments: "", telegramChatId: "7771", role: "Уборщик" });
  const machine = createMachine({ number: "REV-1", employee1Id: emp.id, employee2Id: "", status: "На маршруте", comments: "" });

  const atmInside = createAtm({
    code: "REVINSIDE", name: "Внутри здания", address: "", district: "РевРайон",
    latitude: "41.30", longitude: "69.30", categoryId: insideCat.id, workStatusId: "",
    addressVerified: true, coordsVerified: true, comments: "", source: "test",
  });
  const atmNotInRoute = createAtm({
    code: "REVNOTROUTE", name: "Не в маршруте", address: "", district: "РевРайон",
    latitude: "41.31", longitude: "69.31", categoryId: "", workStatusId: "",
    addressVerified: true, coordsVerified: true, comments: "", source: "test",
  });

  const initData = makeInitData("7771");

  const res1 = await fetch("http://localhost:3000/api/miniapp/submit-cleaning", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData, atmCode: "REVINSIDE", enteredCode: "REVINSIDE", photos: [], gpsLat: 41.30, gpsLon: 69.30, workStatusId: "", addressCorrect: true, coordsCorrect: true }),
  });
  const data1 = await res1.json();

  const res2 = await fetch("http://localhost:3000/api/miniapp/submit-cleaning", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData, atmCode: "REVNOTROUTE", enteredCode: "REVNOTROUTE", photos: [], gpsLat: 41.31, gpsLon: 69.31, workStatusId: "", addressCorrect: true, coordsCorrect: true }),
  });
  const data2 = await res2.json();

  return NextResponse.json({
    "Внутри здания ВСЁ ЕЩЁ отклонён (должно true)": data1.ok === false,
    "Не в маршруте ТЕПЕРЬ принимается (должно true)": data2.ok === true,
    "текст ответа 2": data2.message,
    "antifraudFlags отчёта 2": data2.antifraudFlags,
  });
}
