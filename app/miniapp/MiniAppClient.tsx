"use client";

import { useEffect, useState } from "react";

interface AtmItem {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  doneToday?: boolean;
}

interface StatusOption {
  id: string;
  name: string;
}

// Telegram WebApp API прокидывается в window при открытии внутри Telegram
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        MainButton?: unknown;
      };
    };
  }
}

export function MiniAppClient() {
  const [initData, setInitData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeRole, setEmployeeRole] = useState("");
  const [machineNumber, setMachineNumber] = useState<string | null>(null);
  const [scheduleFound, setScheduleFound] = useState(false);
  const [atms, setAtms] = useState<AtmItem[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [selectedAtm, setSelectedAtm] = useState<AtmItem | null>(null);
  const [showDriver, setShowDriver] = useState(false);
  const [showNoId, setShowNoId] = useState(false);
  const [showAtmIssue, setShowAtmIssue] = useState(false);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setInitData(tg.initData);
    } else {
      setError("Откройте это приложение внутри Telegram (через кнопку у бота).");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initData) return;
    fetch("/api/miniapp/my-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error || "Ошибка загрузки маршрута");
        } else {
          setEmployeeName(data.employeeName);
          setEmployeeRole(data.employeeRole || "");
          setMachineNumber(data.machineNumber);
          setScheduleFound(data.scheduleFound);
          setAtms(data.atms);
          setDoneIds(new Set<string>(data.atms.filter((a: AtmItem) => a.doneToday).map((a: AtmItem) => a.id)));
          setStatuses(data.statuses || []);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Не удалось связаться с сервером");
        setLoading(false);
      });
  }, [initData]);

  if (loading) return <div className="p-6 text-center text-sm">Загрузка…</div>;
  if (error)
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 text-[13px] rounded-lg p-3">{error}</div>
      </div>
    );

  if (showDriver) {
    return <DriverScreen initData={initData!} onBack={() => setShowDriver(false)} />;
  }

  if (showNoId) {
    return <NoIdScreen initData={initData!} onBack={() => setShowNoId(false)} />;
  }

  if (showAtmIssue) {
    return <AtmIssueScreen initData={initData!} onBack={() => setShowAtmIssue(false)} />;
  }

  if (selectedAtm) {
    return (
      <ReportScreen
        atm={selectedAtm}
        statuses={statuses}
        initData={initData!}
        onBack={() => setSelectedAtm(null)}
        onDone={() => {
          setDoneIds((prev) => new Set(prev).add(selectedAtm.id));
          setSelectedAtm(null);
        }}
      />
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="mb-4">
        <h1 className="text-base font-semibold">Здравствуйте, {employeeName}</h1>
        <p className="text-[13px] text-gray-500">
          {machineNumber ? `Машина ${machineNumber}` : "Машина не назначена"} ·{" "}
          {new Date().toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" })}
        </p>
      </div>

      {!scheduleFound ? (
        <div className="bg-amber-50 text-amber-800 text-[13px] rounded-lg p-3 mb-4">
          На сегодня маршрут не назначен. Введите ID банкомата ниже — он будет оформлен как вне очереди.
        </div>
      ) : (
        <p className="text-[13px] text-gray-600 mb-3">
          Выполнено {doneIds.size} из {atms.length}
        </p>
      )}

      <IdEntryScreen
        atmsInRoute={atms}
        doneIds={doneIds}
        initData={initData!}
        onOpen={(atm) => setSelectedAtm(atm)}
      />

      {/* Список маршрута — БЕЗ ID (чтобы не потерять антифрод), но адрес и
          статус видны для ориентира: сколько осталось и где примерно. */}
      {atms.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {atms.map((atm) => {
            const done = doneIds.has(atm.id);
            return (
              <div
                key={atm.id}
                className={`border rounded-lg p-2.5 text-[12px] ${
                  done ? "bg-green-50 border-green-200 text-green-700" : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{atm.name}</span>
                  {done && <span className="font-semibold">✓</span>}
                </div>
                <div className="text-gray-400 text-[11px]">{atm.address}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Внеочередная очистка вручную — банкомат не нужно искать по ID,
          просто ввести код и оформить (используется, когда по какой-то
          причине банкомата нет ни в маршруте, ни в базе, либо сотрудник
          хочет оформить без предварительного поиска). */}
      {/* Единая форма проблемного/нештатного банкомата — объединяет то,
          что раньше было двумя разными кнопками. Доступна прямо с
          главного экрана, без предварительного отчёта об очистке (по
          явному запросу руководителя: не заставлять сотрудника сначала
          "оформить очистку", чтобы просто сообщить о проблеме). */}
      <button
        onClick={() => setShowAtmIssue(true)}
        className="mt-3 w-full border-2 border-amber-300 bg-amber-50 rounded-xl p-3 text-[13px] font-medium text-amber-800"
      >
        ⚠️ Банкомат с проблемой
      </button>

      {/* "Вне маршрута" уже обрабатывается автоматически полем ID выше —
          если введённый ID найден в базе и в том же районе, карточка
          откроется сама. Кнопка ниже — для банкоматов, которых нет в
          базе вообще (совсем новых/неизвестных системе). */}
      <button
        onClick={() =>
          setSelectedAtm({ id: "", code: "", name: "Новый банкомат", address: "", latitude: "", longitude: "" })
        }
        className="mt-3 w-full border-2 border-dashed border-gray-300 rounded-xl p-3 text-[13px] text-gray-500"
      >
        + Новый банкомат (нет в базе)
      </button>

      {machineNumber && (!employeeRole || employeeRole === "Водитель") && (
        <button
          onClick={() => setShowDriver(true)}
          className="mt-3 w-full border border-gray-300 rounded-xl p-3 text-[13px] font-medium bg-white flex items-center justify-center gap-2"
        >
          🚗 Одометр и топливо
        </button>
      )}
    </div>
  );
}

/**
 * Экран ввода ID банкомата (заменяет выбор из списка — п.1/п.2 ТЗ).
 * Сотрудник физически подходит к банкомату, читает ID на корпусе и
 * вводит его. Это сохраняет смысл антифрода: ID нельзя узнать заранее.
 *
 * Логика поиска:
 *  1. ID есть среди сегодняшнего маршрута → сразу открыть карточку.
 *  2. ID не найден в маршруте → искать по всей базе через сервер.
 *     - Найден и в ТЕКУЩЕМ районе маршрута → предложить оформить как
 *       "вне маршрута" (это разрешённый сценарий: сотрудники убирают
 *       банкоматы вне порядка).
 *     - Найден, но в ДРУГОМ районе → показать ошибку, не открывать.
 *     - Не найден вообще → показать ошибку "банкомат не найден".
 */
function IdEntryScreen({
  atmsInRoute,
  doneIds,
  initData,
  onOpen,
}: {
  atmsInRoute: AtmItem[];
  doneIds: Set<string>;
  initData: string;
  onOpen: (atm: AtmItem) => void;
}) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmitCode() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);

    // Шаг 1: ID есть в сегодняшнем маршруте — открываем карточку сразу,
    // без обращения к серверу (маршрут уже загружен).
    const inRoute = atmsInRoute.find((a) => a.code && a.code.trim() === trimmed);
    if (inRoute) {
      onOpen(inRoute);
      setCode("");
      return;
    }

    // Шаг 2: не найден в маршруте — ищем по всей базе на сервере, чтобы
    // узнать район и решить "вне маршрута" или "чужой район — отказ".
    setChecking(true);
    try {
      const res = await fetch("/api/miniapp/lookup-atm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, code: trimmed }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Банкомат с таким ID не найден в базе.");
        return;
      }
      if (data.sameDistrict) {
        // Тот же район, что у сегодняшнего маршрута — разрешаем как "вне маршрута"
        onOpen({
          id: data.atm.id,
          code: data.atm.code,
          name: data.atm.name + " (вне маршрута)",
          address: data.atm.address,
          latitude: data.atm.latitude,
          longitude: data.atm.longitude,
        });
        setCode("");
      } else {
        setError(
          `Банкомат найден, но в районе «${data.atm.district}» — это не входит в ваш сегодняшний маршрут. Оформление запрещено.`
        );
      }
    } catch {
      setError("Не удалось проверить ID. Проверьте связь.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <label className="block text-[12px] font-semibold text-gray-500 mb-1">
        Введите ID банкомата (с корпуса устройства)
      </label>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmitCode()}
          placeholder="Например: 37188"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          inputMode="numeric"
        />
        <button
          onClick={handleSubmitCode}
          disabled={!code.trim() || checking}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {checking ? "…" : "Открыть"}
        </button>
      </div>
      {error && <div className="mt-2 text-[12px] text-red-600">{error}</div>}
      <p className="mt-3 text-[11px] text-gray-400">
        Список банкоматов маршрута намеренно скрыт — ID нужно прочитать на месте, это часть проверки
        присутствия. Выполнено сегодня: {doneIds.size} из {atmsInRoute.length}.
      </p>
    </div>
  );
}

function ReportScreen({
  atm,
  statuses,
  initData,
  onBack,
  onDone,
}: {
  atm: AtmItem;
  statuses: StatusOption[];
  initData: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const MIN_PHOTOS = 5;
  const [enteredCode, setEnteredCode] = useState(atm.code || "");
  const [workStatusId, setWorkStatusId] = useState("");
  const [addressCorrect, setAddressCorrect] = useState<boolean | null>(null);
  const [coordsCorrect, setCoordsCorrect] = useState<boolean | null>(null);
  const [locationComment, setLocationComment] = useState("");
  const [gps, setGps] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const isAdHoc = atm.id === "";
  const needsLocationComment = addressCorrect === false || coordsCorrect === false;

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("Геолокация недоступна на устройстве");
      return;
    }
    // Первая координата от телефона часто грубая (по вышкам/Wi-Fi,
    // точность может быть 1–30 км — отсюда бывали "3000–35000 метров"
    // в антифроде). Берём несколько попыток и оставляем самую точную
    // (наименьший coords.accuracy в метрах), не блокируя интерфейс.
    let best: GeolocationPosition | null = null;
    let attempts = 0;
    const tryOnce = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!best || pos.coords.accuracy < best.coords.accuracy) {
            best = pos;
            setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
          }
          attempts += 1;
          // Останавливаемся, как только точность достаточная (<=50м) или
          // после 3 попыток — не заставляем ждать бесконечно.
          if (pos.coords.accuracy > 50 && attempts < 3) {
            setTimeout(tryOnce, 1500);
          }
        },
        () => setGpsError("Не удалось получить GPS. Разрешите доступ к геолокации."),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };
    tryOnce();
  }, []);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setPhotos((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/miniapp/submit-cleaning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          atmId: atm.id || undefined,
          atmCode: enteredCode,
          enteredCode,
          photoData: photos[0],
          photos,
          gpsLat: gps?.lat,
          gpsLon: gps?.lon,
          gpsAccuracy: gps?.accuracy,
          photoFromCamera: true, // input с capture — фото с камеры
          clientTime: new Date().toISOString(),
          workStatusId,
          addressCorrect,
          coordsCorrect,
          locationComment,
          isNewAtmReport: atm.name === "Новый банкомат",
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setResult(data.error || "Ошибка отправки");
      } else {
        setResult(
          data.codeMismatch
            ? `${data.message} (внимание: введённый ID не совпал с ожидаемым — руководитель уведомлён)`
            : data.message
        );
        setTimeout(onDone, 1800);
      }
    } catch {
      setResult("Не удалось отправить. Проверьте связь.");
    }
    setSubmitting(false);
  }

  const canSubmit =
    gps &&
    enteredCode.trim() &&
    workStatusId &&
    addressCorrect !== null &&
    coordsCorrect !== null &&
    (!needsLocationComment || locationComment.trim()) &&
    !submitting;

  return (
    <div className="p-4 max-w-md mx-auto">
      <button onClick={onBack} className="text-sm text-blue-600 mb-3">
        ← Назад
      </button>
      <h2 className="text-[15px] font-semibold mb-1">{atm.name}</h2>
      {!isAdHoc && <p className="text-[11px] text-gray-400 mb-3">{atm.address}</p>}

      {/* Отдельная кнопка "Сообщить о проблеме" отсюда убрана — теперь
          для этого есть единая форма "⚠️ Банкомат с проблемой" на
          главном экране (AtmIssueScreen), доступная без необходимости
          сначала искать банкомат через отчёт об очистке. Раньше здесь
          дублировался старый механизм (роут /api/miniapp/problem-report),
          что и создавало путаницу с двумя разными формами. */}

      {/* ID уже известен и подтверждён на предыдущем экране (введён вручную
          при поиске) — повторно вводить не нужно. Поле для ручного ввода
          показываем только в настоящем ad-hoc случае, когда банкомат не
          был найден через поиск заранее. */}
      {isAdHoc ? (
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
            Введите ID банкомата (считайте с устройства)
          </label>
          <input
            value={enteredCode}
            onChange={(e) => setEnteredCode(e.target.value)}
            placeholder="Например, 00123"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] font-mono"
          />
        </div>
      ) : (
        <div className="mb-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-[12px] text-green-700">
          ID подтверждён: <b className="font-mono">{enteredCode}</b>
        </div>
      )}

      <div className="mb-3">
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Статус работы банкомата на месте</label>
        <select
          value={workStatusId}
          onChange={(e) => setWorkStatusId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] bg-white"
        >
          <option value="">— выберите —</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <YesNoField label="Адрес верный?" value={addressCorrect} onChange={setAddressCorrect} />
        <YesNoField label="Координаты верные?" value={coordsCorrect} onChange={setCoordsCorrect} />
      </div>

      {needsLocationComment && (
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
            Что не так с адресом/координатами?
          </label>
          <textarea
            value={locationComment}
            onChange={(e) => setLocationComment(e.target.value)}
            placeholder="Опишите, что нужно исправить"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px]"
            rows={2}
          />
        </div>
      )}

      {/* Фото ТОЛЬКО с камеры: минимум MIN_PHOTOS снимков */}
      <div className="mb-3">
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
          Фото банкомата (камера) — по желанию, до {MIN_PHOTOS}. Добавлено: {photos.length}
        </label>
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-2">
            {photos.map((p, idx) => (
              <div key={idx} className="relative">
                <img src={p} alt={`фото ${idx + 1}`} className="w-full h-20 object-cover rounded-lg" />
                <button
                  onClick={() => removePhoto(idx)}
                  className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <label
          className="block w-full border-2 border-dashed rounded-lg p-4 text-center text-[13px] cursor-pointer border-gray-300 text-gray-500"
        >
          📷 {photos.length === 0 ? "Сделать фото (по желанию)" : photos.length >= MIN_PHOTOS ? "Добавлено достаточно" : "Добавить ещё"}
          {photos.length > 0 && photos.length < MIN_PHOTOS ? ` (можно до ${MIN_PHOTOS})` : ""}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handlePhoto}
            className="hidden"
            disabled={photos.length >= MIN_PHOTOS}
          />
        </label>
      </div>

      <div className="mb-4 text-xs">
        {gps ? (
          <span className={gps.accuracy <= 50 ? "text-green-600" : "text-amber-600"}>
            GPS получен ✓ (точность {gps.accuracy} м{gps.accuracy > 50 ? " — сигнал слабый, но можно отправлять" : ""})
          </span>
        ) : gpsError ? (
          <span className="text-red-600">{gpsError}</span>
        ) : (
          <span className="text-gray-400">Уточняем координаты…</span>
        )}
      </div>

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full bg-blue-600 text-white rounded-lg py-3 text-[13px] font-semibold disabled:opacity-40"
      >
        {submitting ? "Отправка…" : "Отправить отчёт"}
      </button>

      {result && (
        <div className="mt-3 bg-gray-50 text-sm rounded-lg p-3 text-center">{result}</div>
      )}
    </div>
  );
}

function DriverScreen({ initData, onBack }: { initData: string; onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [machineNumber, setMachineNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [odometerStart, setOdometerStart] = useState("");
  const [odometerEnd, setOdometerEnd] = useState("");
  const [fuelLiters, setFuelLiters] = useState("");
  const [fuelCost, setFuelCost] = useState("");
  const [comment, setComment] = useState("");
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [savingStart, setSavingStart] = useState(false);
  const [savingEnd, setSavingEnd] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [odometerStartPhoto, setOdometerStartPhoto] = useState<string | null>(null);
  const [odometerEndPhoto, setOdometerEndPhoto] = useState<string | null>(null);
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [odometerStartPhotoUrl, setOdometerStartPhotoUrl] = useState<string | null>(null);
  const [odometerEndPhotoUrl, setOdometerEndPhotoUrl] = useState<string | null>(null);
  const [receiptPhotoUrl, setReceiptPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/miniapp/driver-log", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then(async (r) => {
        // Если сервер вернул не-JSON (например, HTML страницы ошибки 500),
        // r.json() бросил бы исключение и показал бы невнятное "не удалось
        // связаться". Читаем как текст и пытаемся разобрать, а при неудаче
        // показываем понятную причину со статусом.
        const raw = await r.text();
        let data: {
          ok?: boolean;
          error?: string;
          machineNumber?: string;
          log?: {
            odometerStart?: number | string | null;
            odometerEnd?: number | string | null;
            fuelLiters?: number | string | null;
            fuelCost?: number | string | null;
            comment?: string | null;
            distanceKm?: number | null;
            odometerStartPhotoUrl?: string | null;
            odometerEndPhotoUrl?: string | null;
            receiptPhotoUrl?: string | null;
          } | null;
        } | null = null;
        try {
          data = JSON.parse(raw);
        } catch {
          setError(`Сервер ответил ошибкой (${r.status}). Попробуйте позже.`);
          setLoading(false);
          return;
        }
        if (!data || !data.ok) {
          setError(data?.error || "Ошибка загрузки");
        } else {
          setMachineNumber(data.machineNumber || "");
          if (data.log) {
            setOdometerStart(data.log.odometerStart != null ? String(data.log.odometerStart) : "");
            setOdometerEnd(data.log.odometerEnd != null ? String(data.log.odometerEnd) : "");
            setFuelLiters(data.log.fuelLiters != null ? String(data.log.fuelLiters) : "");
            setFuelCost(data.log.fuelCost != null ? String(data.log.fuelCost) : "");
            setComment(data.log.comment ?? "");
            setDistanceKm(data.log.distanceKm ?? null);
            setOdometerStartPhotoUrl(data.log.odometerStartPhotoUrl || null);
            setOdometerEndPhotoUrl(data.log.odometerEndPhotoUrl || null);
            setReceiptPhotoUrl(data.log.receiptPhotoUrl || null);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Не удалось связаться с сервером");
        setLoading(false);
      });
  }, [initData]);

  async function save(patch: Record<string, string>, isStart: boolean) {
    isStart ? setSavingStart(true) : setSavingEnd(true);
    setResult(null);
    try {
      const res = await fetch("/api/miniapp/driver-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, ...patch }),
      });
      const data = await res.json();
      if (!data.ok) {
        setResult(data.error || "Ошибка сохранения");
      } else {
        setResult(data.message);
        setDistanceKm(data.log.distanceKm ?? null);
        setOdometerStartPhotoUrl(data.log.odometerStartPhotoUrl || null);
        setOdometerEndPhotoUrl(data.log.odometerEndPhotoUrl || null);
        setReceiptPhotoUrl(data.log.receiptPhotoUrl || null);
      }
    } catch {
      setResult("Не удалось сохранить. Проверьте связь.");
    }
    isStart ? setSavingStart(false) : setSavingEnd(false);
  }

  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  }

  if (loading) return <div className="p-6 text-center text-sm">Загрузка…</div>;

  return (
    <div className="p-4 max-w-md mx-auto">
      <button onClick={onBack} className="text-sm text-blue-600 mb-3">
        ← Назад
      </button>
      <h2 className="text-[15px] font-semibold mb-1">Одометр и топливо</h2>
      <p className="text-xs text-gray-500 mb-4">
        {machineNumber ? `Машина ${machineNumber}` : ""} · {new Date().toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" })}
      </p>

      {error && <div className="bg-red-50 text-red-700 text-[13px] rounded-lg p-3 mb-4">{error}</div>}

      <div className="mb-5 bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-[13px] font-medium mb-2">Начало дня</div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Одометр, км</label>
        <input
          type="number"
          inputMode="numeric"
          value={odometerStart}
          onChange={(e) => setOdometerStart(e.target.value)}
          placeholder="Например, 45210"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] mb-2"
        />
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Фото одометра (необязательно)</label>
        {odometerStartPhoto || odometerStartPhotoUrl ? (
          <div className="mb-2">
            <img src={odometerStartPhoto || odometerStartPhotoUrl || ""} alt="одометр" className="w-full rounded-lg mb-1" />
            <button onClick={() => setOdometerStartPhoto(null)} className="text-xs text-red-600">
              Переснять
            </button>
          </div>
        ) : (
          <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-center text-xs text-gray-500 mb-2">
            📷 Сфотографировать одометр
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoFile(e, setOdometerStartPhoto)}
              className="hidden"
            />
          </label>
        )}
        <button
          onClick={() => save({ odometerStart, ...(odometerStartPhoto ? { odometerStartPhoto } : {}) }, true)}
          disabled={!odometerStart || savingStart}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-[13px] font-semibold disabled:opacity-40"
        >
          {savingStart ? "Сохранение…" : "Сохранить начало дня"}
        </button>
      </div>

      <div className="mb-4 bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-[13px] font-medium mb-2">Конец дня</div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Одометр, км</label>
        <input
          type="number"
          inputMode="numeric"
          value={odometerEnd}
          onChange={(e) => setOdometerEnd(e.target.value)}
          placeholder="Например, 45340"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] mb-2"
        />
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Топливо, литры</label>
        <input
          type="number"
          inputMode="decimal"
          value={fuelLiters}
          onChange={(e) => setFuelLiters(e.target.value)}
          placeholder="Например, 25"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] mb-2"
        />
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Топливо, сумма</label>
        <input
          type="number"
          inputMode="decimal"
          value={fuelCost}
          onChange={(e) => setFuelCost(e.target.value)}
          placeholder="Например, 350000"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] mb-2"
        />
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Комментарий (необязательно)</label>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Например, заправка на АЗС №3"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] mb-2"
        />
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Фото одометра (необязательно)</label>
        {odometerEndPhoto || odometerEndPhotoUrl ? (
          <div className="mb-2">
            <img src={odometerEndPhoto || odometerEndPhotoUrl || ""} alt="одометр" className="w-full rounded-lg mb-1" />
            <button onClick={() => setOdometerEndPhoto(null)} className="text-xs text-red-600">
              Переснять
            </button>
          </div>
        ) : (
          <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-center text-xs text-gray-500 mb-2">
            📷 Сфотографировать одометр
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoFile(e, setOdometerEndPhoto)}
              className="hidden"
            />
          </label>
        )}
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Фото чека за топливо (необязательно)</label>
        {receiptPhoto || receiptPhotoUrl ? (
          <div className="mb-2">
            <img src={receiptPhoto || receiptPhotoUrl || ""} alt="чек" className="w-full rounded-lg mb-1" />
            <button onClick={() => setReceiptPhoto(null)} className="text-xs text-red-600">
              Переснять
            </button>
          </div>
        ) : (
          <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-center text-xs text-gray-500 mb-2">
            📷 Сфотографировать чек
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoFile(e, setReceiptPhoto)}
              className="hidden"
            />
          </label>
        )}
        <button
          onClick={() =>
            save(
              {
                odometerEnd,
                fuelLiters,
                fuelCost,
                comment,
                ...(odometerEndPhoto ? { odometerEndPhoto } : {}),
                ...(receiptPhoto ? { receiptPhoto } : {}),
              },
              false
            )
          }
          disabled={!odometerEnd || savingEnd}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-[13px] font-semibold disabled:opacity-40"
        >
          {savingEnd ? "Сохранение…" : "Сохранить конец дня"}
        </button>
      </div>

      {distanceKm !== null && (
        <div className="bg-gray-50 text-sm rounded-lg p-3 text-center mb-3">Пробег за день: {distanceKm} км</div>
      )}

      {result && <div className="mt-3 bg-gray-50 text-sm rounded-lg p-3 text-center">{result}</div>}
    </div>
  );
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 mb-1">{label}</label>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 text-xs font-semibold rounded-lg py-2 border ${
            value === true ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-300"
          }`}
        >
          Да
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 text-xs font-semibold rounded-lg py-2 border ${
            value === false ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-300"
          }`}
        >
          Нет
        </button>
      </div>
    </div>
  );
}

/** Экран "Банкомат без ID / не работает / нет чека" (п.3 ТЗ). */
function NoIdScreen({ initData, onBack }: { initData: string; onBack: () => void }) {
  const [noSticker, setNoSticker] = useState(false);
  const [notWorking, setNotWorking] = useState(false);
  const [cantGetReceipt, setCantGetReceipt] = useState(false);
  const [gotReceipt, setGotReceipt] = useState(false);
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setPhotos((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  const canSubmit = (noSticker || notWorking || cantGetReceipt || gotReceipt) && !submitting;

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/miniapp/no-id-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          address,
          latitude: gps?.lat,
          longitude: gps?.lon,
          noSticker,
          notWorking,
          cantGetReceipt,
          gotReceipt,
          comment,
          photos,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setResult(data.error || "Ошибка отправки");
      } else {
        setResult("Отчёт сохранён ✓");
        setTimeout(onBack, 1200);
      }
    } catch {
      setResult("Не удалось отправить. Проверьте связь.");
    }
    setSubmitting(false);
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <button onClick={onBack} className="text-sm text-gray-500 mb-3">← Назад</button>
      <h1 className="text-base font-semibold mb-3">Нештатная ситуация</h1>

      <p className="text-[12px] text-gray-500 mb-3">
        Отметьте, что именно произошло на месте. Можно выбрать несколько пунктов, если применимо
        (например: нет наклейки + не удалось получить чек).
      </p>
      <div className="flex flex-col gap-2 mb-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={noSticker} onChange={(e) => setNoSticker(e.target.checked)} />
          <span>Нет наклейки с ID <span className="text-gray-400">— на корпусе нет номера, ввести ID невозможно</span></span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notWorking} onChange={(e) => setNotWorking(e.target.checked)} />
          <span>Банкомат не работает <span className="text-gray-400">— выключен, экран пуст, нет питания</span></span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cantGetReceipt} onChange={(e) => setCantGetReceipt(e.target.checked)} />
          <span>Не удалось получить чек <span className="text-gray-400">— банкомат работает, но чек не печатает</span></span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={gotReceipt} onChange={(e) => setGotReceipt(e.target.checked)} />
          <span>Чек получен <span className="text-gray-400">— для подтверждения, если требуется отдельно</span></span>
        </label>
      </div>
      {(noSticker || notWorking) && !comment.trim() && (
        <p className="text-[11px] text-amber-600 mb-2">
          Опишите ситуацию в комментарии ниже — это поможет руководителю быстрее разобраться.
        </p>
      )}

      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Адрес / ориентир"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
      />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Комментарий"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
      />

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {photos.map((p, idx) => (
            <img key={idx} src={p} alt="" className="w-full h-20 object-cover rounded-lg" />
          ))}
        </div>
      )}
      <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-center text-sm mb-3 cursor-pointer">
        📷 Добавить фото
        <input type="file" accept="image/*" capture="environment" multiple onChange={handlePhoto} className="hidden" />
      </label>

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
      >
        {submitting ? "Отправка…" : "Отправить отчёт"}
      </button>
      {result && <div className="mt-3 bg-gray-50 text-sm rounded-lg p-3 text-center">{result}</div>}
    </div>
  );
}

const ATM_ISSUE_REASONS = [
  "Не работает",
  "Нет наклейки с ID",
  "Не удалось получить чек",
  "Чек получен",
  "Сломана дверь",
  "Оборван кабель",
  "Неправильный адрес",
  "Неправильные координаты",
  "Неправильный район",
  "Другое",
];

/**
 * Единая форма "Банкомат с проблемой" — объединяет прежние раздельные
 * формы "Проблемный банкомат" и "Нет наклейки/не работает/нет чека".
 * ID банкомата НЕобязателен — можно оформить заявку и без него (если
 * наклейки совсем нет). Доступна с главного экрана без предварительного
 * отчёта об очистке.
 */
function AtmIssueScreen({ initData, onBack }: { initData: string; onBack: () => void }) {
  const [atmCode, setAtmCode] = useState("");
  const [address, setAddress] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);
  const [correctDistrict, setCorrectDistrict] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Список районов подгружаем только когда реально нужен — не тратим
  // запрос впустую, если сотрудник не выбрал причину "Неправильный район".
  useEffect(() => {
    if (!reasons.includes("Неправильный район") || districts.length > 0) return;
    fetch("/api/miniapp/districts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setDistricts(data.districts);
      })
      .catch(() => {});
  }, [reasons, districts.length, initData]);

  function toggleReason(r: string) {
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setPhotos((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  const canSubmit = reasons.length > 0 && !submitting;

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/miniapp/atm-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          atmCode,
          address,
          latitude: gps?.lat,
          longitude: gps?.lon,
          reasons,
          otherText,
          comment,
          photos,
          correctDistrict,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setResult(data.error || "Ошибка отправки");
      } else {
        setResult(data.message || "Заявка отправлена ✓");
        setTimeout(onBack, 1400);
      }
    } catch {
      setResult("Не удалось отправить. Проверьте связь.");
    }
    setSubmitting(false);
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <button onClick={onBack} className="text-sm text-gray-500 mb-3">
        ← Назад
      </button>
      <h1 className="text-base font-semibold mb-1">Банкомат с проблемой</h1>
      <p className="text-[12px] text-gray-500 mb-3">
        ID банкомата вводить необязательно — если наклейки нет совсем, просто укажите адрес.
      </p>

      <input
        value={atmCode}
        onChange={(e) => setAtmCode(e.target.value)}
        placeholder="ID банкомата (если есть)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
      />
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Адрес / ориентир (если ID нет)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
      />

      <label className="block text-[12px] font-semibold text-gray-500 mb-1">Причина (можно несколько)</label>
      <div className="flex flex-col gap-1.5 mb-3">
        {ATM_ISSUE_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reasons.includes(r)} onChange={() => toggleReason(r)} />
            {r}
          </label>
        ))}
      </div>

      {reasons.includes("Другое") && (
        <input
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          placeholder="Опишите, что случилось"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
        />
      )}

      {reasons.includes("Неправильный район") && (
        <div className="mb-3">
          <label className="block text-[12px] font-semibold text-gray-500 mb-1">
            Какой район на самом деле?
          </label>
          <select
            value={correctDistrict}
            onChange={(e) => setCorrectDistrict(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">— выберите район —</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Комментарий (необязательно)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
      />

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {photos.map((p, idx) => (
            <img key={idx} src={p} alt="" className="w-full h-20 object-cover rounded-lg" />
          ))}
        </div>
      )}
      <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-center text-sm mb-3 cursor-pointer">
        📷 Добавить фото (по желанию)
        <input type="file" accept="image/*" capture="environment" multiple onChange={handlePhoto} className="hidden" />
      </label>

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full bg-amber-600 text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
      >
        {submitting ? "Отправка…" : "Отправить"}
      </button>
      {result && <div className="mt-3 bg-gray-50 text-sm rounded-lg p-3 text-center">{result}</div>}
    </div>
  );
}
