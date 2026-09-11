import { prisma } from "@/lib/db";
import { TableShell, Pagination, StatusBadge, EmptyState } from "@/components/shared";

export async function UniversitiesList({
  page = 1,
  search,
  basePath,
}: {
  page?: number;
  search?: string;
  basePath: string;
}) {
  const pageSize = 20;
  const where = {
    deletedAt: null,
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const [universities, total] = await Promise.all([
    prisma.university.findMany({
      where,
      include: { country: true, _count: { select: { courses: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.university.count({ where }),
  ]);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <>
      <form className="flex flex-wrap gap-2" action={basePath}>
        <input
          name="search"
          defaultValue={search}
          placeholder="Search universities…"
          className="h-9 flex-1 min-w-48 rounded-md border border-border bg-card px-3 text-sm"
          aria-label="Search universities"
        />
        <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Search</button>
      </form>

      {universities.length === 0 ? (
        <EmptyState title="No universities found" />
      ) : (
        <TableShell headers={["Name", "Country", "Courses", "Application Fee", "Status"]}>
          {universities.map((u) => (
            <tr key={u.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5 font-medium">{u.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{u.country.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{u._count.courses}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{u.applicationFee ? `$${u.applicationFee}` : "—"}</td>
              <td className="px-4 py-2.5"><StatusBadge status={u.status} /></td>
            </tr>
          ))}
        </TableShell>
      )}
      <Pagination page={page} totalPages={totalPages} basePath={basePath} query={{ search }} />
    </>
  );
}
