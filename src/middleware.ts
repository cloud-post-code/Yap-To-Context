import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  authSecretMissingWhenRequired,
  productionLikeDeployment,
} from "@/lib/deploy-env";
import {
  SESSION_COOKIE_NAME,
  verifySignedSessionValueEdge,
} from "@/lib/ingest-session-edge-verify";

function isPublicPath(pathname: string, method: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/api/auth/status") return true;
  if (pathname === "/api/auth/session" && method === "POST") return true;
  if (pathname === "/api/auth/logout" && method === "POST") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  if (!productionLikeDeployment()) {
    return NextResponse.next();
  }

  const ingestKey = process.env.INGEST_API_KEY?.trim();
  if (!ingestKey) {
    return NextResponse.next();
  }

  if (authSecretMissingWhenRequired()) {
    const msg =
      "Misconfigured: set AUTH_SECRET in Railway variables alongside INGEST_API_KEY.";
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    return new NextResponse(msg, {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const pathname = request.nextUrl.pathname;
  const method = request.method;

  if (isPublicPath(pathname, method)) {
    return NextResponse.next();
  }

  const signingSecret =
    process.env.AUTH_SECRET?.trim() || ingestKey;
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const ok =
    !!raw &&
    (await verifySignedSessionValueEdge(raw, ingestKey, signingSecret));

  if (ok) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
