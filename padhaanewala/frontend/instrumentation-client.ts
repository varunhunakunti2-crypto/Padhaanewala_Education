/**
 * Client-side instrumentation. Phase 5.4.
 *
 * Runs after the document is parsed and before React hydrates, which is the
 * only window in which an error thrown during the earliest part of app startup
 * can still be caught. The two listeners below cover the failures that reach no
 * React error boundary at all: a throw in a `useEffect`, a rejected promise that
 * nobody awaited, a resource that failed to load and threw. Before this, those
 * were invisible — `app/error.tsx` cannot see them and nothing else was
 * listening.
 *
 * Kept deliberately small. Next.js warns above 16 ms of synchronous
 * initialisation, and this is two `addEventListener` calls.
 */
import { installGlobalErrorListeners } from "@/lib/observability";

try {
  installGlobalErrorListeners();
} catch {
  // Instrumentation must never be the reason the app fails to start.
}
