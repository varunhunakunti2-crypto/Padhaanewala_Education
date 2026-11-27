import { describe, expect, it } from "vitest";

import { getLegalDoc, type LegalBlock } from "@/lib/legal";

function textOf(block: LegalBlock): string {
  switch (block.kind) {
    case "p":
    case "note":
      return block.text;
    case "ul":
      return block.items.join(" ");
    case "dl":
      return block.items
        .map(({ term, detail }) => `${term} ${detail}`)
        .join(" ");
  }
}

describe("privacy notice matches the implemented data-rights paths", () => {
  const privacy = getLegalDoc("privacy");
  expect(privacy).toBeDefined();

  const copy = privacy!.sections.flatMap((section) =>
    section.blocks.map(textOf),
  ).join("\n");

  it("points data-rights requests at the in-app panel, with email as fallback", () => {
    expect(copy).toContain("Privacy and data");
    expect(copy).toContain("Data rights request");
    expect(copy).not.toContain("there is no in-app button");
  });

  it("qualifies the 30-day closure promise with the scheduled sweep", () => {
    expect(copy).toContain("within 30 days of the scheduled retention sweep");
  });
});
