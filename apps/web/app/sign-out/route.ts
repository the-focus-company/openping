import { withAuth, getWorkOS } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
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
      returnTo: "http://localhost:3000",
    });
    return NextResponse.redirect(logoutUrl);
  }

  return NextResponse.redirect(new URL("/sign-in", "http://localhost:3000"));
}
