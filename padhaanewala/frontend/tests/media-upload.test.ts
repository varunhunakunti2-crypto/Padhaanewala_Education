import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, adminApi, type AdminMedia } from "@/lib/api";
import {
  MEDIA_ALT_TEXT_MAX,
  MEDIA_ENTITY_TYPES,
  MEDIA_MAX_BYTES_DEFAULT,
  MEDIA_SVG_REASON,
  buildMediaUpload,
  describeMediaError,
  formatBytes,
  mediaEntityLabel,
  mediaFileExtension,
  validateMediaFile,
  type MediaFormValues,
} from "@/lib/media-form";

/**
 * The media upload request, tested without a DOM.
 *
 * `POST /media/upload` has existed on the backend since Phase 0 and had no client
 * at all: the admin "Upload" button opened a toast that named a create flow which
 * was never built. Nothing about that state fails a build, a type check or a
 * lint — it is only visible by sending the request the backend actually declares.
 *
 * So the assertions below are written against the route, not against the form:
 * the part names and arities come from `upload_media`'s `Form(...)` parameters,
 * the refusals from `media_store.save`, and the size ceiling from
 * `MEDIA_MAX_BYTES`. Where the two sides could drift — the accepted types, the
 * limit, the column widths — the test pins the client to the value the server
 * uses, so the drift shows up here rather than as a 422 in the browser.
 */

/** A `File` of `bytes` length, since `size` is what the checks read. */
function imageFile(bytes: number, name = "logo.png", type = "image/png"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function values(overrides: Partial<MediaFormValues> = {}): MediaFormValues {
  return {
    entity_type: "college",
    entity_id: "42",
    image_type: "logo",
    alt_text: "Campus gate",
    display_order: "0",
    ...overrides,
  };
}

describe("validateMediaFile", () => {
  it("accepts each of the four types the server sniffs", () => {
    // The exact set in `media_store.sniff_image_type`. A client that accepted
    // more would let the admin pick a file the server always refuses.
    for (const [name, type] of [
      ["logo.png", "image/png"],
      ["logo.jpg", "image/jpeg"],
      ["logo.jpeg", "image/jpeg"],
      ["loop.gif", "image/gif"],
      ["logo.webp", "image/webp"],
    ] as const) {
      expect(validateMediaFile(imageFile(2048, name, type)).ok, name).toBe(true);
    }
  });

  it("refuses SVG, and says why in terms the admin can act on", () => {
    // SVG is served **inline from this site's own origin** by
    // `GET /media/files/{id}`, so accepting one is script execution on our pages.
    const svg = imageFile(512, "logo.svg", "image/svg+xml");
    const result = validateMediaFile(svg);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(MEDIA_SVG_REASON);
      expect(result.error).toMatch(/PNG or WebP/);
    }
  });

  it("refuses a renamed SVG on the extension alone", () => {
    // The browser's label is advisory and a rename is free, so the extension is
    // checked as an independent signal rather than as a fallback.
    const renamed = imageFile(512, "logo.png.svg", "application/octet-stream");
    expect(validateMediaFile(renamed).ok).toBe(false);
  });

  it("refuses a non-image type the browser does admit", () => {
    expect(validateMediaFile(imageFile(2048, "brochure.pdf", "application/pdf")).ok).toBe(false);
  });

  it("refuses an empty file", () => {
    // `media_store.save` raises this as a 400 after the upload has already
    // crossed the network.
    const empty = imageFile(0, "logo.png");
    expect(validateMediaFile(empty).ok).toBe(false);
  });

  it("refuses a file over the limit, quoting both sizes", () => {
    const result = validateMediaFile(imageFile(MEDIA_MAX_BYTES_DEFAULT + 1, "big.png"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("5.0 MB");
      expect(result.error).toContain("5.0 MB");
    }
  });

  it("accepts a file at exactly the limit", () => {
    // Off-by-one, and the server's comparison is `>` as well.
    expect(validateMediaFile(imageFile(MEDIA_MAX_BYTES_DEFAULT, "exact.png")).ok).toBe(true);
  });

  it("trusts the extension when the browser has no type to offer", () => {
    // Windows drag-and-drop sometimes produces an empty `File.type`. Refusing
    // those would reject a real PNG for a reason the admin cannot see.
    expect(validateMediaFile(imageFile(2048, "logo.png", "")).ok).toBe(true);
  });

  it("refuses a file with no extension at all", () => {
    // There is nothing to confirm the type from, and the server sniffs the bytes
    // for reasons spelled out in `media_store`.
    expect(validateMediaFile(imageFile(2048, "logo", "")).ok).toBe(false);
  });
});

describe("mediaFileExtension", () => {
  it("reads the last extension, so a double extension cannot smuggle a type", () => {
    expect(mediaFileExtension("logo.png.svg")).toBe("svg");
    expect(mediaFileExtension("ARCHIVE.TAR.GZ")).toBe("gz");
  });

  it("returns nothing when there is no dot", () => {
    expect(mediaFileExtension("logo")).toBe("");
  });
});

describe("formatBytes", () => {
  it("uses the units the size hint and the size error both need", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(MEDIA_MAX_BYTES_DEFAULT)).toBe("5.0 MB");
  });
});

