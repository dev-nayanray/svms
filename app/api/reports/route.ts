import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const g = await guard("reports.read");
    if (g.error) return g.error;
    
    const [totalStudents, activeApplications, newLeads, visaSubmitted, visaApproved, visaRefused, pendingDocuments, outstandingPayments] =
      await Promise.all([
        prisma.student.count({ where: { deletedAt: null } }),
        prisma.application.count({ where: { deletedAt: null, status: "ACTIVE" } }),
        prisma.lead.count({ where: { deletedAt: null, status: "NEW" } }),
        prisma.application.count({ where: { deletedAt: null, stageKey: { in: ["VISA_SUBMITTED", "BIOMETRICS", "INTERVIEW"] } } }),
        prisma.application.count({ where: { deletedAt: null, stageKey: "COMPLETED" } }),
        prisma.application.count({ where: { deletedAt: null, stageKey: "VISA_DECISION", status: "CANCELLED" } }),
        prisma.document.count({ where: { deletedAt: null, status: { in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] } } }),
        prisma.invoice.aggregate({ where: { deletedAt: null, status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] } }, _sum: { dueAmount: true } }),
      ]);

    const byCountry = await prisma.application.groupBy({
      by: ["countryId"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const byStage = await prisma.application.groupBy({
      by: ["stageKey"],
      where: { deletedAt: null },
      _count: { _all: true },
    });

    return ok({
      totals: {
        totalStudents,
        activeApplications,
        newLeads,
        visaSubmitted,
        visaApproved,
        visaRefused,
        pendingDocuments,
        outstandingPayments: outstandingPayments._sum.dueAmount ?? 0,
      },
      byCountry,
      byStage,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
