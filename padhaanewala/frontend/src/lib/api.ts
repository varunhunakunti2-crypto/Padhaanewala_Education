export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const ACCESS_TOKEN_KEY = "padhaanewala_access_token";
const REFRESH_TOKEN_KEY = "padhaanewala_refresh_token";

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export function storeTokens(tokens: AuthTokens) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Request failed with status ${res.status}`;
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      const first = detail[0];
      message =
        typeof first?.msg === "string"
          ? `${first.msg}${first.loc ? ` (${first.loc.join(".")})` : ""}`
          : JSON.stringify(first);
    } else if (typeof body?.detail === "object") {
      message = body.detail.msg ?? message;
    }
  } catch {
    // non-JSON error body — keep default message
  }
  return new ApiError(res.status, message);
}

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiFetch<T>(
  path: string,
  { method = "GET", body, headers }: ApiOptions = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as T;
}

export async function login(
  email: string,
  password: string
): Promise<AuthTokens> {
  return apiFetch<AuthTokens>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export type RegisterPayload = {
  name: string;
  email: string;
  mobile: string;
  password: string;
};

export async function register(
  payload: RegisterPayload
): Promise<AuthTokens> {
  return apiFetch<AuthTokens>("/api/v1/auth/register", {
    method: "POST",
    body: payload,
  });
}