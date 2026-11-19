export type AtmHistoryStatus = "pending" | "applied" | "rejected";

export interface AtmHistorySignal {
  id: string;
  changeType: string;
  status: AtmHistoryStatus;
  employeeName: string;
  reportDate: string;
  comment?: string;
  oldDistrict?: string;
  newDistrict?: string;
  oldLat?: string;
  oldLon?: string;
  newLat?: string;
  newLon?: string;
  newCode?: string;
}

const TYPE_LABELS: Record<string, string> = {
  location: "Уточнение адреса или координат",
  district: "Изменение района",
  new_atm: "Сообщение о новом банкомате",
  id_change: "Предложение сменить ID",
};

export function atmChangeTypeLabel(type: string): string {
  return TYPE_LABELS[type] || "Изменение данных";
}

export function atmChangeStatusLabel(status: string): string {
  if (status === "applied") return "Применено";
  if (status === "rejected") return "Отклонено";
  return "Ожидает проверки";
}

export function atmChangeSummary(signal: AtmHistorySignal): string {
  if (signal.changeType === "district") return `Район: ${signal.oldDistrict || "не указан"} → ${signal.newDistrict || "не указан"}`;
  if (signal.changeType === "location") return `Координаты: ${signal.oldLat || "—"}, ${signal.oldLon || "—"} → ${signal.newLat || "—"}, ${signal.newLon || "—"}`;
  if (signal.changeType === "id_change") return `Новый ID: ${signal.newCode || "не указан"}`;
  if (signal.changeType === "new_atm") return `Предложены координаты: ${signal.newLat || "—"}, ${signal.newLon || "—"}`;
  return "Получен сигнал об изменении данных";
}
