import { NextResponse } from "next/server";

export async function GET() {
  const raw = process.env.AUTH_PUBLIC_KEY_JWK;
  if (!raw) {
    return NextResponse.json(
      { error: "JWKS not configured" },
      { status: 500 },
    );
  }

  let jwk: Record<string, unknown>;
  try {
    jwk = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid JWKS configuration" },
      { status: 500 },
    );
  }

  if (!jwk.kty || !jwk.n || !jwk.e) {
    return NextResponse.json(
      { error: "Incomplete JWK - missing required fields" },
      { status: 500 },
    );
  }

  return NextResponse.json({ keys: [jwk] });
}
