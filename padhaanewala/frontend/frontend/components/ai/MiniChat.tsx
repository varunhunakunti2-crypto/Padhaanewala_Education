"use client";

import { useState } from "react";
import { Bot, MessagesSquare, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { College } from "@/lib/types";

function buildComparisonInsight(colleges: College[]): string {
  if (colleges.length < 2) {
    return "Add at least two colleges to your comparison and I can help you weigh them. Try adding colleges from the dashboard or browse page, then ask me which one suits you better.";
  }
  const names = colleges.map((c) => c.shortName).join(", ");
  const sorted = [...colleges].sort((a, b) => b.placement.placementRate - a.placement.placementRate);
  const best = sorted[0];
  const bestFee = [...colleges].sort((a, b) => Math.min(...a.courses.map((x) => x.feePerYear)) - Math.min(...b.courses.map((x) => x.feePerYear)))[0];
  return `I compared ${names}. Based on placements, ${best.shortName} has the highest placement rate at ${best.placement.placementRate}% with an average package of ₹${(best.placement.averagePackage / 100000).toFixed(1)} LPA. For budget, ${bestFee.shortName} has the lowest starting fee at around ₹${(Math.min(...bestFee.courses.map((x) => x.feePerYear)) / 1000).toFixed(1)}K per year. Overall ratings: ${colleges.map((c) => `${c.shortName} ${c.rating}★`).join(", ")}. Choose based on your branch, budget and location priorities — I'd be happy to compare specific details.`;
}

export function MiniChat({ colleges }: { colleges: College[] }) {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    window.setTimeout(() => {
      setMessages((m) => [...m, { role: "ai", text: buildComparisonInsight(colleges) }]);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-purple-100 bg-white shadow-xl shadow-purple-900/5">
      <div className="flex items-center gap-3 border-b border-purple-100 bg-gradient-to-r from-purple-700 to-indigo-700 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white">
          <Bot className="h-5 w-5" />
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-white">
            <MessagesSquare className="h-4 w-4" /> Ask AI about your comparison
          </p>
          <p className="text-xs text-white/70">{colleges.length} college{colleges.length !== 1 ? "s" : ""} in compare list</p>
        </div>
      </div>

      <div className="max-h-64 space-y-3 overflow-y-auto px-5 py-4 scroll-thin">
        {messages.length === 0 && (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Pick a question below to get an AI summary of your comparison.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <span
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "user" ? "rounded-tr-sm bg-purple-600 text-white" : "rounded-tl-sm bg-slate-100 text-slate-700",
              )}
            >
              {m.text}
            </span>
          </div>
        ))}
        {loading && (
          <p className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-500">Analysing your colleges...</p>
        )}
      </div>

      <div className="flex gap-2 px-5 pb-3">
        <button
          type="button"
          disabled={colleges.length < 2}
          onClick={() => send("Which college has the best placement and value for money?")}
          className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100 disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" /> Summarise comparison
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-slate-100 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about fees, placements, hostels..."
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-purple-400 focus:bg-white"
          aria-label="Ask AI about comparison"
        />
        <ButtonIcon />
      </form>
    </div>
  );
}

function ButtonIcon() {
  return (
    <button
      type="submit"
      aria-label="Send"
      className="grid h-10 w-10 place-items-center rounded-xl bg-purple-600 text-white transition hover:bg-purple-700"
    >
      <Send className="h-4 w-4" />
    </button>
  );
}