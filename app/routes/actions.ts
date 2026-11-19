"use server";

import { requireAdminPermission } from "@/lib/access-control";

import { buildRouteForSchedule, getRouteById, markRouteSent } from "@/lib/routes";
import { notifyRouteToCrew } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

export async function buildRouteAction(scheduleId: string) {
  requireAdminPermission("schedule:write");
  await buildRouteForSchedule(scheduleId);
  revalidatePath("/routes");
}

export async function sendRouteAction(routeId: string) {
  requireAdminPermission("schedule:write");
  const route = getRouteById(routeId);
  if (!route) return;

  const result = await notifyRouteToCrew(route);
  const parts: string[] = [];
  if (result.employee1) parts.push(`Сотрудник №1: ${result.employee1.ok ? "отправлено" : result.employee1.error}`);
  if (result.employee2) parts.push(`Сотрудник №2: ${result.employee2.ok ? "отправлено" : result.employee2.error}`);
  markRouteSent(routeId, parts.join(" · ") || "Не удалось определить экипаж");
  revalidatePath("/routes");
}
