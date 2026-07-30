import { NextRequest, NextResponse } from "next/server";
import { computeSessionToken, SESSION_COOKIE_NAME } from "@/lib/session-token";

/**
 * Простой пароль на вход в веб-интерфейс руководителя. НЕ трогает:
 * /login (иначе бесконечный редирект), /api/miniapp/* (у Mini App свой
 * механизм через подпись Telegram initData — сотрудникам пароль не
 * нужен), /api/telegram/webhook (должен быть публично доступен для
 * самого Telegram), /api/photos/* (используется как <img src>,
 * редирект на /login там просто сломает картинку, а не покажет форму
 * входа — риск утечки одной фотографии по прямой ссылке существует, но
 * несравним по серьёзности с доступом к данным всех банкоматов).
 *
 * Если ADMIN_PASSWORD не задан в окружении — middleware НЕ блокирует
 * доступ (пропускает всех) вместо того, чтобы запереть систему без
 * возможности войти. Это осознанный компромисс: молча не работающая
 * защита лучше, чем случайно заблокированный доступ ко всей системе на
 * проде без объяснения причины.
 */
export async function middleware(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const expectedToken = await computeSessionToken(expected);
  if (cookie === expectedToken) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!login|miniapp|api/miniapp|api/login|api/logout|api/telegram|api/photos|_next/static|_next/image|favicon.ico).*)",
  ],
};
