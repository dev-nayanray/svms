"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * MarketingReveal — wraps children in a scroll-triggered fade-up animation.
 *
 * Uses IntersectionObserver to add the `.is-visible` class when the element
 * scrolls into view. Respects `prefers-reduced-motion` via the CSS rule in
 * globals.css that disables the transition.
 *
 * The `delay` prop (in ms) staggers children — pass 0, 100, 200, etc. for
 * a cascading reveal effect on grids of cards.
 *
 * Always renders a <div>. If you need a semantic <li> or <section>, wrap
 * the MarketingReveal around the semantic element instead.
 */
export function MarketingReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("euroscope-reveal", visible && "is-visible", className)}
      style={delay ? { ["--reveal-delay" as string]: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
