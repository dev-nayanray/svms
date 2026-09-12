import { cn } from "@/lib/utils";

/**
 * EuroscopeLogo — the official brand mark.
 *
 * DESIGN RATIONALE
 * ================
 * The mark combines two European visual references:
 *  1. The circle — evokes the EU flag's ring of stars
 *  2. The upward arc + star — represents a student's journey rising
 *     toward a European future (the star = destination)
 *
 * The mark works at any size (16px favicon → 64px hero) because it
 * uses geometric primitives, not detailed illustration.
 *
 * COLOR VARIANTS
 * ==============
 *  - `default`: blue mark on transparent (for light backgrounds)
 *  - `light`: white mark (for dark backgrounds)
 *  - `solid`: blue square background with white mark (for compact
 *    placements like the navbar logo)
 */
export function EuroscopeLogo({
  className,
  variant = "default",
  showWordmark = true,
  size = "default",
}: {
  className?: string;
  variant?: "default" | "light" | "solid";
  showWordmark?: boolean;
  size?: "sm" | "default" | "lg";
}) {
  const sizes = {
    sm: { mark: "h-7 w-7", icon: "h-4 w-4", text: "text-base" },
    default: { mark: "h-9 w-9", icon: "h-5 w-5", text: "text-lg" },
    lg: { mark: "h-12 w-12", icon: "h-7 w-7", text: "text-2xl" },
  };
  const s = sizes[size];

  const markBg = {
    default: "bg-transparent text-primary",
    light: "bg-transparent text-white",
    solid: "bg-primary text-primary-foreground",
  };

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-xl transition-transform hover:scale-105",
          s.mark,
          markBg[variant],
        )}
      >
        <svg viewBox="0 0 24 24" className={s.icon} fill="none" aria-hidden>
          {/* Outer ring — EU star circle reference */}
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          {/* Upward arc — student journey rising */}
          <path
            d="M4 15c2.5-5 6-7.5 8-7.5s5.5 2.5 8 7.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Star — European destination */}
          <path
            d="M12 3l1.4 4.3h4.6l-3.7 2.7 1.4 4.3-3.7-2.7-3.7 2.7 1.4-4.3-3.7-2.7h4.6z"
            fill="currentColor"
          />
        </svg>
      </span>
      {showWordmark && (
        <span className={cn("font-display font-bold tracking-tight", s.text)}>
          Euroscope
        </span>
      )}
    </span>
  );
}
