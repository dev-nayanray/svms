"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type BrandSettings = {
  logoUrl: string;
  logoLightUrl: string;
  logoFullUrl: string;
  brandName: string;
  tagline: string;
  primaryColor: string;
  contactEmail: string;
  contactPhone: string;
};

/**
 * useBrandSettings — client-side hook that fetches brand settings
 * from /api/brand. Cached for 5 minutes (staleTime) since brand
 * settings rarely change.
 */
export function useBrandSettings() {
  const { data } = useQuery<BrandSettings>({
    queryKey: ["/api/brand"],
    queryFn: () => apiFetch<BrandSettings>("/api/brand"),
    staleTime: 5 * 60_000,
  });
  return data;
}

// Inline import to avoid circular dependency
import { apiFetch } from "@/lib/api-client";

/**
 * EuroscopeLogo — the brand logo component.
 *
 * Uses dynamic brand settings from /api/brand when available, falling
 * back to the hardcoded defaults (/euroscope-mark.png) while loading
 * or if the API is unreachable.
 *
 * VARIANTS
 * =========
 *  - `mark`      — just the logo icon (for navbar, header)
 *  - `full`      — the full logo with wordmark text
 *  - `markLight` — logo for dark backgrounds (uses logoLightUrl)
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
  const brand = useBrandSettings();

  const sizes = {
    sm: { mark: "h-7 w-7", full: "h-10", text: "text-base" },
    default: { mark: "h-9 w-9", full: "h-14", text: "text-lg" },
    lg: { mark: "h-12 w-12", full: "h-20", text: "text-2xl" },
  };
  const s = sizes[size];

  // Resolve the logo URL based on variant
  const logoUrl =
    variant === "markLight"
      ? brand?.logoLightUrl ?? "/euroscope-mark.png"
      : variant === "full"
        ? brand?.logoFullUrl ?? "/euroscope-logo-full.png"
        : brand?.logoUrl ?? "/euroscope-mark.png";

  const brandName = brand?.brandName ?? "Euroscope";
  const textColor = variant === "markLight" ? "text-white" : "text-foreground";

  // Full logo (emblem + wordmark image)
  if (variant === "full") {
    return (
      <div className={cn("relative", s.full, className)} style={{ aspectRatio: "1024 / 320" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={brandName}
          className="h-full w-full object-contain"
          loading="eager"
        />
      </div>
    );
  }

  // mark + markLight — logo icon + optional wordmark text
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={cn("relative overflow-hidden rounded-lg", s.mark)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={brandName}
          className="h-full w-full object-contain"
          loading="eager"
        />
      </span>
      {showWordmark && (
        <span className={cn("font-display font-bold tracking-tight", textColor, s.text)}>
          {brandName}
        </span>
      )}
    </span>
  );
}
