import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getToken } from "@/lib/auth-token";

export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;
  // Fallback for development/testing if domain is missing
  if (!host) {
    if (__DEV__) return "http://localhost:5000";
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }
  return new URL(`https://${host}`).href;
}

function buildHeaders(data?: unknown): Record<string, string> {
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {}
    throw new Error(message);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url.toString(), {
    method,
    headers: buildHeaders(data),
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url.toString(), {
      headers: buildHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
