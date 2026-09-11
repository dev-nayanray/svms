import { prisma } from "@/lib/db";
import { TableShell, Pagination, StatusBadge, EmptyState } from "@/components/shared";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export async function StudentsList({
  page = 1,
  search,
  status,
  basePath,
  employeeUserId,
}: {
  page?: number;
  search?: string;
  status?: string;
  basePath: string;
  employeeUserId?: string;
}) {
  const pageSize = 20;
  let employeeId: string | undefined;
  if (employeeUserId) {
    const emp = await prisma.employee.findUnique({ where: { userId: employeeUserId } });
    employeeId = emp?.id ?? "none";
  }
  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(employeeId ? { assignedEmployeeId: employeeId } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { studentId: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { employee: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.student.count({ where }),
  ]);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <>
      <SearchBar basePath={basePath} search={search} status={status} />
      {students.length === 0 ? (
        <EmptyState title="No students found" description="Try adjusting your search." />
      ) : (
        <TableShell headers={["Student ID", "Name", "Email", "Counselor", "Status", "Created"]}>
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5 font-mono text-xs">{s.studentId}</td>
              <td className="px-4 py-2.5">
                <Link href={`${basePath}/${s.id}`} className="font-medium text-primary hover:underline">
                  {s.firstName} {s.lastName}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{s.email}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{s.employee?.user.name ?? "—"}</td>
              <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
              <td className="px-4 py-2.5 text-muted-foreground">{formatDate(s.createdAt)}</td>
            </tr>
          ))}
        </TableShell>
      )}
      <Pagination page={page} totalPages={totalPages} basePath={basePath} query={{ search, status }} />
    </>
  );
}

function SearchBar({ basePath, search, status }: { basePath: string; search?: string; status?: string }) {
  return (
    <form className="flex flex-wrap gap-2" action={basePath}>
      <input
        name="search"
        defaultValue={search}
        placeholder="Search students…"
        className="h-9 flex-1 min-w-48 rounded-md border border-border bg-card px-3 text-sm"
        aria-label="Search students"
      />
      <select
        name="status"
        defaultValue={status ?? ""}
        className="h-9 rounded-md border border-border bg-card px-3 text-sm"
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
      </select>
      <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground" type="submit">
        Search
      </button>
    </form>
  );
}
