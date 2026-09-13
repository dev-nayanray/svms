/**
 * Date-range helpers for the Employee Dashboard.
 *
 * The dashboard supports six presets (Today / 7 Days / 30 Days / 90 Days /
 * This Year / Custom Range) and a custom range with explicit `from` / `to`
 * ISO strings. All math is done in the configured timezone so "Today" means
 * the user's calendar day, not the UTC day.
 *
 * Timezone handling:
 *  • Default TZ is `UTC` for server-side determinism (no DST surprises).
 *  • The employee's TZ can be passed via `?tz=Asia/Dhaka` query string;
 *    `Intl.supportedValuesOf("timeZone")` validates it before use so a
 *    malicious `tz` value can never reach `Intl.DateTimeFormat`.
 *  • All returned `from` / `to` are UTC `Date` instances (Prisma stores
 *    `DateTime` as UTC) — the TZ only affects how we compute the start of
 *    "today" and the end of "this year".
 */

export const DASHBOARD_RANGE_PRESETS = [
  "today",
  "7d",
  "30d",
  "90d",
  "year",
  "custom",
] as const;

export type DashboardRangePreset = (typeof DASHBOARD_RANGE_PRESETS)[number];

export const DASHBOARD_RANGE_LABELS: Record<DashboardRangePreset, string> = {
  today: "Today",
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "90 Days",
  year: "This Year",
  custom: "Custom Range",
};

export type ResolvedRange = {
  preset: DashboardRangePreset;
  from: Date;
  to: Date;
  /** Display string for the active filter chip, e.g. "Today" or "Aug 1 – Aug 31". */
  label: string;
};

/** Safe TZ whitelist — falls back to UTC if the input is missing or invalid. */
function safeTimezone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  // Node 18+ supports Intl.supportedValuesOf. If unavailable, fall back to UTC
  // rather than risk a RangeError inside Intl.DateTimeFormat.
  try {
    const supported = (Intl as unknown as {
      supportedValuesOf?: (k: string) => string[];
    }).supportedValuesOf?.("timeZone");
    if (supported && supported.includes(tz)) return tz;
  } catch {
    /* ignore — fall through to UTC */
  }
  return "UTC";
}

/** Returns the parts (year, month, day, hour, minute) of `d` as observed in `tz`. */
function partsIn(d: Date, tz: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) === 24 ? 0 : Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/**
 * Build a Date for "start of the calendar day containing `d` in `tz`",
 * returned as a UTC Date instance suitable for Prisma `gte` filters.
 */
function startOfDayIn(d: Date, tz: string): Date {
  const p = partsIn(d, tz);
  // Construct a UTC Date representing midnight on that local calendar day,
  // then shift by the tz offset so it really represents "00:00 in tz".
  const utcMidnight = new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0));
  const offsetMs = getOffsetMs(utcMidnight, tz);
  return new Date(utcMidnight.getTime() - offsetMs);
}

function endOfDayIn(d: Date, tz: string): Date {
  const start = startOfDayIn(d, tz);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function getOffsetMs(d: Date, tz: string): number {
  // Returns tz offset (in ms) at the given UTC instant. Positive = east of UTC.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
  return asUTC - d.getTime();
}

/**
 * Resolve a dashboard range from query-string params. Defaults to "30d" when
 * no preset is supplied. For `custom`, both `from` and `to` ISO strings are
 * required; an invalid range falls back to "30d" so the dashboard never
 * crashes on bad input.
 *
 * Pure function — no DB access — so the same calc runs in tests.
 */
export function resolveDashboardRange(params: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  tz?: string | null;
  now?: Date; // injectable for tests
}): ResolvedRange {
  const tz = safeTimezone(params.tz);
  const now = params.now ?? new Date();

  const preset: DashboardRangePreset = (DASHBOARD_RANGE_PRESETS as readonly string[]).includes(params.preset ?? "")
    ? (params.preset as DashboardRangePreset)
    : "30d";

  if (preset === "custom") {
    const fromRaw = params.from ? new Date(params.from) : null;
    const toRaw = params.to ? new Date(params.to) : null;
    if (!fromRaw || !toRaw || isNaN(fromRaw.getTime()) || isNaN(toRaw.getTime()) || fromRaw > toRaw) {
      // Invalid custom range → fall back to 30d so the page still renders.
      return resolveDashboardRange({ preset: "30d", tz, now });
    }
    return {
      preset,
      from: fromRaw,
      to: toRaw,
      label: `${formatShort(fromRaw)} – ${formatShort(toRaw)}`,
    };
  }

  if (preset === "today") {
    const from = startOfDayIn(now, tz);
    const to = endOfDayIn(now, tz);
    return { preset, from, to, label: "Today" };
  }

  if (preset === "year") {
    const p = partsIn(now, tz);
    const from = new Date(Date.UTC(p.year, 0, 1));
    const to = new Date(Date.UTC(p.year, 11, 31, 23, 59, 59, 999));
    return { preset, from, to, label: String(p.year) };
  }

  // Rolling window presets — "7d", "30d", "90d"
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    preset,
    from,
    to: now,
    label: `Last ${days} days`,
  };
}

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Build a Prisma `where` fragment for a DateTime column constrained to the
 * resolved range. Returns `{ col: { gte: from, lte: to } }` so callers can
 * spread it into an existing `where` clause.
 *
 * Example:
 *   const range = resolveDashboardRange({ preset: "30d" });
 *   prisma.task.findMany({ where: { ...dateRangeWhere("dueDate", range), assignedToId: userId } });
 */
export function dateRangeWhere(col: string, range: ResolvedRange): Record<string, unknown> {
  return {
    [col]: {
      gte: range.from,
      lte: range.to,
    },
  } as Record<string, unknown>;
}
