import { NextResponse } from "next/server";

import { getAiResponse } from "@/lib/data/notifications";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function POST(req: Request) {
  let message = "";
  try {
    const body = await req.json();
    message = typeof body?.message === "string" ? body.message.trim() : "";
  } catch {
    message = "";
  }

  if (!message) {
    return NextResponse.json({
      reply: "Please type a question so I can help you with colleges, courses, exams or scholarships.",
    });
  }

  if (OPENAI_API_KEY && OPENAI_API_KEY !== "change-me") {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 0.4,
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content:
                "You are Padhaanewala AI, an education assistant helping Indian students with college discovery, courses, entrance exams, scholarships and admissions. Answer concisely, practically and in a friendly tone.",
            },
            { role: "user", content: message },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content?.trim();
        if (reply) return NextResponse.json({ reply });
      }
    } catch {
      /* fall back to the offline responder below */
    }
  }

  return NextResponse.json({ reply: getAiResponse(message) });
}