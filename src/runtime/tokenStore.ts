let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getToken(): string | null {
  return accessToken;
}

export function setToken(token: string | null): void {
  accessToken = token;
}

export function clearToken(): void {
  accessToken = null;
}

export async function runRefresh(refresher: () => Promise<string | null>): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refresher().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
