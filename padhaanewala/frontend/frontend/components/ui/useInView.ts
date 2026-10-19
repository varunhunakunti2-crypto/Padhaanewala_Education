"use client";

import { useEffect, useRef, useState } from "react";

/**
 * `true` once `ref` has scrolled into the viewport, and stays `true`.
 *
 * This is the scroll trigger behind `Reveal` and `CountUp`. Both used to reach
 * for `motion/react`'s `whileInView`/`useInView` to get it, which pulled the
 * whole animation runtime into the client bundle for what is one
 * `IntersectionObserver` on a plain DOM node.
 *
 * `rootMargin` is the CSS-style margin string (`"-60px"` fires a little before
 * the element is fully on screen), matching the `viewport.margin` the motion
 * versions passed.
 *
 * The `IntersectionObserver` guard is not defensive noise: the component tests
 * run in jsdom, which has no observer, and a reveal that never fires would make
 * every wrapped element permanently invisible there. Without one, we treat the
 * content as already in view — i.e. visible — which is the safe failure mode.
 */
export function useInView<T extends Element>(
  rootMargin = "0px",
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      // No observer in this environment (jsdom under Vitest): report in view at
      // once rather than leaving wrapped content hidden forever. This is the one
      // synchronous update in the hook; the observer path updates from its
      // callback.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          // One-shot: the animations here never reverse, so stop watching.
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return [ref, inView];
}
