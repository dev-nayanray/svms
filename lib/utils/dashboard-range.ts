/**
 * Pure date-range resolution for the admin dashboard.
 * Extracted so it can be unit-tested without a request or database.
 */

export const DASHBOARD_RANGES = ["today", "7d", "30d", "90d", "year"] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

const RANGE_DAYS: Record<DashboardRange, number> = {
  today: 0,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  year: 365,
};

export type ResolvedRange = {
  /** Inclusive lower bound for period-scoped metrics. */
  from: Date;
  /** Label for display/debug. */
  label: string;
};

/**
 * Resolve a dashboard range from either a preset (`range=today|7d|30d|90d|year`)
 * or an explicit custom window (`from=ISO&to=ISO`).
 *
 * - presets are anchored to now (today = start of the current local day)
 * - custom `from`/`to` must form a valid ordered window; invalid input falls
 *   back to the provided default preset
 */
export function resolveRange(
  params: { range?: string | null; from?: string | null; to?: string | null },
  fallback: DashboardRange = "30d"
): ResolvedRange {
  const hasCustom = !!(params.from || params.to);

  if (hasCustom) {
    const to = params.to ? new Date(params.to) : new Date();
    const from = params.from ? new Date(params.from) : new Date(to.getTime() - 30 * 86400_000);
    const valid =
      !Number.isNaN(from.getTime()) &&
      !Number.isNaN(to.getTime()) &&
      from.getTime() <= to.getTime();
    if (valid) {
      // include the whole "to" day
      const toEnd = new Date(to);
      toEnd.setHours(23, 59, 59, 999);
      return { from, label: `${from.toISOString().slice(0, 10)} → ${toEnd.toISOString().slice(0, 10)}` };
    }
  }

  const preset = (DASHBOARD_RANGES as readonly string[]).includes(params.range ?? "")
    ? (params.range as DashboardRange)
    : fallback;
  const days = RANGE_DAYS[preset];
  const from =
    days === 0
      ? new Date(new Date().setHours(0, 0, 0, 0))
      : new Date(Date.now() - days * 86400_000);
  return { from, label: preset };
}
