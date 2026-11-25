/**
 * No-JavaScript fallback for the password sign-in form.
 *
 * The normal login flow stays client-side: it calls the API directly and keeps
 * the access token in memory. A browser that never finishes hydration (slow or
 * interrupted chunk delivery behind a tunnel) would otherwise see the form but
 * be unable to use it. This route accepts the same native POST the form declares
 * and forwards it to the backend, carrying the HttpOnly refresh cookie back to
 * the browser. The redirected page's session bootstrap then obtains an access
 * token exactly as it does after a client-side login — no token is put in a URL
 * or a response body here.
 */
const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000"
)
  .replace(/\/api\/v1\/?$/, "")
  .replace(/\/+$/, "");

function safeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  // Local absolute paths only, and no backslashes: browsers normalise them to
  // slashes, so `/\attacker.test` is a protocol-relative URL in disguise.
  if (!/^\/(?!\/)/.test(value) || value.includes("\\") || /[\r\n]/.test(value)) {
    return "/";
  }
  return value;
}

/**
 * A relative `Location` is required here. `new URL(path, request.url)` builds
 * the redirect from the server's *bind* address: the standalone server run by
 * the E2E harness binds to `::`, which produced `http://[::]:3000/login` — an
 * address no browser can follow. The same would happen behind a reverse proxy
 * whose internal hostname differs from the public one.
 *
 * RFC 7231 §7.1.2 permits a relative reference in `Location`, and the browser
 * resolves it against the request URL it actually used. This also avoids
 * trusting a client-supplied `Host`/`X-Forwarded-Proto`, which would turn the
 * redirect into an open redirect or an HTTPS downgrade.
 */
function redirectTo(path: string) {
  const response = new Response(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
  return response;
}

function backToLogin(error: "credentials" | "unverified") {
  return redirectTo(`/login?error=${error}`);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return backToLogin("credentials");
  }

  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return backToLogin("credentials");

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${BACKEND}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return backToLogin("credentials");
  }

  if (!backendResponse.ok) {
    if (backendResponse.status === 403) {
      try {
        const body = (await backendResponse.clone().json()) as { code?: unknown };
        if (body?.code === "email_not_verified") {
          return backToLogin("unverified");
        }
      } catch {
        // A non-JSON 403 is still a failed login, not a reason to leak the body.
      }
    }
    return backToLogin("credentials");
  }

  const response = redirectTo(safeNext(form.get("next")));

  // The backend rotates the refresh cookie on login. Forward every Set-Cookie
  // it sent; dropping this header would leave the redirected page with no
  // session and bounce the student straight back to /login.
  const headersWithSetCookie = backendResponse.headers as Headers & {
    getSetCookie?: () => string[];
  };
  for (const cookie of headersWithSetCookie.getSetCookie?.() ?? []) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
