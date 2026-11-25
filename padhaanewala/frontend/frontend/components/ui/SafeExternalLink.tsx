import type { ReactNode } from "react";

import { isRenderableHref } from "@/lib/content";

/**
 * An external anchor whose destination was typed by an admin.
 *
 * The validation rule lives in `lib/content.ts` and is applied here at render
 * time as well, because a row can predate the backend's write validation or be
 * inserted straight into the table. A refused href renders an inert span with
 * the same classes: the layout stays intact, but a link that cannot be
 * followed safely is never a link.
 */
interface SafeExternalLinkProps {
  href: string | null | undefined;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  title?: string;
}

export function SafeExternalLink({
  href,
  children,
  className,
  "aria-label": ariaLabel,
  title,
}: SafeExternalLinkProps) {
  if (!isRenderableHref(href)) {
    return (
      <span className={className} aria-label={ariaLabel} aria-disabled="true" title={title}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </a>
  );
}
