/**
 * Get the API base URL
 * In tests, returns a mocked base URL
 * In browser, uses window.location.origin
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  // Fallback for tests and SSR
  return "http://localhost:3000";
}

/**
 * Resolve an API path to a full URL
 * @param path - API path (e.g., "/api/nodes")
 * @returns Full URL (e.g., "http://localhost:3000/api/nodes")
 */
export function resolveApiUrl(path: string): string {
  const base = getApiBaseUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/**
 * Fetch wrapper that handles API URLs properly in tests and production
 */
export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = resolveApiUrl(path);
  return fetch(url, init);
}

