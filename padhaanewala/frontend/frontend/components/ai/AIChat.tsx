"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, User, Sparkles, RotateCcw, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { getAiResponse, AI_SUGGESTED_QUESTIONS } from "@/lib/data/notifications";
import { RobotViewer } from "@/components/ai/RobotViewer";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
}

const GREETING =
  "Namaste! I'm Padhaanewala AI, your education assistant. Ask me about colleges, courses, exams, scholarships or admission processes — I'm here to help you plan your future.";

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "g0", role: "ai", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const counterRef = useRef(0);
  const avatarRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [robotTop, setRobotTop] = useState<number | null>(null);

  const lastAiMsgId = [...messages].reverse().find((m) => m.role === "ai")?.id;

  // Scroll ONLY the internal chat container to the latest message, leaving main page fixed
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  useEffect(() => {
    const targetId = loading ? "loading" : lastAiMsgId;
    if (!targetId) return;

    const updatePosition = () => {
      const el = avatarRefs.current[targetId];
      if (el) {
        setRobotTop(el.offsetTop);
      }
    };

    updatePosition();
    const timer = setTimeout(updatePosition, 60);
    return () => clearTimeout(timer);
  }, [messages, loading, lastAiMsgId]);

  const nextId = () => `m-${counterRef.current++}`;

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const userMsg: ChatMessage = { id: nextId(), role: "user", text: q };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const data = await res.json();
      const reply = data?.reply || getAiResponse(q);
      const aiMsg: ChatMessage = { id: nextId(), role: "ai", text: reply };
      setMessages((m) => [...m, aiMsg]);
    } catch {
      const aiMsg: ChatMessage = {
        id: nextId(),
        role: "ai",
        text: getAiResponse(q),
      };
      setMessages((m) => [...m, aiMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-3xl flex-col overflow-hidden rounded-3xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-purple-900/5 dark:shadow-purple-950/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-purple-100 dark:border-slate-800 bg-gradient-to-r from-purple-700 to-indigo-700 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 flex-shrink-0 flex items-center justify-center pointer-events-none">
            <RobotViewer className="h-full w-full" animated={true} autoRotate={true} modelScale={1.75} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Ask Padhaanewala AI</p>
            <p className="text-xs text-white/70">Education assistant · online</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="New conversation"
          onClick={() => setMessages([{ id: "g-reset", role: "ai", text: GREETING }])}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="relative flex-1 space-y-4 overflow-y-auto px-4 py-5 scroll-thin">
        {/* Smooth sliding 3D Robot model */}
        {robotTop !== null && (
          <div
            className="absolute left-4 h-12 w-12 z-20 pointer-events-none transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)"
            style={{ top: `${robotTop}px` }}
          >
            <RobotViewer className="h-full w-full" autoRotate={false} modelScale={1.15} animationMode="sway" />
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <span
              ref={(el) => {
                if (m.role === "ai") {
                  avatarRefs.current[m.id] = el;
                }
              }}
              className={cn(
                "mt-0.5 relative flex h-12 w-12 shrink-0 items-center justify-center",
                m.role === "user" && "rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 shadow-sm",
              )}
            >
              {m.role === "ai" ? (
                <span className="h-2 w-2 rounded-full bg-purple-400/40 dark:bg-purple-600/40" />
              ) : (
                <User className="h-5 w-5" />
              )}
            </span>
            <div
              className={cn(
                "max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "ai"
                  ? "rounded-tl-sm border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
                  : "rounded-tr-sm bg-purple-600 text-white",
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <span
              ref={(el) => {
                avatarRefs.current["loading"] = el;
              }}
              className="mt-0.5 relative flex h-12 w-12 shrink-0 items-center justify-center"
            >
              <span className="h-2 w-2 rounded-full bg-purple-400/40 dark:bg-purple-600/40" />
            </span>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500 dark:text-purple-400" />
              <span className="text-sm text-slate-500 dark:text-slate-400">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested questions */}
      <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/50 px-4 py-2.5">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-400">
          Suggested questions
        </p>
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 no-scrollbar">
          {AI_SUGGESTED_QUESTIONS.slice(0, 5).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              disabled={loading}
              className="shrink-0 rounded-full border border-purple-200 dark:border-purple-800/60 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 transition hover:bg-purple-50 dark:hover:bg-slate-700"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about courses, colleges, exams..."
          className="h-11 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition focus:border-purple-400 dark:focus:border-purple-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900/30"
          aria-label="Type your question"
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>

      <p className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pb-2 pt-1 text-center text-[11px] text-slate-400 dark:text-slate-500">
        AI responses are informational and may not be fully accurate. Verify details on official websites.
      </p>
    </div>
  );
}

export function AiPromoCard() {
  return (
    <div className="rounded-3xl border border-purple-100 dark:border-purple-900/40 bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-slate-900 dark:via-purple-950/40 dark:to-slate-900 p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-600/30">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">Get instant answers</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">Ask the AI assistant anything about your education journey</p>
        </div>
      </div>
      <Link
        href="/ask-ai"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200"
      >
        Start a conversation <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}