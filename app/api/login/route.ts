import { NextRequest, NextResponse } from "next/server";
import { computeSessionToken, SESSION_COOKIE_NAME } from "@/lib/session-token";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const password = String(formData.get("password") || "");
  const expected = process.env.ADMIN_PASSWORD || "";

  const url = new URL(req.url);
  if (!expected) {
    return NextResponse.redirect(new URL("/login?error=notset", url), 303);
  }
  if (password !== expected) {
    return NextResponse.redirect(new URL("/login?error=wrong", url), 303);
  }

  const token = await computeSessionToken(expected);
  const res = NextResponse.redirect(new URL("/", url), 303);
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
