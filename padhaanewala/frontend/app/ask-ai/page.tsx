import { Metadata } from "next";
import { AIChat } from "@/components/ai/AIChat";

export const metadata: Metadata = {
  title: "Ask Padhaanewala AI",
  description:
    "Chat with Padhaanewala AI — your education assistant. Ask about colleges, courses, exams, scholarships and admission processes.",
  openGraph: {
    title: "Ask Padhaanewala AI",
    description:
      "Get instant answers about courses, colleges, scholarships and entrance exams from Padhaanewala AI.",
  },
};

export default function AskAiPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 pb-8 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36">
      <div className="mx-auto mb-6 max-w-3xl text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-purple-950 dark:text-white sm:text-4xl">
          Ask Padhaanewala AI
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600 dark:text-slate-300">
          Your personal education assistant for colleges, courses, exams and scholarships.
        </p>
      </div>
      <AIChat />
    </section>
  );
}