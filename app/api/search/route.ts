import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

const LIMIT = 8;

/** Global search across the core entities (permission-scoped, admin/staff only). */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("search.read");
    if (g.error) return g.error;
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return ok({ data: [] });

    const contains = { contains: q, mode: "insensitive" as const };
    const [students, applications, universities, leads, invoices] = await Promise.all([
      prisma.student.findMany({
        where: {
          deletedAt: null,
          OR: [{ firstName: contains }, { lastName: contains }, { email: contains }, { studentId: contains }],
        },
        take: LIMIT,
      }),
      prisma.application.findMany({
        where: { deletedAt: null, applicationNumber: contains },
        take: LIMIT,
      }),
      prisma.university.findMany({ where: { deletedAt: null, name: contains }, take: LIMIT }),
      prisma.lead.findMany({ where: { deletedAt: null, name: contains }, take: LIMIT }),
      prisma.invoice.findMany({ where: { deletedAt: null, invoiceNumber: contains }, take: LIMIT }),
    ]);

    const data = [
      ...students.map((s) => ({
        type: "Student",
        id: s.id,
        title: `${s.firstName} ${s.lastName}`,
        subtitle: s.studentId,
        href: `/admin/students/${s.id}`,
      })),
      ...applications.map((a) => ({
        type: "Application",
        id: a.id,
        title: a.applicationNumber,
        subtitle: a.stageKey.replace(/_/g, " ").toLowerCase(),
        href: `/admin/applications/${a.id}`,
      })),
      ...universities.map((u) => ({
        type: "University",
        id: u.id,
        title: u.name,
        href: `/admin/universities/${u.id}`,
      })),
      ...leads.map((l) => ({
        type: "Lead",
        id: l.id,
        title: l.name,
        subtitle: l.status,
        href: `/admin/leads`,
      })),
      ...invoices.map((i) => ({
        type: "Invoice",
        id: i.id,
        title: i.invoiceNumber,
        subtitle: i.status,
        href: `/admin/invoices/${i.id}`,
      })),
    ];
    return ok({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
