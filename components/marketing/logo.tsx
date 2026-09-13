import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * EuroscopeLogo — the official brand logo.
 *
 * Uses the actual Euroscope emblem (a black circular badge with gold
 * laurel wreath, "EE" monogram, and "EUROSCOPE" wordmark — a premium
 * European heritage seal style).
 *
 * VARIANTS
 * =========
 *  - `mark`      — just the circular emblem (for navbar, header)
 *  - `full`      — the full logo with wordmark text (for footer, hero)
 *  - `markLight` — the emblem on a white rounded container (for dark backgrounds)
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
      <div className={cn("relative", s.full, className)} style={{ aspectRatio: "221 / 205" }}>
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

  // Mark on a white rounded container (for dark backgrounds)
  if (variant === "markLight") {
    return (
      <span className={cn("inline-flex items-center gap-2.5", className)}>
        <span className={cn("relative overflow-hidden rounded-full bg-white shadow-sm", s.mark)}>
          <Image
            src="/euroscope-mark.png"
            alt="Euroscope"
            fill
            className="object-cover object-top"
            priority
          />
        </span>
        {showWordmark && (
          <span className={cn("font-display font-bold tracking-tight text-white", s.text)}>
            Euroscope
          </span>
        )}
      </span>
    );
  }

  // Default: just the circular emblem (for light backgrounds like navbar)
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={cn("relative overflow-hidden rounded-full", s.mark)}>
        <Image
          src="/euroscope-mark.png"
          alt="Euroscope"
          fill
          className="object-cover object-top"
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
