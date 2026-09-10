import { prisma } from "@/lib/db";
import { TableShell, Pagination, StatusBadge, EmptyState } from "@/components/shared";
import { ConvertLeadButton } from "./convert-lead-button";
import { formatDate } from "@/lib/utils";

export async function LeadsList({
  page = 1,
  search,
  status,
  basePath,
}: {
  page?: number;
  search?: string;
  status?: string;
  basePath: string;
}) {
  const pageSize = 20;
  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { employee: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <>
      <form className="flex flex-wrap gap-2" action={basePath}>
        <input
          name="search"
          defaultValue={search}
          placeholder="Search leads…"
          className="h-9 flex-1 min-w-48 rounded-md border border-border bg-card px-3 text-sm"
          aria-label="Search leads"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {["NEW", "CONTACTED", "COUNSELING", "QUALIFIED", "CONVERTED", "LOST"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Search</button>
      </form>

      {leads.length === 0 ? (
        <EmptyState title="No leads found" />
      ) : (
        <TableShell headers={["Name", "Phone", "Email", "Source", "Assigned To", "Status", "Created", ""]}>
          {leads.map((l) => (
            <tr key={l.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5 font-medium">{l.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{l.phone ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{l.email ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{l.source ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{l.employee?.user.name ?? "—"}</td>
              <td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
              <td className="px-4 py-2.5 text-muted-foreground">{formatDate(l.createdAt)}</td>
              <td className="px-4 py-2.5">
                {l.status !== "CONVERTED" && l.email && <ConvertLeadButton leadId={l.id} />}
              </td>
            </tr>
          ))}
        </TableShell>
      )}
      <Pagination page={page} totalPages={totalPages} basePath={basePath} query={{ search, status }} />
    </>
  );
}
