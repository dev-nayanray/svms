"use client";

import { useState } from "react";

/** Passport numbers are sensitive: masked by default, revealed on explicit click. */
export function PassportValue({ passport }: { passport: string | null | undefined }) {
  const [revealed, setRevealed] = useState(false);
  if (!passport) return <span className="font-medium">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm font-medium">
        {revealed ? passport : `${passport.slice(0, 2)}${"•".repeat(Math.max(passport.length - 4, 0))}${passport.slice(-2)}`}
      </span>
      <button
        onClick={() => setRevealed(!revealed)}
        className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
        aria-label={revealed ? "Hide passport number" : "Reveal passport number"}
      >
        {revealed ? "Hide" : "Reveal"}
      </button>
    </span>
  );
}
