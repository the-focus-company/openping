import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "workos_access_token";
const REFRESH_TOKEN_KEY = "workos_refresh_token";

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function deleteRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export function buildAuthorizationUrl(): string {
  const clientId = process.env.EXPO_PUBLIC_WORKOS_CLIENT_ID!;
  const redirectUri = "openping://auth/callback";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    provider: "authkit",
  });

  return `https://api.workos.com/user_management/authorize?${params.toString()}`;
}

export function getConvexSiteUrl(): string {
  const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL!;
  return convexUrl.replace(/\.cloud$/, ".site");
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const siteUrl = getConvexSiteUrl();
  const response = await fetch(`${siteUrl}/auth/mobile-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      redirect_uri: "openping://auth/callback",
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Token exchange failed: ${errorData}`);
  }

  return await response.json();
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const siteUrl = getConvexSiteUrl();
  const response = await fetch(`${siteUrl}/auth/mobile-refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error("Token refresh failed");
  }

  return await response.json();
}

export async function signOut(): Promise<void> {
  await deleteToken();
  await deleteRefreshToken();
}
