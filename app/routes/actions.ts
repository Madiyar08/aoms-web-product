"use server";

import { buildRouteForSchedule, getRouteById, markRouteSent } from "@/lib/routes";
import { notifyRouteToCrew } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

export async function buildRouteAction(scheduleId: string) {
  await buildRouteForSchedule(scheduleId);
  revalidatePath("/routes");
}

export async function sendRouteAction(routeId: string) {
  const route = getRouteById(routeId);
  if (!route) return;

  const result = await notifyRouteToCrew(route);
  const parts: string[] = [];
  if (result.employee1) parts.push(`Сотрудник №1: ${result.employee1.ok ? "отправлено" : result.employee1.error}`);
  if (result.employee2) parts.push(`Сотрудник №2: ${result.employee2.ok ? "отправлено" : result.employee2.error}`);
  markRouteSent(routeId, parts.join(" · ") || "Не удалось определить экипаж");
  revalidatePath("/routes");
}
