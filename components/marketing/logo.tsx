import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * EuroscopeLogo — the official brand logo.
 *
 * Uses the modern Euroscope mark (gold laurel wreath + "E" monogram
 * on transparent background — no circle, no black bg). Premium,
 * clean, works on both light and dark surfaces.
 *
 * VARIANTS
 * =========
 *  - `mark`      — just the emblem icon (for navbar, header)
 *  - `full`      — the full logo with wordmark text (for footer, hero)
 *  - `markLight` — same as mark (kept for backwards compat — the new
 *                  transparent mark works on dark backgrounds natively)
 *
 * SIZES
 * ======
 *  - `sm`     — mark: h-7,  full: h-10
 *  - `default`— mark: h-9,  full: h-14
 *  - `lg`     — mark: h-12, full: h-20
 */
export function EuroscopeLogo({
  className,
  variant = "mark",
  showWordmark = true,
  size = "default",
}: {
  className?: string;
  variant?: "mark" | "full" | "markLight";
  showWordmark?: boolean;
  size?: "sm" | "default" | "lg";
}) {
  const sizes = {
    sm: { mark: "h-7 w-7", full: "h-10", text: "text-base" },
    default: { mark: "h-9 w-9", full: "h-14", text: "text-lg" },
    lg: { mark: "h-12 w-12", full: "h-20", text: "text-2xl" },
  };
  const s = sizes[size];

  // Full logo (emblem + wordmark text built into the image)
  if (variant === "full") {
    return (
      <div className={cn("relative", s.full, className)} style={{ aspectRatio: "1024 / 320" }}>
        <Image
          src="/euroscope-logo-full.png"
          alt="Euroscope"
          fill
          className="object-contain"
          priority
        />
      </div>
    );
  }

  // markLight + mark — both use the same transparent mark now.
  // The new logo has no background, so it works on any surface.
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={cn("relative overflow-hidden rounded-lg", s.mark)}>
        <Image
          src="/euroscope-mark.png"
          alt="Euroscope"
          fill
          className="object-contain"
          priority
        />
      </span>
      {showWordmark && (
        <span className={cn("font-display font-bold tracking-tight text-foreground", s.text)}>
          Euroscope
        </span>
      )}
    </span>
  );
}
