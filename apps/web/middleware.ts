import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ["/login", "/api/webhooks(.*)"],
  },
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
