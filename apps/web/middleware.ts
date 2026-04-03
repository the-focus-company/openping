import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import { NextFetchEvent, NextRequest } from "next/server";

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "";
  const redirectUri = `${protocol}://${host}/callback`;

  return authkitMiddleware({
    redirectUri,
    middlewareAuth: {
      enabled: true,
      unauthenticatedPaths: [
        "/",
        "/manifesto",
        "/deck",
        "/pricing",
        "/privacy",
        "/terms",
        "/callback",
        "/sign-in",
        "/sign-out",
        "/api/webhooks(.*)",
        "/api/health",
        "/invite/(.*)",
        "/privacy",
        "/terms",
      ],
    },
  })(request, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.webp|.*\\.gif).*)"],
};
