import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EmployeeMessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/messages");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  // Case ownership: EMPLOYEE sees conversations on students assigned to them.
  const isAdmin = role === "ADMIN";
  const where = isAdmin ? {} : { student: { assignedEmployee: { userId: session.user.id } } };

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { student: { select: { firstName: true, lastName: true } } },
  });

  return (
    <div>
      <EmployeePageHeader
        title="Messages"
        description="Conversations with your assigned students."
      />
      <Card>
        <CardContent className="p-0">
          {conversations.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {conversations.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">
                      {c.student.firstName} {c.student.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.subject ?? "No subject"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(c.updatedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
