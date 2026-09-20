import type { StudentProfile } from "@/lib/types";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api/v1").replace(/\/+$/, "");

const TOKEN_KEY = "cp_access_token";
const REFRESH_TOKEN_KEY = "cp_refresh_token";
const USER_KEY = "cp_user";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  mobile: string;
  password: string;
}

export interface UserMe {
  id: number;
  email: string;
  mobile: string;
  is_active: boolean;
  is_email_verified: boolean;
  is_mobile_verified: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface BackendProfile {
  id: number;
  email: string;
  mobile: string;
  name: string;
  education_level: string | null;
  course_interest: string | null;
  preferred_state: string | null;
  preferred_city: string | null;
  budget_min: number | null;
  budget_max: number | null;
  created_at: string;
}

export interface EnquiryPayload {
  name: string;
  mobile: string;
  email?: string | null;
  course_id?: number | null;
  college_id?: number | null;
  state_id?: number | null;
  city?: string | null;
  qualification?: string | null;
  message?: string | null;
  source?: string | null;
  source_url?: string | null;
  device_type?: string | null;
}

export interface EnquiryResponse {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  status: string;
  created_at: string;
}

export interface CatalogStats {
  ok: boolean;
  colleges: number;
  courses: number;
  exams: number;
  scholarships: number;
  blogs: number;
  mockTests: number;
}

export const EMPTY_STATS: CatalogStats = {
  ok: false,
  colleges: 0,
  courses: 0,
  exams: 0,
  scholarships: 0,
  blogs: 0,
  mockTests: 0,
};

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeAuth(tokens: AuthTokens): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, tokens.access_token);
  if (tokens.refresh_token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }
}

export function getStoredUser(): BackendProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as BackendProfile) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: BackendProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") {
        detail = data.detail;
      } else if (data && Array.isArray(data.detail)) {
        detail = data.detail.map((d: { msg?: string }) => d.msg ?? "").filter(Boolean).join(", ");
      }
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiFetch<AuthTokens>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  register: (payload: RegisterPayload) =>
    apiFetch<AuthTokens>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => apiFetch<UserMe>("/users/me"),

  myProfile: () => apiFetch<BackendProfile>("/users/me/profile"),
};

export async function submitEnquiry(payload: EnquiryPayload): Promise<EnquiryResponse> {
  return apiFetch<EnquiryResponse>("/enquiries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

let coursesCache: { id: number; name: string; degree: string | null }[] | null = null;
let statesCache: { id: number; name: string }[] | null = null;

async function courseLookup(): Promise<NonNullable<typeof coursesCache>> {
  if (!coursesCache) {
    coursesCache = await apiFetch<NonNullable<typeof coursesCache>>("/courses?limit=10000");
  }
  return coursesCache ?? [];
}

async function stateLookup(): Promise<NonNullable<typeof statesCache>> {
  if (!statesCache) {
    statesCache = await apiFetch<NonNullable<typeof statesCache>>("/locations/states");
  }
  return statesCache ?? [];
}

export async function resolveCourseId(name: string): Promise<number | null> {
  try {
    const norm = name.trim().toLowerCase();
    const list = await courseLookup();
    const hit = list.find(
      (c) => c.name.toLowerCase() === norm || (c.degree && c.degree.toLowerCase() === norm),
    );
    return hit?.id ?? null;
  } catch {
    return null;
  }
}

export async function resolveStateId(name: string): Promise<number | null> {
  try {
    const norm = name.trim().toLowerCase();
    const list = await stateLookup();
    const hit = list.find((s) => s.name.toLowerCase() === norm);
    return hit?.id ?? null;
  } catch {
    return null;
  }
}

export async function fetchCatalogStats(fallback: CatalogStats = EMPTY_STATS): Promise<CatalogStats> {
  try {
    const res = await fetch("/api/stats", { cache: "no-store" });
    if (!res.ok) return fallback;
    const data = await res.json();
    return { ...fallback, ...data, ok: Boolean(data.ok) };
  } catch {
    return fallback;
  }
}

export function toStudentProfile(p: BackendProfile): StudentProfile {
  return {
    name: p.name || p.email.split("@")[0],
    email: p.email,
    mobile: p.mobile,
    city: p.preferred_city ?? "",
    state: p.preferred_state ?? "",
    education: p.education_level ? [p.education_level] : [],
    interests: p.course_interest ? [p.course_interest] : [],
    preferredState: p.preferred_state ?? "",
    preferredCity: p.preferred_city ?? "",
    budgetMin: p.budget_min,
    budgetMax: p.budget_max,
  };
}