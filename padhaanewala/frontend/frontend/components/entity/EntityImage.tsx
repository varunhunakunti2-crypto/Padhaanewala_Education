import { cn, BANNER_GRADIENTS } from "@/lib/utils";

/**
 * The single place an admin-uploaded image is rendered in place of a gradient.
 *
 * ## Why this exists rather than `<img>` at each call site
 *
 * Four entity types (colleges, courses, scholarships, exams) each drew a
 * gradient derived from a row id, and each is edited by a different admin
 * screen. If every card learned to prefer an image independently, the
 * *fallback* rule — "no image means keep the gradient" — would be re-derived in
 * eight places and drift in one of them, which is how a null `image_url` ends
 * up rendering as a broken `<img>` on exactly one page.
 *
 * ## Why a plain `<img>` and not `next/image`
 *
 * `imageUrl` holds either a same-origin media path written by the media library
 * (`/media/files/12`) or an absolute URL an admin typed by hand. `next/image`
 * would route the second kind through `/_next/image`, which refuses any host
 * that is not in `images.remotePatterns` — a build-time list that cannot know
 * what an operator will paste. A plain `<img>` sends both kinds straight to the
 * browser: the same-origin path is allowed by `img-src 'self'`, and a remote
 * URL needs its host in `CSP_IMAGE_HOSTS`, which is the documented contract for
 * admin-supplied origins (see `proxy.ts`).
 *
 * `loading="lazy"` and `decoding="async"` are set because these are below-the-
 * fold cards as often as not, and the gradient fallback is instant — so an
 * eager decode of a full-size upload is pure jank on a list page.
 */
interface EntityImageProps {
  /** The uploaded image, or `null`/`undefined` to render the fallback. */
  src?: string | null;
  /** Alt text. Pass `""` for a decorative image that repeats adjacent text. */
  alt: string;
  /** Gradient id (`g0`..`g7`); used only when `src` is absent. */
  gradientId?: string;
  /**
   * Rendered on top of the image or gradient. Used for initials, icons, or
   * scrim content the caller already owns.
   */
  children?: React.ReactNode;
  className?: string;
  /**
   * Extra classes for the `<img>` itself, e.g. an opacity scrim or a blur. Kept
   * separate from `className` because the two elements size differently: the
   * wrapper fills the area, the image is `object-cover` inside it.
   */
  imageClassName?: string;
}

export function EntityImage({
  src,
  alt,
  gradientId = "g0",
  children,
  className,
  imageClassName,
}: EntityImageProps) {
  const gradient = BANNER_GRADIENTS[gradientId] ?? BANNER_GRADIENTS.g0;
  const url = typeof src === "string" && src.trim() ? src.trim() : undefined;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-gradient-to-br text-white",
        // The gradient is applied even when an image is present, so it shows
        // through for a moment while the image decodes instead of a white box.
        gradient,
        className,
      )}
    >
      {url ? (
        // The URL is same-origin media or an admin-supplied host that cannot be a
        // build-time `images.remotePatterns` entry; see the module docstring.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn("absolute inset-0 h-full w-full object-cover", imageClassName)}
        />
      ) : null}
      {children}
    </div>
  );
}
