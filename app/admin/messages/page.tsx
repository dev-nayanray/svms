import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const conversations = await prisma.conversation.findMany({
    include: {
      student: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader
        title="Messages"
        description="Student ↔ counselor conversations."
        breadcrumbs={["Admin", "Messages"]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <EmptyState
              title="No conversations yet"
              description="Conversations are created when a student messages their counselor."
            />
          ) : (
            <ul className="divide-y divide-border">
              {conversations.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.student.firstName} {c.student.lastName}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {c._count.messages} message{c._count.messages === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.messages[0]?.body ?? "—"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(c.lastMessageAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            TODO: full messaging UI (compose, read/unread, attachments) is planned — see
            DEVELOPMENT.md. Conversation data model is live.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
