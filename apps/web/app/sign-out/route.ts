import { withAuth, getWorkOS } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieStore = await cookies();
  let sessionId: string | undefined;

  try {
    const auth = await withAuth();
    sessionId = auth.sessionId;
  } catch {
    // no active session
  }

  cookieStore.delete("wos-session");

  if (sessionId) {
    const workos = getWorkOS();
    const logoutUrl = workos.userManagement.getLogoutUrl({
      sessionId,
      returnTo: baseUrl,
    });
    return NextResponse.redirect(logoutUrl);
  }

  return NextResponse.redirect(new URL("/sign-in", baseUrl));
}
