export function validateInspectorReportInput(input: {
  comment?: unknown;
  photos?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  gpsAccuracy?: unknown;
  video?: unknown;
  videoDurationSeconds?: unknown;
}): string | null {
  if (typeof input.comment !== "string" || input.comment.trim().length < 3) return "Добавьте комментарий (минимум 3 символа)";
  if (input.comment.length > 3000) return "Комментарий слишком длинный (максимум 3000 символов)";
  const photos = input.photos === undefined || input.photos === null ? [] : input.photos;
  if (!Array.isArray(photos) || photos.length > 5) return "Можно приложить не более 5 фотографий";
  if (photos.some((p) => typeof p !== "string" || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(p))) {
    return "Одно из вложений не является поддерживаемой фотографией";
  }
  if (input.video !== undefined && input.video !== null) {
    if (!(input.video instanceof File)) return "Некорректный видеофайл";
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(input.video.type)) return "Поддерживаются видео MP4, WebM и MOV";
    if (input.video.size <= 0 || input.video.size > 50 * 1024 * 1024) return "Размер видео не должен превышать 50 МБ";
    const duration = Number(input.videoDurationSeconds);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 60) return "Продолжительность видео должна быть не более 60 секунд";
  }
  const hasLat = input.latitude !== undefined && input.latitude !== null;
  const hasLon = input.longitude !== undefined && input.longitude !== null;
  if (hasLat !== hasLon) return "Координаты должны содержать широту и долготу вместе";
  if (hasLat) {
    const lat = Number(input.latitude), lon = Number(input.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return "Некорректные GPS-координаты";
  }
  if (input.gpsAccuracy !== undefined && input.gpsAccuracy !== null) {
    const accuracy = Number(input.gpsAccuracy);
    if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000) return "Некорректная точность GPS";
  }
  return null;
}

