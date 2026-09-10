import { prisma } from "@/lib/db";
import { TableShell, Pagination, StatusBadge, EmptyState } from "@/components/shared";
import { titleCase } from "@/lib/utils";
import Link from "next/link";

export async function ApplicationsList({
  page = 1,
  search,
  stage,
  basePath,
  studentUserId,
  employeeUserId,
}: {
  page?: number;
  search?: string;
  stage?: string;
  basePath: string;
  studentUserId?: string;
  employeeUserId?: string;
}) {
  const pageSize = 20;
  let employeeId: string | undefined;
  if (employeeUserId) {
    const emp = await prisma.employee.findUnique({ where: { userId: employeeUserId } });
    employeeId = emp?.id ?? "none";
  }
  const studentId = studentUserId
    ? (await prisma.student.findUnique({ where: { userId: studentUserId } }))?.id ?? "none"
    : undefined;
  const where = {
    deletedAt: null,
    ...(stage ? { stageKey: stage } : {}),
    ...(studentId ? { studentId } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(search ? { applicationNumber: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const [apps, total, stages] = await Promise.all([
    prisma.application.findMany({
      where,
      include: { student: true, country: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.application.count({ where }),
    prisma.applicationStage.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <>
      <form className="flex flex-wrap gap-2" action={basePath}>
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by application number…"
          className="h-9 flex-1 min-w-48 rounded-md border border-border bg-card px-3 text-sm"
          aria-label="Search applications"
        />
        <select
          name="stage"
          defaultValue={stage ?? ""}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          aria-label="Filter by stage"
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.key}>{titleCase(s.name)}</option>
          ))}
        </select>
        <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Search</button>
      </form>

      {apps.length === 0 ? (
        <EmptyState title="No applications found" />
      ) : (
        <TableShell headers={["Number", "Student", "Country", "Stage", "Status", "Updated"]}>
          {apps.map((a) => (
            <tr key={a.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5">
                <Link href={`${basePath}/${a.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                  {a.applicationNumber}
                </Link>
              </td>
              <td className="px-4 py-2.5">{a.student.firstName} {a.student.lastName}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{a.country.name}</td>
              <td className="px-4 py-2.5"><StatusBadge status={a.stageKey} /></td>
              <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
              <td className="px-4 py-2.5 text-muted-foreground">{new Date(a.updatedAt).toLocaleDateString("en-GB")}</td>
            </tr>
          ))}
        </TableShell>
      )}
      <Pagination page={page} totalPages={totalPages} basePath={basePath} query={{ search, stage }} />
    </>
  );
}
