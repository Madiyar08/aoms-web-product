export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorText =
    searchParams.error === "notset"
      ? "Пароль не настроен в системе (переменная ADMIN_PASSWORD не задана в Railway) — обратитесь к тому, кто разворачивал систему."
      : searchParams.error === "wrong"
      ? "Неверный пароль"
      : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form
        action="/api/login"
        method="POST"
        className="bg-white border border-line rounded-[10px] p-6 w-full max-w-sm shadow-sm"
      >
        <h1 className="font-display text-xl font-medium text-ink mb-1">AOMS — вход</h1>
        <p className="text-[12.5px] text-neutral-500 mb-4">
          Веб-интерфейс для руководителя. Сотрудники работают через Telegram Mini App — им этот вход не нужен.
        </p>
        <input
          type="password"
          name="password"
          placeholder="Пароль"
          autoFocus
          className="input w-full mb-3"
        />
        {errorText && (
          <p className="text-[12px] text-st-red bg-st-red-bg rounded-lg p-2 mb-3">{errorText}</p>
        )}
        <button className="w-full bg-ink text-white rounded-md py-2 text-sm font-semibold">
          Войти
        </button>
      </form>
    </div>
  );
}
