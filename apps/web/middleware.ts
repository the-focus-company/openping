import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      "/",
      "/pricing",
      "/callback",
      "/sign-in",
      "/sign-out",
      "/api/webhooks(.*)",
      "/invite/(.*)",
      "/privacy",
      "/terms",
    ],
  },
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
