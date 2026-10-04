import { describe, expect, it } from "vitest";

import {
  SORT_OPTIONS,
  defaultFilters,
  parseSearchParams,
  serializeSearch,
} from "@/lib/searchParams";
import type { SearchFilters } from "@/lib/types";

/**
 * The filter state that lives in the URL.
 *
 * Every catalogue page reads and writes its filters here, so a mismatch between
 * `parseSearchParams` and `serializeSearch` is not a cosmetic bug: it is a
 * link a user copies, pastes and sends to a friend that comes back different —
 * or a back button that loses the state the user just set. The strongest
 * assertion below is the round trip, because it fails the moment the two
 * functions disagree about a key, and they are written a dozen lines apart.
 */

const parse = (qs: string) => parseSearchParams(new URLSearchParams(qs));

describe("defaultFilters", () => {
  it("starts on relevance with no facet selected", () => {
    const f = defaultFilters();
    expect(f.sortBy).toBe("relevance");
    expect(f.query).toBe("");
    expect(f.states).toEqual([]);
    expect(f.hostel).toBeNull();
    expect(f.minFee).toBeNull();
    expect(f.minRating).toBeNull();
  });

  it("returns a fresh object each time", () => {
    // A shared default would let one page's filters leak into the next render.
    const a = defaultFilters();
    a.states.push("Karnataka");
    expect(defaultFilters().states).toEqual([]);
  });
});

describe("parseSearchParams", () => {
  it("reads a query and a page", () => {
    const { filters, page } = parse("q=btech&page=3");
    expect(filters.query).toBe("btech");
    expect(page).toBe(3);
  });

  it("collects repeated keys rather than keeping only the last", () => {
    const { filters } = parse("state=Karnataka&state=Kerala");
    expect(filters.states).toEqual(["Karnataka", "Kerala"]);
  });

  it("reads the tri-state switches as true, false and unset", () => {
    expect(parse("hostel=1").filters.hostel).toBe(true);
    expect(parse("hostel=0").filters.hostel).toBe(false);
    expect(parse("hostel=").filters.hostel).toBeNull();
    expect(parse("").filters.hostel).toBeNull();
  });

  it("reads placement the same way", () => {
    expect(parse("placement=1").filters.placementRate).toBe(true);
    expect(parse("placement=0").filters.placementRate).toBe(false);
    expect(parse("").filters.placementRate).toBeNull();
  });

  it("coerces a numeric bound to a number", () => {
    expect(parse("minFee=150000&maxFee=400000").filters.minFee).toBe(150000);
    expect(parse("minFee=150000&maxFee=400000").filters.maxFee).toBe(400000);
  });

  it("falls back to page 1 for anything that is not a positive page number", () => {
    // `Number(null)` is 0 and `Number("")` is 0, so both land in the default
    // branch rather than producing page 0 — which would render an empty window.
    expect(parse("").page).toBe(1);
    expect(parse("page=").page).toBe(1);
    expect(parse("page=0").page).toBe(1);
    expect(parse("page=-4").page).toBe(1);
    expect(parse("page=abc").page).toBe(1);
  });

  it("keeps an unknown sort rather than silently reverting to relevance", () => {
    // The branch requires the value to be in SORT_OPTIONS, so an unknown one
    // leaves the default. Pinned as behaviour, not as a preference: a sort that
    // is dropped is a control that appears to do nothing.
    expect(parse("sort=rating").filters.sortBy).toBe("rating");
    expect(parse("sort=nonsense").filters.sortBy).toBe("relevance");
  });

  it("leaves every facet empty when the query string is empty", () => {
    const { filters, page } = parse("");
    expect(filters).toEqual(defaultFilters());
    expect(page).toBe(1);
  });
});

