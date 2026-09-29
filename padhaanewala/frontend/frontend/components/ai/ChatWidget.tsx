"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Bot, Loader2, RotateCcw, Send, User, X } from "lucide-react";
import Link from "next/link";

import { getAiResponse } from "@/lib/data/notifications";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
}

const GREETING =
  "Namaste! I'm Padhaanewala AI. Ask me about colleges, courses, entrance exams, scholarships or the admission process.";

/**
 * Mirrors `MAX_MESSAGE_CHARS` in `app/api/ai/route.ts`.
 *
 * The server rejects anything longer, so capping the input here turns a wasted
 * round trip and a scolded error bubble into ordinary browser behaviour. If one
 * of the two ever changes, this is the one to change.
 */
const MAX_MESSAGE_CHARS = 500;

const SUGGESTIONS = [
  "How do I compare two colleges?",
  "Which entrance exam should I prepare for?",
  "How does the college predictor work?",
  "Where can I find scholarships?",
];

export function ChatWidget({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "greeting", role: "ai", text: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const counterRef = useRef(0);
  const titleId = useId();

  const nextId = () => `m-${counterRef.current++}`;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // The panel is a floating layer over whatever the user was reading, so the
  // page behind it keeps scrolling. Escape is the keyboard escape hatch, which
  // is why the trigger advertises aria-expanded and why focus comes straight back
  // to the input instead of staying on the close button.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { id: nextId(), role: "user", text: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const data = await res.json();
      const reply = typeof data?.reply === "string" && data.reply ? data.reply : getAiResponse();
      setMessages((m) => [...m, { id: nextId(), role: "ai", text: reply }]);
    } catch {
      setMessages((m) => [...m, { id: nextId(), role: "ai", text: getAiResponse() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="pdw-ai-chat"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="fixed inset-x-3 bottom-32 z-[80] flex h-[min(32rem,70dvh)] flex-col overflow-hidden rounded-3xl border border-purple-100 bg-white shadow-2xl shadow-purple-900/20 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/50 sm:inset-x-auto sm:right-6 sm:h-[32rem] sm:w-[23rem]"
    >
      <div className="flex items-center gap-3 bg-gradient-to-r from-purple-700 to-indigo-700 px-4 py-3.5">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-white/15 text-white">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p id={titleId} className="truncate text-sm font-bold text-white">
            Padhaanewala AI
          </p>
          <p className="truncate text-xs text-white/70">College &amp; exam assistant</p>
        </div>
        <button
          type="button"
          onClick={() => setMessages([{ id: `greeting-${counterRef.current++}`, role: "ai", text: GREETING }])}
          disabled={messages.length <= 1}
          aria-label="Start a new conversation"
          title="New conversation"
          className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3.5 py-4 scroll-thin">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span
              className={
                m.role === "user"
                  ? "mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                  : "mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
              }
            >
              {m.role === "user" ? (
                <User className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Bot className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-purple-600 px-3.5 py-2.5 text-sm leading-relaxed text-white"
                  : "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-100"
              }
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500" aria-hidden="true" />
              <span className="sr-only" role="status">
                Thinking
              </span>
              <span aria-hidden="true">Thinking…</span>
            </span>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="border-t border-slate-100 px-3.5 py-2.5 dark:border-slate-800">
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 no-scrollbar">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="shrink-0 rounded-full border border-purple-200 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-50 dark:border-purple-800/60 dark:bg-slate-800 dark:text-purple-300 dark:hover:bg-slate-700"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-slate-100 p-2.5 dark:border-slate-800"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder="Ask about colleges, exams, fees…"
          aria-label="Type your question"
          className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-500 dark:focus:bg-slate-800 dark:focus:ring-purple-900/30"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send question"
          className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-purple-600 text-white transition hover:bg-purple-700 disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3.5 py-2 dark:border-slate-800">
        <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
          Answers are informational. Verify details on official websites.
        </p>
        <Link
          href="/ask-ai"
          className="flex flex-shrink-0 items-center gap-0.5 text-[11px] font-semibold text-purple-700 hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-200"
        >
          Full chat
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
