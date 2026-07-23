import { NextResponse, type NextRequest } from "next/server";

const REQUEST_ID = /^[a-zA-Z0-9_.:-]{8,128}$/;

export function middleware(request: NextRequest) {
  const incoming = request.headers.get("x-request-id");
  const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-correlation-id", request.headers.get("x-correlation-id") ?? requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Correlation-Id", requestHeaders.get("x-correlation-id") ?? requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
