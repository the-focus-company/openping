import { NextResponse } from "next/server";

const PUBLIC_KEY_JWK = JSON.parse(process.env.AUTH_PUBLIC_KEY_JWK ?? "{}");

export async function GET() {
  return NextResponse.json({ keys: [PUBLIC_KEY_JWK] });
}
