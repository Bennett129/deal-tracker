import { NextResponse, type NextRequest } from "next/server";
import { consumeLoginToken } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const user = token ? await consumeLoginToken(token) : null;

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=expired", request.url));
  }

  const response = NextResponse.redirect(new URL("/wishlist", request.url));
  response.cookies.set(
    SESSION_COOKIE,
    await signSession({ userId: user.id, email: user.email }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    },
  );
  return response;
}
