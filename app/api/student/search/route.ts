import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(2, "Query must be at least 2 characters").max(100, "Query too long"),
  limit: z.number().int().min(1).max(20).optional().default(8),
});

/**
 * GET /api/student/search?q=<query>&limit=8
 *
 * Unified search across the student's universe of content — runs 5
 * Prisma queries in parallel and groups results by type:
 *  - universities  (name / city / country name contains)
 *  - courses        (name contains)
 *  - documents      (name contains)
 *  - tasks          (title / description contains)
 *  - messages       (body contains, via conversation.studentId)
 *
 * Each result row contains:
 *  - id            — opaque string (the model's id)
 *  - title         — primary display text
 *  - subtitle      — secondary display text (location, status, etc.)
 *  - href          — link to the detail page
 *  - icon          — lucide icon name for the result type
 *
 * Security: every query is scoped by the caller's studentId (or
 * userId for messages), so students only ever see their own data.
 *
 * Performance: capped at `limit` per group (default 8), so the
 * worst-case payload is 5 × 8 = 40 rows. Universities are filtered
 * to ACTIVE / non-deleted only — students shouldn't see archived
 * universities in their search results.
 *
 * Returns 422 if the query is < 2 chars.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const sp = req.nextUrl.searchParams;
    const params = querySchema.parse({
      q: sp.get("q") ?? "",
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });

    const q = params.q;
    const limit = params.limit;
    const studentId = g.student.id;

    // Fire all 5 queries in parallel — total latency = max(latency),
    // not sum(latency). Each query is independent and scoped by the
    // caller's studentId or userId.
    const [universities, courses, documents, tasks, messages] = await Promise.all([
      // ── Universities — name / city / country.name contains ──
      // Filtered to ACTIVE / non-deleted so students don't see archived
      // universities in their search results.
      prisma.university.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          country: { deletedAt: null, status: "ACTIVE" },
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { country: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          city: true,
          country: { select: { name: true, flag: true } },
        },
        orderBy: { name: "asc" },
      }),

      // ── Courses — name contains ──
      // Filtered to ACTIVE / non-deleted + parent university + country
      // ACTIVE (the student-visibility chain).
      prisma.course.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          university: {
            deletedAt: null,
            status: "ACTIVE",
            country: { deletedAt: null, status: "ACTIVE" },
          },
          name: { contains: q, mode: "insensitive" },
        },
        take: limit,
        select: {
          id: true,
          name: true,
          degreeLevel: true,
          university: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      }),

      // ── Documents — name contains ──
      // Scoped by studentId. Excludes soft-deleted documents.
      prisma.document.findMany({
        where: {
          studentId,
          deletedAt: null,
          name: { contains: q, mode: "insensitive" },
        },
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          category: true,
        },
        orderBy: { updatedAt: "desc" },
      }),

      // ── Tasks — title / description contains ──
      // Scoped by studentId. Excludes soft-deleted + cancelled tasks.
      prisma.task.findMany({
        where: {
          studentId,
          deletedAt: null,
          status: { not: "CANCELLED" },
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
        },
        orderBy: { createdAt: "desc" },
      }),

      // ── Messages — body contains ──
      // Scoped via conversation.studentId. Returns the conversationId
      // + a preview of the body (truncated client-side) + the createdAt
      // so the UI can sort + dedupe.
      prisma.message.findMany({
        where: {
          conversation: { studentId },
          body: { contains: q, mode: "insensitive" },
        },
        take: limit,
        select: {
          id: true,
          body: true,
          createdAt: true,
          conversationId: true,
          senderId: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Format results into a unified shape per group.
    return ok({
      query: q,
      groups: {
        universities: universities.map((u) => ({
          id: u.id,
          title: u.name,
          subtitle: [u.city, u.country.name].filter(Boolean).join(", ") || undefined,
          href: `/student/universities/${u.id}`,
          icon: "Building2",
        })),
        courses: courses.map((c) => ({
          id: c.id,
          title: c.name,
          subtitle: `${c.degreeLevel} · ${c.university.name}`,
          href: `/student/courses/${c.id}`,
          icon: "GraduationCap",
        })),
        documents: documents.map((d) => ({
          id: d.id,
          title: d.name,
          subtitle: `${d.status}${d.category ? ` · ${d.category}` : ""}`,
          href: `/student/documents`,
          icon: "FileText",
        })),
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: `${t.status}${t.priority ? ` · ${t.priority}` : ""}`,
          href: `/student/tasks`,
          icon: "CheckSquare",
        })),
        messages: messages.map((m) => ({
          id: m.id,
          title: m.body.length > 60 ? m.body.slice(0, 60) + "…" : m.body,
          subtitle: undefined,
          href: `/student/messages/${m.conversationId}`,
          icon: "MessageSquare",
        })),
      },
      total: universities.length + courses.length + documents.length + tasks.length + messages.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
