import { listEmployees, Employee } from "./employees";
import { listMachines } from "./machines";
import { listSchedule } from "./schedule";
import { listRoutes } from "./routes";
import { getAtmById, Atm } from "./atms";
import { todayTashkent } from "./tz";

/** Находит сотрудника по его Telegram chat_id (привязывается через /start). */
export function findEmployeeByChatId(chatId: string): Employee | null {
  return listEmployees().find((e) => e.telegramChatId === chatId) ?? null;
}

/**
 * Собирает сегодняшний маршрут для сотрудника: находит машину, где он в
 * экипаже, затем расписание этой машины на сегодня, затем построенный
 * маршрут. Возвращает список банкоматов, которые сотруднику нужно
 * обслужить сегодня.
 */
export function getTodayRouteForEmployee(employeeId: string): {
  atms: Atm[];
  machineNumber: string | null;
  scheduleFound: boolean;
} {
  const today = todayTashkent();

  const machine = listMachines().find(
    (m) => m.employee1Id === employeeId || m.employee2Id === employeeId
  );
  if (!machine) return { atms: [], machineNumber: null, scheduleFound: false };

  const schedule = listSchedule().find((s) => s.machineId === machine.id && s.date === today);
  if (!schedule) return { atms: [], machineNumber: machine.number, scheduleFound: false };

  const route = listRoutes().find((r) => r.scheduleId === schedule.id);
  if (!route) return { atms: [], machineNumber: machine.number, scheduleFound: false };

  const atms = route.atmIds
    .map((id) => getAtmById(id))
    .filter((a): a is Atm => a !== null);

  return { atms, machineNumber: machine.number, scheduleFound: true };
}

/** Проверяет, входит ли банкомат в сегодняшний маршрут сотрудника. */
export function isAtmInTodayRoute(employeeId: string, atmId: string): boolean {
  const { atms } = getTodayRouteForEmployee(employeeId);
  return atms.some((a) => a.id === atmId);
}

/**
 * Районы, назначенные сотруднику на сегодня (из расписания его машины),
 * даже если маршрут ещё не был построен. Используется для проверки
 * "банкомат вне маршрута, но в том же районе" при вводе ID (п.1/п.2 ТЗ).
 */
export function getTodayDistrictsForEmployee(employeeId: string): string[] {
  const today = todayTashkent();
  const machine = listMachines().find(
    (m) => m.employee1Id === employeeId || m.employee2Id === employeeId
  );
  if (!machine) return [];
  const schedule = listSchedule().find((s) => s.machineId === machine.id && s.date === today);
  return schedule?.districts ?? [];
}
