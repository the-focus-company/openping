import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { accessToken } = await withAuth({ ensureSignedIn: true });
    return NextResponse.json({ token: accessToken });
  } catch {
    return NextResponse.json({ token: null }, { status: 401 });
  }
}