describe("buildMediaUpload", () => {
  it("sends exactly the parts upload_media declares", () => {
    // `file`, `entity_type`, `entity_id` are required; the rest are optional.
    // A misspelled part name is not an error on this side — it is a 422 from
    // FastAPI, or worse, a required part arriving as `None`.
    const built = buildMediaUpload(values(), imageFile(2048));
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const names = [...built.body.keys()].sort();
    expect(names).toEqual(
      ["alt_text", "display_order", "entity_id", "entity_type", "file", "image_type"].sort(),
    );
    expect(built.body.get("entity_type")).toBe("college");
    expect(built.body.get("entity_id")).toBe("42");
    expect(built.body.get("image_type")).toBe("logo");
    expect(built.body.get("alt_text")).toBe("Campus gate");
    expect(built.body.get("display_order")).toBe("0");
    expect(built.body.get("file")).toBeInstanceOf(File);
  });

  it("refuses a missing file before anything else", () => {
    const built = buildMediaUpload(values(), null);
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.error).toMatch(/Choose an image/);
  });

  it("requires an entity, because the column is not nullable", () => {
    // `entity_type` is `Mapped[str]` with no default and `entity_id` is
    // `Mapped[int]` — a row without them cannot be written, and they are the
    // only way the file can be found again.
    expect(buildMediaUpload(values({ entity_type: "" }), imageFile(2048)).ok).toBe(false);
    expect(buildMediaUpload(values({ entity_id: "" }), imageFile(2048)).ok).toBe(false);
  });

  it("refuses an id that is not a positive whole number", () => {
    // This is the soft-reference hazard the panel's entity picker exists to
    // prevent. `int(entity_id)` in FastAPI would 422 on these, but a client that
    // let `0` or `-3` through writes a row nothing will ever list.
    for (const bad of ["0", "-1", "4.5", "abc", "4 2", "1e3"]) {
      expect(buildMediaUpload(values({ entity_id: bad }), imageFile(2048)).ok, bad).toBe(false);
    }
  });

  it("omits display_order rather than sending an empty part", () => {
    // `display_order: int = Form(0)` takes a declared default only when the part
    // is absent. Sending `""` is a 422, so a blank box must not become a part.
    const built = buildMediaUpload(values({ display_order: "" }), imageFile(2048));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.get("display_order")).toBe("0");
  });

  it("refuses a fractional or negative display order", () => {
    // A bare `Integer` column, so "1.5" and "-2" are both storable and both
    // nonsense — and neither would ever fail on the server.
    for (const bad of ["1.5", "-2", "first"]) {
      expect(buildMediaUpload(values({ display_order: bad }), imageFile(2048)).ok, bad).toBe(false);
    }
  });

  it("sends an empty string for the optional text fields, not the word null", () => {
    // The route stores `image_type or None` and `alt_text or None`, so `""`
    // becomes NULL rather than a blank column. The part is sent either way so
    // the request shape does not depend on which boxes were filled in.
    const built = buildMediaUpload(values({ image_type: "", alt_text: "   " }), imageFile(2048));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.get("image_type")).toBe("");
    expect(built.body.get("alt_text")).toBe("");
  });

  it("trims the text it sends", () => {
    const built = buildMediaUpload(
      values({ entity_type: "  college  ", alt_text: "  Campus gate  " }),
      imageFile(2048),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.get("entity_type")).toBe("college");
    expect(built.body.get("alt_text")).toBe("Campus gate");
  });

  it("holds the text fields to the column widths", () => {
    // `String(50)` on entity_type and image_type, `String(255)` on alt_text.
    // `image_type` is the one the route does *not* truncate, so an over-long
    // value is stored as sent on SQLite and errors outright on MySQL.
    expect(buildMediaUpload(values({ image_type: "x".repeat(51) }), imageFile(2048)).ok).toBe(false);
    expect(buildMediaUpload(values({ alt_text: "x".repeat(MEDIA_ALT_TEXT_MAX + 1) }), imageFile(2048)).ok).toBe(
      false,
    );
  });

  it("does not run a file check twice, or disagree with itself", () => {
    // The same rejection the dialog shows on selection, so a file that cannot be
    // sent never produces a "chosen" state the submit button would then refuse.
    const built = buildMediaUpload(values(), imageFile(1024, "logo.svg", "image/svg+xml"));
    expect(built.ok).toBe(false);
  });
});

