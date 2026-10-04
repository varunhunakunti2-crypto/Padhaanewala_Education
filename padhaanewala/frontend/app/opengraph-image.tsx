import { ImageResponse } from "next/og";

import { SITE, SITE_URL } from "@/lib/site";

/**
 * The default social card, generated rather than committed as a binary.
 *
 * There is no image asset in `public/` and the only photograph in the repo is a
 * 1.6 MB hero, so a hand-made 1200×630 PNG would be a file nobody can edit
 * without design tools and nothing can keep in sync with the brand copy. This
 * route derives every string from `lib/site.ts`, so a rebrand cannot leave a
 * stale card behind.
 *
 * Per-section overrides live beside their segments
 * (`app/colleges/[slug]/opengraph-image.tsx`, `app/exams/[slug]/opengraph-image.tsx`);
 * this file is the fallback every other route inherits.
 */

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #071426 0%, #1a1147 55%, #2d1b69 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 38,
              fontWeight: 800,
            }}
          >
            P
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>
            {SITE.domain}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1, letterSpacing: -2 }}>
            {SITE.tagline}
          </div>
          <div style={{ fontSize: 30, color: "#c7c3e0", lineHeight: 1.4, maxWidth: 940 }}>
            {SITE.description}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 26,
            color: "#a5a0c8",
          }}
        >
          <span>{SITE.legalName}</span>
          <span>{SITE_URL.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>
    ),
    size,
  );
}
