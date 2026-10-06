import { type NextRequest, NextResponse } from "next/server";
import { uuidv7 } from "uuidv7";
import { generateCsp } from "@/lib/csp";

export { sanitizeCallbackUrl } from "@/lib/url";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/faculty",
  "/student",
  "/courses",
  "/settings",
];

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // 1. Delete inbound x-request-id and x-nonce to prevent client spoofing
  requestHeaders.delete("x-request-id");
  requestHeaders.delete("x-nonce");

  // 2. Set new request ID
  const requestId = uuidv7();
  requestHeaders.set("x-request-id", requestId);

  // 3. Generate nonce and CSP
  const { nonce, cspHeader } = generateCsp();
  requestHeaders.set("x-nonce", nonce);

  const pathname = request.nextUrl.pathname;

  // 4. Presence-only session-cookie check for protected paths (UX only, no DB access)
  const isProtectedPath = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  const hasSessionCookie =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Host-bqlms.session_token") ||
    request.cookies.has("bqlms.session_token");

  if (isProtectedPath && !hasSessionCookie) {
    const search = request.nextUrl.search;
    const fullRelativeUrl = pathname + search;
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", fullRelativeUrl);
    return NextResponse.redirect(signInUrl);
  }

  // 5. Build response with CSP & security headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("x-request-id", requestId);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export default proxy;
