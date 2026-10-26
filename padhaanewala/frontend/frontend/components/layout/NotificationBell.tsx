"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";

import { useApp } from "@/lib/context/AppContext";
import { cn } from "@/lib/utils";
import { formatNotificationAge } from "@/lib/notification-inbox";

/**
 * The header's notification bell.
 *
 * ## Why it exists
 *
 * The account page listed notifications, but nothing on the site said "you have
 * one" — a student had to visit `/dashboard` and read the page to find out. The
 * admin console could send a broadcast and the only proof it arrived was a row
 * in the database.
 *
 * ## Signed-out visitors do not get a bell
 *
 * There is nothing to show them: `/notifications/my` is scoped to a session, and
 * an empty bell with a "sign in" prompt in the chrome of every marketing page is
 * noise. It appears only when it has something to say.
 *
 * ## The list is live, not a snapshot
 *
 * `AppContext` re-pulls the inbox every minute and whenever the tab regains
 * focus. Without that the count would be whatever it was when the page loaded,
 * and a message sent while the student was reading would be invisible until a
 * reload — which is the same defect as having no bell.
 *
 * ## Marking read is optimistic
 *
 * Clicking a row clears its dot immediately and calls the API in the background.
 * The alternative — waiting for the round trip before anything changes — reads
 * as a dead click, and the failure mode on error is simply that the row is
 * unread again on the next pull.
 */
export function NotificationBell() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const unread = notifications.filter((n) => !n.read).length;
  const preview = notifications.slice(0, 6);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Return focus to the control that opened the panel. Without this, Escape
      // closes the panel and leaves focus on a `div` that no longer exists,
      // which sends the next Tab to the top of the document.
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    // Focus the panel so Escape reaches it and a long list is keyboard
    // scrollable. `focus()` on an element with `tabIndex={-1}` does not move the
    // visual focus ring onto a random control.
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="site-notifications"
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-full transition-colors",
          open
            ? "bg-purple-200/70 text-purple-900 dark:bg-slate-700 dark:text-purple-200"
            : "bg-purple-100/60 text-purple-900 hover:bg-purple-200/60 dark:bg-slate-800 dark:text-purple-300 dark:hover:bg-slate-700",
        )}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id="site-notifications"
          role="dialog"
          aria-label="Notifications"
          tabIndex={-1}
          className="absolute right-0 top-full z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-2xl animate-fade-up dark:border-slate-800 dark:bg-slate-900 focus:outline-none"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-slate-800">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold text-purple-700 transition-colors hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-slate-800"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            ) : null}
          </div>

          {preview.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                No notifications yet.
              </p>
              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                We&apos;ll let you know when something changes.
              </p>
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto dark:divide-slate-800 scroll-thin">
              {preview.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => markNotificationRead(item.id)}
                    disabled={item.read}
                    className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors enabled:hover:bg-gray-50 dark:enabled:hover:bg-slate-800/60 disabled:cursor-default"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        item.read ? "bg-transparent" : "bg-purple-600 dark:bg-purple-400",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-[13px]",
                            item.read
                              ? "font-medium text-gray-600 dark:text-slate-300"
                              : "font-semibold text-gray-900 dark:text-white",
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="shrink-0 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                          {formatNotificationAge(item.date)}
                        </span>
                      </span>
                      {item.message ? (
                        <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-slate-500 dark:text-slate-400">
                          {item.message}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-gray-100 px-4 py-2.5 dark:border-slate-800">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="block text-center text-[12px] font-semibold text-purple-700 transition-colors hover:text-purple-900 dark:text-purple-300 dark:hover:text-purple-200"
            >
              View all in dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