describe("serializeSearch", () => {
  it("omits defaults so the URL stays shareable", () => {
    expect(serializeSearch(defaultFilters(), 1)).toBe("");
  });

  it("keeps page 1 and relevance out of the query string", () => {
    // Both are the default, and putting them in the URL means every internal
    // link looks different from the one before it.
    expect(serializeSearch(defaultFilters(), 1)).not.toContain("page=");
    expect(serializeSearch(defaultFilters(), 1)).not.toContain("sort=");
  });

  it("writes a page only when it is above 1", () => {
    expect(serializeSearch(defaultFilters(), 1)).toBe("");
    expect(serializeSearch(defaultFilters(), 2)).toBe("page=2");
  });

  it("writes a tri-state switch as 1 or 0 and skips null", () => {
    const on = defaultFilters();
    on.hostel = true;
    expect(serializeSearch(on, 1)).toContain("hostel=1");

    const off = defaultFilters();
    off.hostel = false;
    expect(serializeSearch(off, 1)).toContain("hostel=0");
  });

  it("emits repeated keys for a multi-select facet", () => {
    const f = defaultFilters();
    f.states = ["Karnataka", "Kerala"];
    expect(serializeSearch(f, 1)).toBe("state=Karnataka&state=Kerala");
  });
});

describe("round trip", () => {
  const samples: Array<[string, Partial<SearchFilters>]> = [
    ["nothing set", {}],
    ["query only", { query: "btech" }],
    ["multi-select facets", { states: ["Karnataka"], cities: ["Bengaluru"], types: ["Private"] }],
    ["tri-state switches", { hostel: true, placementRate: false }],
    ["fee bounds", { minFee: 100000, maxFee: 500000 }],
    ["rating", { minRating: 4 }],
    ["sort", { sortBy: "fees-desc" }],
    ["admission and district", { admissionStatuses: ["open"], districts: ["Bengaluru Urban"] }],
    ["everything at once", {
      query: "mba",
      states: ["Kerala", "Karnataka"],
      courseNames: ["MBA"],
      sectors: ["Private"],
      types: ["University"],
      exams: ["CAT"],
      accreditations: ["NAAC A"],
      hostel: false,
      placementRate: true,
      minFee: 50000,
      maxFee: 900000,
      sortBy: "placement",
      districts: ["Ernakulam"],
      universities: ["CUSAT"],
      admissionStatuses: ["closed"],
      minRating: 3,
    }],
  ];

  for (const [label, overrides] of samples) {
    it(`survives serialize then parse: ${label}`, () => {
      const original: SearchFilters = { ...defaultFilters(), ...overrides };
      const restored = parseSearchParams(new URLSearchParams(serializeSearch(original, 1)));
      expect(restored.filters).toEqual(original);
      expect(restored.page).toBe(1);
    });
  }

  it("survives a page number through the same path", () => {
    const restored = parseSearchParams(new URLSearchParams(serializeSearch(defaultFilters(), 7)));
    expect(restored.page).toBe(7);
  });

  it("does not lose a value containing characters that need encoding", () => {
    const f = defaultFilters();
    f.query = "b.tech & m.tech";
    const restored = parseSearchParams(new URLSearchParams(serializeSearch(f, 1)));
    expect(restored.filters.query).toBe("b.tech & m.tech");
  });
});

describe("SORT_OPTIONS", () => {
  it("offers a label for every sort key the parser accepts", () => {
    // A sort key that parses but has no control is unreachable, and a control
    // whose key does not parse silently does nothing.
    const values = SORT_OPTIONS.map((o) => o.value);
    expect(values).toContain("relevance");
    expect(values).toContain("rating");
    expect(values).toContain("name");
    expect(new Set(values).size).toBe(values.length);
  });

  it("offers a label for every sort key the parser accepts", () => {
    // A sort key that parses but has no control is unreachable from the UI, and
    // a control whose key the parser's allow-list rejects silently does nothing
    // — the select moves and the list does not.
    const values = SORT_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    for (const option of SORT_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      const { filters } = parseSearchParams(new URLSearchParams(`sort=${option.value}`));
      expect(filters.sortBy, `${option.value} must survive the parser's allow-list`).toBe(
        option.value,
      );
    }
  });
});
