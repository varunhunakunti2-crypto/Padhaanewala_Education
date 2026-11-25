/**
 * Antigravity Simple Browser test harness.
 *
 * Antigravity's bundled "Simple Browser" is an iframe preview. The app sends
 * `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`,
 * so the iframe is blank. This proxy forwards to the running frontend on :3000
 * and removes only those two framing headers. No application code or production
 * security policy is changed.
 *
 * Run:  npm run test:antigravity
 * Open: http://localhost:3100/__test-console
 *       (then click through the links inside Antigravity Simple Browser)
 */
import http from "node:http";

const PORT = Number(process.env.PORT || 3100);
const TARGET_HOST = process.env.TARGET_HOST || "127.0.0.1";
const TARGET_PORT = Number(process.env.TARGET_PORT || 3000);
const ORIGIN = `http://localhost:${PORT}`;

const link = (href, label, hint = "") =>
  `<li><a href="${href}">${label}</a>${hint ? `<span>${hint}</span>` : ""}</li>`;

const group = (title, items) =>
  `<section><h2>${title}</h2><ul>${items.join("")}</ul></section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Padhaanewala — Antigravity test console</title>
<style>
  :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; padding: 2rem; background: #f7f7fb; color: #1e1b3a; }
  h1 { margin: 0 0 .25rem; font-size: 1.6rem; }
  .lead { margin: 0 0 1.5rem; color: #5b5578; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  section { background: #fff; border: 1px solid #e5e1f5; border-radius: 14px; padding: 1rem 1.25rem; }
  h2 { margin: 0 0 .75rem; font-size: .95rem; text-transform: uppercase; letter-spacing: .06em; color: #6d28d9; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; padding: .45rem 0; border-top: 1px solid #f1eefb; }
  li:first-child { border-top: 0; }
  a { color: #4338ca; font-weight: 650; text-decoration: none; }
  a:hover { text-decoration: underline; }
  span { color: #8b87a3; font-size: .78rem; text-align: right; }
  footer { margin-top: 1.5rem; font-size: .85rem; color: #6b6782; }
  code { background: #eeeaf8; padding: .1rem .35rem; border-radius: 5px; }
</style>
</head>
<body>
<h1>Padhaanewala test console</h1>
<p class="lead">Click any link below. Everything runs inside this Antigravity Simple Browser frame.</p>
<div class="grid">
${group("Auth", [
  link("/login", "Sign in", "password + email"),
  link("/login?mode=signup", "Get Started", "sign-up form"),
  link("/login?mode=otp", "OTP sign in", "SMS code"),
  link("/forgot-password", "Forgot password"),
  link("/verify-email", "Verify email"),
  link("/dashboard", "Dashboard", "protected"),
])}
${group("Discovery", [
  link("/", "Home"),
  link("/colleges", "Colleges", "filters"),
  link("/courses", "Courses"),
  link("/exams", "Exams"),
  link("/scholarships", "Scholarships"),
  link("/reviews", "Reviews"),
  link("/blog", "Blog"),
])}
${group("Tools & forms", [
  link("/compare", "Compare colleges"),
  link("/mock-tests", "Mock tests", "proctored"),
  link("/ask-ai", "AI assistant"),
  link("/contact", "Contact enquiry"),
  link("/add-college", "Suggest a college"),
  link("/admission", "Admission help"),
])}
${group("Account & admin", [
  link("/admin", "Admin console", "admin role"),
  link("/legal/privacy", "Privacy notice"),
  link("/legal/terms", "Terms"),
  link("/api/health", "API health", "JSON"),
  link("/api/v1/stats/catalog", "Catalog stats", "JSON"),
])}
</div>
<footer>
  Frontend: <code>${ORIGIN}</code> → <code>http://${TARGET_HOST}:${TARGET_PORT}</code>.
  Hard-refresh after a rebuild. This proxy only removes iframe-blocking headers;
  it does not alter application behaviour.
</footer>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === "/__test-console" || req.url.startsWith("/__test-console?")) {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
    return;
  }

  const headers = { ...req.headers, host: `localhost:${PORT}` };
  const upstream = http.request(
    {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      method: req.method,
      path: req.url,
      headers,
    },
    (upstreamRes) => {
      const responseHeaders = { ...upstreamRes.headers };
      delete responseHeaders["content-security-policy"];
      delete responseHeaders["content-security-policy-report-only"];
      delete responseHeaders["x-frame-options"];
      res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
      upstreamRes.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Test proxy could not reach the frontend: ${error.message}\n`);
  });

  req.pipe(upstream);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Antigravity test console: ${ORIGIN}/__test-console`);
  console.log(`Forwarding to http://${TARGET_HOST}:${TARGET_PORT}`);
});
