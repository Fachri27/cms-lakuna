import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;

  // kalau tidak ada token, redirect ke login
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // hanya ADMIN dan CONTRIBUTOR yang boleh akses CMS
    if (payload.role !== "ADMIN" && payload.role !== "CONTRIBUTOR") {
      // hapus cookie langsung di response, lalu redirect
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("accessToken");
      return response;
    }
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("accessToken");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/((?!api|_next/static|_next/image|favicon.ico|login|payment).*)",
  ],
};
