import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { accessToken } = await withAuth({ ensureSignedIn: true });
    console.log("[auth/token] OK — token issued");
    return NextResponse.json({ token: accessToken });
  } catch (err) {
    console.error("[auth/token] FAILED —", err instanceof Error ? err.message : err);
    return NextResponse.json({ token: null }, { status: 401 });
  }
}
