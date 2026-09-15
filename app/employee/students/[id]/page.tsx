import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { documentCompletion, paymentStatus } from "@/lib/utils/student-insights";
import { StudentDetailTabs, type StudentDetailData } from "@/components/admin/student-detail-tabs";

export const dynamic = "force-dynamic";

export default async function Student360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!employee) redirect("/403");

  // Employees can only open Student 360 for students assigned to them
  // (admins use the /admin panel where all students are visible).
  const student = await prisma.student.findFirst({
    where: { id, deletedAt: null, assignedEmployeeId: employee.id },
    include: {
      user: true,
      employee: { include: { user: true, branch: true } },
      branch: true,
      academicRecords: true,
      englishProficiencies: true,
      applications: {
        where: { deletedAt: null },
        include: {
          country: true,
          statusHistory: { orderBy: { createdAt: "desc" }, take: 20 },
        },
        orderBy: { createdAt: "desc" },
      },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      invoices: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      tasks: { orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] },
      conversations: { include: { employee: { include: { user: true } } }, orderBy: { lastMessageAt: "desc" } },
    },
  });
  if (!student) notFound();

  const docs = documentCompletion(student.documents);
  const pay = paymentStatus(student.invoices);
  const fullName = `${student.firstName} ${student.lastName}`;

  const data: StudentDetailData = {
    id: student.id,
    studentId: student.studentId,
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    phone: student.phone,
    whatsapp: student.whatsapp,
    dateOfBirth: student.dateOfBirth,
    gender: student.gender,
    nationality: student.nationality,
    address: student.address,
    city: student.city,
    country: student.country,
    passportNumber: student.passportNumber,
    passportIssueDate: student.passportIssueDate,
    passportExpiryDate: student.passportExpiryDate,
    passportIssuingCountry: student.passportIssuingCountry,
    emergencyContactName: student.emergencyContactName,
    emergencyContactPhone: student.emergencyContactPhone,
    emergencyContactRelation: student.emergencyContactRelation,
    profilePhotoUrl: student.profilePhotoUrl,
    status: student.status,
    createdAt: student.createdAt,
    branch: student.branch ? { id: student.branch.id, name: student.branch.name } : null,
    employee: student.employee ? {
      id: student.employee.id,
      user: { name: student.employee.user.name, email: student.employee.user.email },
      title: student.employee.title,
    } : null,
    academicRecords: student.academicRecords.map((r) => ({
      id: r.id, level: r.level, institution: r.institution, group: r.group, result: r.result, passingYear: r.passingYear,
    })),
    englishProficiencies: student.englishProficiencies.map((e) => ({
      id: e.id, testType: e.testType, overallScore: e.overallScore, testDate: e.testDate,
    })),
    applications: student.applications.map((a) => ({
      id: a.id, applicationNumber: a.applicationNumber, stageKey: a.stageKey, status: a.status, createdAt: a.createdAt,
      country: { name: a.country.name },
      statusHistory: a.statusHistory.map((h) => ({
        id: h.id, fromStage: h.fromStage, toStage: h.toStage, note: h.note, createdAt: h.createdAt,
      })),
    })),
    documents: student.documents.map((d) => ({
      id: d.id, name: d.name, status: d.status, category: d.category, createdAt: d.createdAt,
    })),
    payments: student.payments.map((p) => ({
      id: p.id, amount: p.amount, currency: p.currency, status: p.status, paymentDate: p.paymentDate, createdAt: p.createdAt, paymentMethod: p.paymentMethod,
    })),
    invoices: student.invoices.map((i) => ({
      id: i.id, invoiceNumber: i.invoiceNumber, total: i.total, paidAmount: i.paidAmount, dueAmount: i.dueAmount, status: i.status, dueDate: i.dueDate,
    })),
    tasks: student.tasks.map((t) => ({
      id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate,
    })),
    conversations: student.conversations.map((c) => ({
      id: c.id, lastMessageAt: c.lastMessageAt, employee: { user: { name: c.employee.user.name } },
    })),
    auditActivity: [],
    docsPercent: docs.percent,
    docsApproved: docs.approved,
    docsTotal: docs.total,
    payLabel: pay.label,
    payDue: pay.due,
    payTotal: pay.total,
    payInvoices: pay.invoices,
  };

  return (
    <>
      <PageHeader
        title={fullName}
        description={`${student.studentId} · ${student.email}`}
        breadcrumbs={["Employee", "My Students", fullName]}
        actions={<StatusBadge status={student.status} />}
      />
      <StudentDetailTabs data={data} basePath="/employee" />
    </>
  );
}
