import { requireStudentProfile } from "@/lib/student/guard";
import { StudentAppShell } from "@/components/student/app-shell";
import { PwaProvider } from "@/components/pwa/pwa-provider";

export const dynamic = "force-dynamic";

/**
 * Student Panel shell. Only the STUDENT role may enter — enforced here,
 * server-side, before any page renders (plus the edge proxy in proxy.ts).
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { name } = await requireStudentProfile();
  return (
    <StudentAppShell userName={name}>
      {children}
      <PwaProvider />
    </StudentAppShell>
  );
}
