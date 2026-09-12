"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatIcon, CloseIcon, SparklesIcon, ArrowRightIcon } from "@/components/icons";
import {
  popularCourses,
  featuredColleges,
  scholarships,
  upcomingExams,
  mockTests,
} from "@/data/home";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  links?: { label: string; href: string }[];
};

const SUGGESTIONS = [
  "What are the top medical colleges?",
  "Which entrance exams are upcoming?",
  "Tell me about MBBS course",
  "Any scholarships available?",
  "What mock tests can I take?",
];

let msgId = 0;
function respond(input: string): Message {
  const q = input.toLowerCase();
  const links: Message["links"] = [];

  if (q.match(/\b(college|universit|institute)\b.*\b(top|best|rank|list)\b|\b(top|best|rank)\b.*\b(college|universit)/)) {
    const top = featuredColleges.slice(0, 5);
    const list = top.map((c) => `• ${c.name} — ${c.fees || "N/A"}`).join("\n");
    links.push({ label: "Browse all colleges", href: "/colleges" });
    return { id: ++msgId, role: "assistant", text: `Here are some of the top colleges on Padhaanewala:\n\n${list}\n\nTap below to explore the full list with filters.`, links };
  }

  if (q.match(/\b(exam|entrance|jee|neet|cuet|kcet)\b.*\b(upcoming|next|date|schedule|when)/) || q.match(/\b(upcoming|next)\b.*\b(exam|entrance)/)) {
    const list = upcomingExams.slice(0, 5).map((e) => `• ${e.name} — ${e.date}`).join("\n");
    links.push({ label: "View all exams", href: "/exams" });
    return { id: ++msgId, role: "assistant", text: `Here are the upcoming exams:\n\n${list}\n\nCheck the full list for deadlines and registration links.`, links };
  }

  if (q.match(/\b(mbbs|medical|bams|bhms|nursing|b\.?sc\.?\s*nurs)/)) {
    const medCourse = popularCourses.find((c) => c.name.includes("MBBS") || c.name.includes("Medical"));
    links.push({ label: "Explore medical courses", href: "/courses" });
    return { id: ++msgId, role: "assistant", text: medCourse
      ? `**${medCourse.name}**\n${medCourse.colleges} colleges offer this course • ${medCourse.tag}\n\nA sought-after medical program in India. Admission is via NEET-UG score. Top colleges include AIIMS, JIPMER, and state medical colleges.\n\nUse the College Predictor to check your chances based on rank.`
      : "MBBS/BAMS/BHMS are popular medical programs. Admission is primarily through NEET-UG. Browse our medical colleges or use the AI Predictor to check your chances.", links };
  }

  if (q.match(/\b(engineering|b\.?tech|btech|tech|computer science|cse|it\b)/)) {
    const engCourse = popularCourses.find((c) => c.name.includes("Engineering") || c.name.includes("B.Tech"));
    links.push({ label: "Explore engineering courses", href: "/courses" });
    return { id: ++msgId, role: "assistant", text: engCourse
      ? `**${engCourse.name}**\n${engCourse.colleges} colleges offer this course • ${engCourse.tag}\n\nEngineering remains one of the most popular career paths. Admissions through JEE Main/Advanced, state CETs, and private university exams.`
      : "Engineering (B.Tech) is available across 50+ specializations. Top entrance exams include JEE Main, JEE Advanced, and state CETs.", links };
  }

  if (q.match(/\b(scholar|fellowship|financial aid|stipend|fee waiver|fund)/)) {
    const list = scholarships.slice(0, 4).map((s) => `• ${s.name} — ${s.amount}`).join("\n");
    links.push({ label: "View all scholarships", href: "/scholarships" });
    return { id: ++msgId, role: "assistant", text: `Yes! Here are some scholarships you can apply for:\n\n${list}\n\nBrowse all scholarships with eligibility filters.`, links };
  }

  if (q.match(/\b(mock\s*test|practice|quiz|prepare|preparation|exam prep)/)) {
    const list = mockTests.slice(0, 4).map((t) => `• ${t.name} — ${t.questions} questions, ${t.duration}`).join("\n");
    links.push({ label: "Take a mock test", href: "/mock-tests" });
    return { id: ++msgId, role: "assistant", text: `We have mock tests to help you prepare:\n\n${list}\n\nAll tests are free and include detailed solutions.`, links };
  }

  if (q.match(/\b(predict|chance|eligib|will i get|can i get|admission chance)/)) {
    links.push({ label: "Try the AI Predictor", href: "/college-predictor" });
    return { id: ++msgId, role: "assistant", text: "Use our **AI College Predictor** to check your admission chances! Just enter your rank/score, preferred course, exam, category, and state — it will show you Highly Suitable, Possible, and Reach colleges.\n\nNote: Predictor results are based on previous year cutoff trends.", links };
  }

  if (q.match(/\b(compare|versus|vs|better|difference)/)) {
    links.push({ label: "Compare colleges", href: "/compare" });
    return { id: ++msgId, role: "assistant", text: "You can compare up to 4 colleges side-by-side on fees, placements, NIRF ranking, courses offered, and student reviews.\n\nHead to the Compare page to start!", links };
  }

  if (q.match(/\b(contact|help|counsell|call|reach|phone|email|support)/)) {
    links.push({ label: "Contact us", href: "/contact" });
    return { id: ++msgId, role: "assistant", text: "You can reach us through:\n\n• **WhatsApp** — click the green button below\n• **Contact page** — submit a query form\n• **Phone** — available Mon–Sat, 9 AM – 6 PM IST\n\nOur counsellors can help with college selection, application process, and scholarship guidance.", links };
  }

  if (q.match(/\b(hi|hello|hey|namaste|sup|help|what can you)/)) {
    return { id: ++msgId, role: "assistant", text: "Namaste! I'm Padhaanewala's AI assistant. I can help you with:\n\n• **Colleges** — find and compare top colleges\n• **Courses** — explore medical, engineering & more\n• **Exams** — check upcoming entrance exams\n• **Scholarships** — find financial aid options\n• **Mock Tests** — practice for NEET, JEE, CUET\n• **Predictor** — check your admission chances\n\nWhat would you like to know?" };
  }

  links.push({ label: "Browse colleges", href: "/colleges" });
  return { id: ++msgId, role: "assistant", text: "I can help you find colleges, courses, exams, scholarships, and more. Try asking about:\n\n• \"Top medical colleges\"\n• \"Upcoming exams\"\n• \"Any scholarships available?\"\n• \"Will I get admission with rank 5000?\"\n\nOr explore the links below!", links };
}

