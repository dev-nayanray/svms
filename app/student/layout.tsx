import { requireStudentProfile } from "@/lib/student/guard";
import { StudentAppShell } from "@/components/student/app-shell";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { StudentRealtimeProvider } from "@/components/student/realtime-provider";

export const dynamic = "force-dynamic";

/**
 * Student Panel shell. Only the STUDENT role may enter — enforced here,
 * server-side, before any page renders (plus the edge proxy in proxy.ts).
 *
 * The RealtimeProvider wraps the entire shell so that a single SSE
 * connection is shared across all student pages — navigating between
 * /student/messages and /student/documents does NOT re-establish the
 * connection.
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { name } = await requireStudentProfile();
  return (
    <StudentRealtimeProvider>
      <StudentAppShell userName={name}>
        {children}
        <PwaProvider />
      </StudentAppShell>
    </StudentRealtimeProvider>
  );
}
