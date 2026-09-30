"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

/**
 * The floating assistant button, mounted once by the root layout.
 *
 * It opens `ChatWidget` in place rather than navigating to `/ask-ai`, so asking a
 * question does not cost the reader the page they were on — which matters most on
 * a college detail page or a long blog article.
 *
 * The panel is code-split and only fetched on first open. `RobotViewer` pulls in
 * the whole three.js runtime plus a 1 MB GLB, and the FAB is in the root layout,
 * so anything eager here would be paid for by every page in the app.
 */
const RobotViewer = dynamic(
  () => import("@/components/ai/RobotViewer").then((m) => m.RobotViewer),
  {
    ssr: false,
    loading: () => (
      <span className="grid h-full w-full place-items-center rounded-full bg-purple-500/15" />
    ),
  },
);

const ChatWidget = dynamic(
  () => import("@/components/ai/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false },
);

export function AskAiFab() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Closing always hands focus back to the control that opened the panel.
  // Otherwise a keyboard user who pressed Escape (or activated the panel's own
  // close button) is dropped at the top of the document with nothing focused,
  // and the next Tab starts them from the header again.
  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      {open && <ChatWidget onClose={close} />}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="pdw-ai-chat"
        aria-label={open ? "Close Padhaanewala AI chat" : "Ask Padhaanewala AI"}
        title={open ? "Close chat" : "Ask Padhaanewala AI — College & Exam Assistant"}
        className="fixed bottom-36 right-4 z-[70] h-14 w-14 drop-shadow-2xl transition-transform duration-200 hover:scale-110 active:scale-95 sm:bottom-24 sm:right-6"
      >
        <span className="pointer-events-none -m-4 flex h-22 w-22 flex-shrink-0 items-center justify-center">
          <RobotViewer className="h-full w-full" autoRotate={false} modelScale={1.45} />
        </span>
      </button>
    </>
  );
}
