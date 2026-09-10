import { prisma } from "@/lib/db";
import { TableShell, Pagination, EmptyState } from "@/components/shared";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; degreeLevel?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const pageSize = 20;
  const where = {
    deletedAt: null,
    status: "ACTIVE",
    ...(sp.degreeLevel ? { degreeLevel: sp.degreeLevel } : {}),
    ...(sp.search ? { name: { contains: sp.search, mode: "insensitive" as const } } : {}),
  };
  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: { university: { include: { country: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.course.count({ where }),
  ]);
  return (
    <>
      <h1 className="text-xl font-semibold">Course Search</h1>
      <form className="flex flex-wrap gap-2" action="/employee/courses">
        <input
          name="search"
          defaultValue={sp.search}
          placeholder="Search courses…"
          className="h-9 flex-1 min-w-48 rounded-md border border-border bg-card px-3 text-sm"
          aria-label="Search courses"
        />
        <select
          name="degreeLevel"
          defaultValue={sp.degreeLevel ?? ""}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          aria-label="Degree level"
        >
          <option value="">All levels</option>
          {["FOUNDATION", "BACHELOR", "MASTER", "PHD", "DIPLOMA"].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Search</button>
      </form>
      {courses.length === 0 ? (
        <EmptyState title="No courses found" />
      ) : (
        <TableShell headers={["Course", "University", "Country", "Level", "Tuition", "English Req."]}>
          {courses.map((c) => (
            <tr key={c.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5 font-medium">{c.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{c.university.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{c.university.country.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{c.degreeLevel}</td>
              <td className="px-4 py-2.5">{formatMoney(c.tuitionFee ?? undefined, c.currency)}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.englishRequirements ?? "—"}</td>
            </tr>
          ))}
        </TableShell>
      )}
      <Pagination
        page={page}
        totalPages={Math.max(Math.ceil(total / pageSize), 1)}
        basePath="/employee/courses"
        query={{ search: sp.search, degreeLevel: sp.degreeLevel }}
      />
    </>
  );
}
