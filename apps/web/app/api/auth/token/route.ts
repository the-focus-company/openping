import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";

const AUTH_DOMAIN = process.env.AUTH_DOMAIN ?? "http://localhost:3000";
const PRIVATE_KEY_B64 = process.env.AUTH_PRIVATE_KEY_B64 ?? "";

export async function GET() {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });

    const privateKeyPem = Buffer.from(PRIVATE_KEY_B64, "base64").toString("utf8");
    const privateKey = await importPKCS8(privateKeyPem, "RS256");

    const token = await new SignJWT({ sub: user.id })
      .setProtectedHeader({ alg: "RS256", kid: "convex-1" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .setIssuer(AUTH_DOMAIN)
      .setAudience("convex")
      .sign(privateKey);

    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ token: null }, { status: 401 });
  }
}