export default function AIFloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "assistant", text: "Namaste! I'm Padhaanewala's AI assistant. Ask me anything about colleges, exams, courses, or scholarships." },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollDown = useCallback(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), []);

  useEffect(() => { scrollDown(); }, [messages, scrollDown]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120); }, [open]);

  function send(text?: string) {
    const q = (text || input).trim();
    if (!q) return;
    const userMsg: Message = { id: ++msgId, role: "user", text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, respond(q)]);
      setTyping(false);
    }, 700);
  }

  return (
    <>
      {/* toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        className="fixed bottom-20 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105"
      >
        {open ? <CloseIcon className="h-6 w-6" /> : <SparklesIcon className="h-6 w-6" />}
      </button>

      {/* chat window */}
      {open && (
        <div className="fixed bottom-36 right-5 z-50 flex w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-black/15">
          {/* header */}
          <div className="flex items-center gap-3 bg-neutral-950 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
              <SparklesIcon className="h-4 w-4 text-white" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Padhaanewala AI</p>
              <p className="text-xs text-neutral-400">Ask about colleges, exams & more</p>
            </div>
            <ChatIcon className="h-4 w-4 text-neutral-500" />
          </div>

          {/* messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" style={{ maxHeight: 340 }}>
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                  m.role === "user"
                    ? "bg-neutral-950 text-white rounded-br-md"
                    : "bg-neutral-100 text-neutral-800 rounded-bl-md"
                }`}>
                  {m.text.split("\n").map((line, i) => {
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <span key={i}>
                        {i > 0 && "\n"}
                        {parts.map((part, j) =>
                          part.startsWith("**") && part.endsWith("**")
                            ? <strong key={j}>{part.slice(2, -2)}</strong>
                            : part
                        )}
                      </span>
                    );
                  })}
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <a
                          key={l.href}
                          href={l.href}
                          className="inline-block rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-950 hover:text-white"
                        >
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-400">
                  <span className="inline-flex gap-1"><span className="animate-bounce [animation-delay:0ms]">.</span><span className="animate-bounce [animation-delay:150ms]">.</span><span className="animate-bounce [animation-delay:300ms]">.</span></span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* suggestions */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 border-t border-neutral-100 px-4 pt-3 pb-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-950 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-center gap-2 border-t border-neutral-100 px-3 py-2.5"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950 text-white transition-opacity disabled:opacity-40"
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
