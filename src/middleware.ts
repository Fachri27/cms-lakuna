import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.role === "ADMIN") {
        return NextResponse.next();
      }
      if (payload.role === "CONTRIBUTOR" && pathname.startsWith("/dashboard/contributor")) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/login", request.url));
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
