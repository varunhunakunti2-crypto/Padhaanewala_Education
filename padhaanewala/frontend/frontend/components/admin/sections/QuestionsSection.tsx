"use client";


import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";

import { SectionHeading, AddButton, RowActions, FilterChips } from "@/components/admin/primitives";
import { SAMPLE_QUESTIONS } from "@/components/admin/fixtures";

export function QuestionsSection() {
  const [difficulty, setDifficulty] = useState<string | "all">("all");
  const all = SAMPLE_QUESTIONS as unknown as { id: string; test: string; text: string; type: string; difficulty: string; topic: string }[];
  const rows = difficulty === "all" ? all : all.filter((q) => q.difficulty === difficulty);
  return (
    <div>
      <SectionHeading title="Question bank" description="Curate questions across all mock tests" count={all.length} action={<AddButton label="Add question" />} />
      <div className="mb-4">
        <FilterChips options={["Easy", "Medium", "Hard"] as const} value={difficulty} onChange={setDifficulty} />
      </div>
      <DataTable
          columns={[
            { key: "test", header: "Test" },
            { key: "text", header: "Question" },
            { key: "type", header: "Type" },
            { key: "difficulty", header: "Difficulty", render: (q) => <Badge variant={q.difficulty === "Easy" ? "green" : q.difficulty === "Medium" ? "yellow" : "red"}>{q.difficulty}</Badge> },
            { key: "topic", header: "Topic" },
            { key: "actions", header: "", className: "text-right", render: (q) => <RowActions item={q.text.replace(/[?.]/g, "")} noun="question" /> },
          ]}
          rows={rows}
          searchKeys={["text", "test", "topic"]}
          searchPlaceholder="Search questions..."
        />
    </div>
  );
}

/* ---------------------------------- People sections ---------------------------------- */
