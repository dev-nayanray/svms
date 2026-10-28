import { prisma } from "@/lib/db";

/**
 * Atomic, monotonic sequence numbers for human-facing IDs
 * (STD-YYYY-NNNNNN, SV-YYYY-NNNNNN, INV-YYYY-NNNNN).
 *
 * The old implementation derived the next number from `prisma.<model>.count()`,
 * which broke two ways:
 *  1. Two concurrent creates read the same count and generated a duplicate ID,
 *     rejected by the unique constraint as an opaque HTTP 500.
 *  2. The count includes soft-deleted rows, so numbers drifted and could
 *     collide with tombstoned records after data cleanup.
 *
 * `min` lets a caller declare "never go below this number" (current max in the
 * table + 1), which self-heals environments where records already exist but
 * the Counter document does not.
 */
const MAX_RETRIES = 5;

export async function nextSequence(key: string, min = 1): Promise<number> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const counter = await prisma.counter.upsert({
        where: { key },
        create: { key, value: Math.max(1, min) },
        update: { value: { increment: 1 } },
      });
      if (counter.value >= min) return counter.value;

      // Counter exists but is behind existing data — fast-forward it once.
      // A concurrent writer may have already moved it; the loop re-reads.
      const bumped = await prisma.counter.update({
        where: { key },
        data: { value: Math.max(min, counter.value + 1) },
      });
      if (bumped.value >= min) return bumped.value;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      // P2002 = concurrent upsert raced creating the same key;
      // P1001/P1002/P2034 = transient connection/transaction errors.
      if (code !== "P2002" && code !== "P1001" && code !== "P1002" && code !== "P2034") {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
    }
  }
  throw new Error(`Could not allocate sequence for "${key}" after ${MAX_RETRIES} attempts`);
}

/**
 * Highest used numeric suffix for a zero-padded, prefixed human ID such as
 * `STD-2026-`. Zero padding keeps lexicographic order equal to numeric order,
 * so one indexed lookup replaces scanning the whole collection. Returns 0
 * when no record carries the prefix.
 */
export async function maxSuffixOfPrefix(
  model: "student" | "application" | "invoice",
  field: "studentId" | "applicationNumber" | "invoiceNumber",
  prefix: string
): Promise<number> {
  // @ts-expect-error — prisma union keys can't be indexed with a correlated tuple
  const row = await prisma[model].findFirst({
    where: { [field]: { startsWith: prefix } },
    orderBy: { [field]: "desc" },
    select: { [field]: true },
  });
  const value = row?.[field] as string | undefined;
  if (!value) return 0;
  const n = parseInt(value.slice(prefix.length), 10);
  return Number.isFinite(n) ? n : 0;
}
