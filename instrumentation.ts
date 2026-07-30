/**
 * Точка входа, которую Next.js выполняет один раз при старте сервера
 * (см. instrumentationHook в next.config.mjs).
 *
 * Здесь ставим глобальные страховочные обработчики. Без них одна
 * незахваченная ошибка в асинхронном коде (например, сбой сети при
 * фоновой отправке фото в Telegram, обрыв соединения клиентом и т.п.)
 * может в Node уронить весь процесс — Railway увидит падение и
 * перезапустит контейнер (SIGTERM / Stopping Container в логах).
 *
 * Мы такие ошибки логируем, но процесс не роняем: HTTP-запросы,
 * которые клиент оборвал (ECONNRESET/"aborted"), — это нормальная
 * ситуация в мобильном приложении, а не повод перезапускать сервер.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      console.error("[unhandledRejection]", reason);
    });
    process.on("uncaughtException", (err: Error & { code?: string }) => {
      // Обрыв соединения клиентом — ожидаемо, не логируем как критичное
      if (err?.code === "ECONNRESET" || err?.message === "aborted") {
        return;
      }
      console.error("[uncaughtException]", err);
    });
  }
}
