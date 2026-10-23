export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Fetch wrapper that automatically prepends API_BASE if a relative path is given,
 * and retries on network failures (e.g. backend still starting up).
 */
export async function apiFetch(
  endpoint: string,
  options?: RequestInit,
  retries = 3,
  delayMs = 1200
): Promise<Response> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      } else {
        throw error;
      }
    }
  }

  return fetch(url, options);
}
