import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Button } from "@/components/ui";
import { requireConversation, type ConversationDetail } from "@/lib/services/message-cases";
import { ChatClient } from "@/components/employee/messages/chat-client";

export const dynamic = "force-dynamic";

export default async function EmployeeConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
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
  const canSend = hasPermission(role, "messages.create");
  const callerUserId = session.user.id;

  const { conversationId } = await params;
  let conversation: ConversationDetail;
  try {
    conversation = await requireConversation(scope, conversationId);
  } catch {
    notFound();
  }

  return (
    <div>
      <Link
        href="/employee/messages"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden /> Back to Messages
      </Link>

      <EmployeePageHeader
        title={`${conversation.student.firstName} ${conversation.student.lastName}`}
        description={
          conversation.application
            ? `${conversation.student.email} · ${conversation.student.studentId} · ${conversation.application.applicationNumber}`
            : `${conversation.student.email} · ${conversation.student.studentId}`
        }
        actions={
          <div className="flex items-center gap-2">
            {conversation.application && (
              <Link href={`/employee/applications/${conversation.application.id}`}>
                <Button variant="outline" size="sm">View application</Button>
              </Link>
            )}
            <Link href={`/employee/students/${conversation.student.id}`}>
              <Button variant="outline" size="sm">
                <UserRound className="h-3.5 w-3.5" aria-hidden /> View student
              </Button>
            </Link>
          </div>
        }
      />

      <ChatClient
        conversationId={conversation.id}
        initialMessages={conversation.messages}
        callerUserId={callerUserId}
        studentName={`${conversation.student.firstName} ${conversation.student.lastName}`}
        canSend={canSend}
      />
    </div>
  );
}
