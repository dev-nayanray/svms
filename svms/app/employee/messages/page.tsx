import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, Filter } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { listConversations, type ConversationListFilters } from "@/lib/services/message-cases";
import { ConversationListClient } from "@/components/employee/messages/conversation-list-client";

export const dynamic = "force-dynamic";

export default async function EmployeeMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/messages");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
    if (!employee) redirect("/403");
    employeeId = employee.id;
  }
  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
  const canCreate = hasPermission(role, "messages.create");

  const sp = await searchParams;
  const filters: ConversationListFilters = {
    search: sp.search,
    studentId: sp.studentId,
    applicationId: sp.applicationId,
    unreadOnly: sp.unreadOnly === "true",
  };
  const page = sp.page ? Number(sp.page) : 1;
  const pageSize = sp.pageSize ? Number(sp.pageSize) : 20;

  let result;
  let loadError: string | null = null;
  try {
    result = await listConversations(scope, { filters, page, pageSize });
  } catch (err) {
    console.error("[employee/messages]", err);
    loadError = "Could not load conversations — server error.";
    result = { rows: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
  }

  // Pre-resolve the student-name search hint for the empty state.
  const studentHint = sp.studentId
    ? await prisma.student
        .findFirst({ where: { id: sp.studentId }, select: { firstName: true, lastName: true } })
        .then((s) => (s ? `${s.firstName} ${s.lastName}` : null))
        .catch(() => null)
    : null;

  const hasFilters = Boolean(sp.search || sp.unreadOnly);

  return (
    <div>
      <EmployeePageHeader
        title="Messages"
        description={
          loadError
            ? loadError
            : `${result.total} conversation${result.total === 1 ? "" : "s"}${sp.unreadOnly === "true" ? " · unread only" : ""}`
        }
      />

      <ConversationListClient
        initialRows={result.rows}
        initialPage={page}
        initialPageSize={pageSize}
        initialTotal={result.total}
        initialTotalPages={result.totalPages}
        initialSearch={sp.search ?? ""}
        initialUnreadOnly={sp.unreadOnly === "true"}
        initialStudentId={sp.studentId}
        canCreate={canCreate}
        studentHint={studentHint}
      />

      {/* Server-rendered, link-friendly fallback when client JS is disabled */}
      <noscript>
        <FilterBar
          search={sp.search ?? ""}
          unreadOnly={sp.unreadOnly === "true"}
          hasFilters={hasFilters}
        />
        {result.rows.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {hasFilters
                ? "No conversations match these filters."
                : "No conversations yet. When a student is assigned to you, their messages will appear here."}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {result.rows.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/employee/messages/${c.id}`}
                      className="flex items-center justify-between gap-3 p-4 hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {c.student.firstName} {c.student.lastName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.lastMessage?.body ?? c.subject ?? "No messages yet"}
                        </p>
                      </div>
                      {c.unreadCount > 0 && (
                        <Badge tone="info">{c.unreadCount}</Badge>
                      )}
                      <p className="text-xs text-muted-foreground">{formatDate(c.updatedAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </noscript>
    </div>
  );
}

function FilterBar({
  search,
  unreadOnly,
  hasFilters,
}: {
  search: string;
  unreadOnly: boolean;
  hasFilters: boolean;
}) {
  return (
    <form className="mb-4 flex flex-wrap items-center gap-2" method="get" action="/employee/messages">
      <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by student name, email, or subject…"
          aria-label="Search conversations"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input type="hidden" name="unreadOnly" value="false" />
        <input
          type="checkbox"
          name="unreadOnly"
          value="true"
          defaultChecked={unreadOnly}
          className="h-4 w-4 rounded border-input"
        />
        Unread only
      </label>
      <Button type="submit" variant="outline" size="sm">
        <Filter className="h-3.5 w-3.5" aria-hidden /> Filter
      </Button>
      {hasFilters && (
        <Link href="/employee/messages">
          <Button type="button" variant="ghost" size="sm">Clear</Button>
        </Link>
      )}
    </form>
  );
}