describe("mediaEntityLabel", () => {
  it("labels the types this panel can attach to", () => {
    for (const type of MEDIA_ENTITY_TYPES) {
      expect(mediaEntityLabel(type.value)).toBe(type.label);
    }
  });

  it("falls back to the stored value for rows this panel did not write", () => {
    // Rows predate the picker and hold whatever free text was typed into the
    // column. Rendering those as a blank would make real uploaded files look
    // unattached, and would hide them from a search for the owning record.
    expect(mediaEntityLabel("college_profile")).toBe("college_profile");
    expect(mediaEntityLabel("College")).toBe("College");
  });

  it("says so plainly when a row is unattached", () => {
    expect(mediaEntityLabel(null)).toBe("Unattached");
    expect(mediaEntityLabel("   ")).toBe("Unattached");
  });
});

describe("describeMediaError", () => {
  it("passes through the server's own wording for a byte-level refusal", () => {
    // 413 and 415 are raised by `media_store.save` with messages that name the
    // real sizes and the accepted formats. Replacing them with "upload failed"
    // would be correct and useless.
    const tooBig = new ApiError("That file is 9000 KB. The limit is 5120 KB.", 413);
    const notImage = new ApiError("That file is not a PNG, JPEG, GIF or WebP image.", 415);
    expect(describeMediaError(tooBig)).toContain("5120 KB");
    expect(describeMediaError(notImage)).toContain("PNG, JPEG, GIF or WebP");
  });

  it("names the roles that can upload, because the failure is a 403", () => {
    expect(describeMediaError(new ApiError("Not enough permissions", 403))).toMatch(
      /super admin, admin or content manager/,
    );
  });

  it("distinguishes an unreachable API from a rejected request", () => {
    expect(describeMediaError(new ApiError("", 0))).toMatch(/Could not reach the API/);
    expect(describeMediaError(new TypeError("Failed to fetch"))).toMatch(/Check your connection/);
  });
});

describe("adminApi media calls", () => {
  function jsonResponse(body: unknown, status = 200): Response {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }

  /** A page of `count` media rows, so page length is the only variable. */
  function page(count: number): AdminMedia[] {
    return Array.from({ length: count }, (_unused, i) => ({ id: i + 1, url: `/f/${i + 1}` }) as AdminMedia);
  }

  it("walks the library instead of asking for one page", async () => {
    // `GET /media` defaults to `limit=50` and caps at 100. The old call fetched
    // one page and returned it, so every asset past the first fifty was absent
    // from the library with nothing to indicate there were more — and an admin
    // re-uploading one of them gets a second row rather than a replacement.
    const full = page(100);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(full))
      .mockResolvedValueOnce(jsonResponse(page(3)));
    vi.stubGlobal("fetch", fetchMock);

    const rows = await adminApi.media();

    expect(rows).toHaveLength(103);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl, secondUrl] = (fetchMock.mock.calls as [string][]).map(([url]) => url);
    expect(firstUrl).toContain("limit=100&offset=0");
    expect(secondUrl).toContain("limit=100&offset=100");
  });

  it("stops at a short page instead of asking once more", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(page(4)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(adminApi.media()).resolves.toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("posts the upload as multipart and sets no Content-Type of its own", async () => {
    // The load-bearing assertion in this file. `apiFetchImpl` defaults every body
    // to `Content-Type: application/json`, which is correct for a serialised
    // body and catastrophic for a `FormData` one: the browser appends the
    // multipart boundary to the header *it* generates, so a header set here
    // either replaces it — leaving Starlette unable to find the boundary and
    // failing to parse a single part — or is ignored, leaving a JSON-typed
    // multipart body. The upload then 422s on a file this panel said was fine.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const built = buildMediaUpload(values(), imageFile(2048));
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    await adminApi.uploadMedia(built.body);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = new Headers(init.headers);
    expect(sent.has("Content-Type")).toBe(false);
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("still labels a JSON body, so the other admin calls are unaffected", async () => {
    // The other half of the pair. A fix that simply stopped setting the header
    // would pass the assertion above and break every POST in the admin console.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await adminApi.updateMedia(1, { alt_text: "Campus gate" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
