import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional access gate for hosted deployments. Set TRADER_MIRROR_ACCESS_CODE
 * to require a passcode; without it the app is open (localhost use).
 */
export function middleware(req: NextRequest) {
  const code = process.env.TRADER_MIRROR_ACCESS_CODE;
  if (!code) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/unlock") || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  const cookie = req.cookies.get("tm_access")?.value;
  if (cookie === code) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
