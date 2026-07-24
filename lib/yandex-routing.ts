/**
 * Оптимизация порядка объезда через API «Яндекс Маршрутизация» (VRP).
 *
 * ВАЖНО (честно): это ДРУГОЙ продукт Яндекса, не обычный Maps API-ключ.
 * Для него нужна отдельная регистрация на yandex.ru/routing/vrp/, и по
 * документации доступ выдаётся не мгновенно ("оставьте заявку на
 * подключение"). Бесплатный тариф на момент проверки — до 50 точек и
 * 3 курьеров (правильную цифру сверяйте в своём личном кабинете при
 * подключении — условия периодически меняются).
 *
 * Я не могу проверить эту интеграцию вживую — нет ключа. Формат запроса
 * (SVRP — один курьер/машина на маршрут) взят из официальной
 * документации Яндекса и должен быть верным, но ТОЧНУЮ структуру
 * ответа с порядком точек я подтвердить не могу без реального вызова.
 * Поэтому парсинг ответа написан защищённо: если формат окажется
 * немного другим, вернётся понятная ошибка с сырым ответом API, а не
 * тихий сбой — и мы сможем поправить парсинг за одну итерацию, когда
 * увидим реальный ответ вместе.
 *
 * API: POST /add/svrp (поставить задачу) → id задачи
 *      GET  /result/svrp/<id> (опрос) → 202 ещё считается, 200 готово,
 *      410/500 — ошибка.
 */

const API_ROOT = "https://courier.yandex.ru/vrs/api/v1";

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface OptimizeResult {
  ok: boolean;
  error?: string;
  /** Индексы исходного массива points в оптимальном порядке объезда */
  orderedIndexes?: number[];
  totalDistanceM?: number;
  /** Сырой ответ API — для отладки, если парсинг не сработал как ожидалось */
  rawResponse?: unknown;
}

export function isYandexRoutingConfigured(): boolean {
  return Boolean(process.env.YANDEX_ROUTING_API_KEY);
}

export async function optimizeRouteOrder(depot: GeoPoint, points: GeoPoint[]): Promise<OptimizeResult> {
  const apiKey = process.env.YANDEX_ROUTING_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "YANDEX_ROUTING_API_KEY не задан — используется порядок без оптимизации" };
  }
  if (points.length === 0) {
    return { ok: false, error: "Нет точек для оптимизации" };
  }
  // Бесплатный тариф ограничен (проверяйте актуальный лимит в кабинете) —
  // не отправляем заведомо слишком большой запрос.
  if (points.length > 50) {
    return {
      ok: false,
      error: `Слишком много точек для бесплатного тарифа (${points.length} > 50) — оптимизация пропущена`,
    };
  }

  const payload = {
    depot: { id: 0, time_window: "00:00:00-23:59:59", point: { lat: depot.lat, lon: depot.lon } },
    locations: points.map((p, idx) => ({
      id: idx + 1,
      time_window: "00:00:00-23:59:59",
      point: { lat: p.lat, lon: p.lon },
    })),
    vehicle: { id: 0 },
    options: { time_zone: 5 }, // Ташкент, UTC+5
  };

  let taskId: string | number;
  try {
    const submitRes = await fetch(`${API_ROOT}/add/svrp?apikey=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const submitText = await submitRes.text();
    if (submitRes.status !== 200 && submitRes.status !== 202) {
      return { ok: false, error: `Яндекс.Маршрутизация отклонила запрос (${submitRes.status}): ${submitText}` };
    }
    const submitData = JSON.parse(submitText);
    taskId = submitData.id;
    if (taskId === undefined) {
      return { ok: false, error: "В ответе нет ID задачи", rawResponse: submitData };
    }
  } catch (e) {
    return { ok: false, error: `Не удалось отправить задачу: ${(e as Error).message}` };
  }

  // Поллинг результата — до ~20 секунд
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const pollRes = await fetch(`${API_ROOT}/result/svrp/${taskId}?apikey=${apiKey}`);
      if (pollRes.status === 202) continue; // ещё считается

      const pollText = await pollRes.text();
      if (pollRes.status !== 200) {
        return { ok: false, error: `Задача завершилась с ошибкой (${pollRes.status}): ${pollText}` };
      }

      const data = JSON.parse(pollText);
      const route = data?.result?.routes?.[0];
      if (!route) {
        return { ok: false, error: "В ответе нет маршрута — формат мог отличаться от ожидаемого", rawResponse: data };
      }

      // Защищённый разбор порядка точек: ожидаем массив route.route с
      // узлами, где значение location.id совпадает с id, который мы
      // передали (idx + 1). Если структура другая — вернём сырой ответ.
      const steps: unknown[] = Array.isArray(route.route) ? route.route : [];
      const orderedIndexes: number[] = [];
      for (const step of steps) {
        const node = (step as { node?: { value?: { type?: string; id?: number } } })?.node;
        if (node?.value?.type === "location" && typeof node.value.id === "number") {
          orderedIndexes.push(node.value.id - 1);
        }
      }

      if (orderedIndexes.length !== points.length) {
        return {
          ok: false,
          error: `Не удалось разобрать порядок точек из ответа (получено ${orderedIndexes.length} из ${points.length}) — см. rawResponse`,
          rawResponse: data,
        };
      }

      return {
        ok: true,
        orderedIndexes,
        totalDistanceM: route.metrics?.total_transit_distance_m,
      };
    } catch (e) {
      return { ok: false, error: `Ошибка при опросе результата: ${(e as Error).message}` };
    }
  }

  return { ok: false, error: "Не дождались ответа от Яндекс.Маршрутизации за 20 секунд" };
}
