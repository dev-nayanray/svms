import { prisma } from "@/lib/db";
import { TableShell, Pagination, StatusBadge, EmptyState } from "@/components/shared";
import { formatDate } from "@/lib/utils";
import { ReviewActions } from "./review-actions";

export async function DocumentsList({
  page = 1,
  status,
  basePath,
  studentUserId,
  canReview,
}: {
  page?: number;
  status?: string;
  basePath: string;
  studentUserId?: string;
  canReview: boolean;
}) {
  const pageSize = 20;
  let studentId: string | undefined;
  if (studentUserId) {
    const student = await prisma.student.findUnique({ where: { userId: studentUserId } });
    studentId = student?.id ?? "none";
  }
  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(studentId ? { studentId } : {}),
  };
  const [docs, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { student: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.document.count({ where }),
  ]);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <>
      <form className="flex flex-wrap gap-2" action={basePath}>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {["REQUESTED", "UPLOADED", "UNDER_REVIEW", "APPROVED", "REJECTED", "EXPIRED"].map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Filter</button>
      </form>

      {docs.length === 0 ? (
        <EmptyState title="No documents found" />
      ) : (
        <TableShell headers={["Name", "Student", "Status", "Uploaded", "Reviewed", ...(canReview ? ["Actions"] : [])]}>
          {docs.map((d) => (
            <tr key={d.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5 font-medium">{d.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {d.student.firstName} {d.student.lastName}
              </td>
              <td className="px-4 py-2.5"><StatusBadge status={d.status} /></td>
              <td className="px-4 py-2.5 text-muted-foreground">{formatDate(d.uploadedAt)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{formatDate(d.reviewedAt)}</td>
              {canReview && (
                <td className="px-4 py-2.5">
                  {(d.status === "UPLOADED" || d.status === "UNDER_REVIEW" || d.status === "REJECTED") && (
                    <ReviewActions documentId={d.id} />
                  )}
                </td>
              )}
            </tr>
          ))}
        </TableShell>
      )}
      <Pagination page={page} totalPages={totalPages} basePath={basePath} query={{ status }} />
    </>
  );
}
