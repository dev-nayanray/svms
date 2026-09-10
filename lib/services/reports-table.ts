/**
 * Tabular data extraction for the CSV export endpoint.
 *
 * Each report type produces a headers array + rows array that the
 * `rowsToCsv` helper converts to an RFC 4180 compliant CSV string.
 * The queries here mirror the aggregations in the main report
 * endpoint but return flat tabular data instead of chart data.
 */

import { prisma } from "@/lib/db";
import type { ReportType, ReportFilters } from "@/lib/constants/reports";

export async function runReportTable(
  type: ReportType,
  filters: ReportFilters,
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  switch (type) {
    case "students":
      return runStudentTable(filters);
    case "leads":
      return runLeadTable(filters);
    case "applications":
      return runApplicationTable(filters);
    case "visa":
      return runVisaTable(filters);
    case "employees":
      return runEmployeeTable(filters);
    case "finance":
      return runFinanceTable(filters);
    case "documents":
      return runDocumentTable(filters);
    default:
      return { headers: ["Error"], rows: [{ Error: "Unknown report type" }] };
  }
}

function buildDateWhere(filters: ReportFilters, field: string = "createdAt") {
  const range: Record<string, unknown> = {};
  if (filters.dateFrom) {
    const d = new Date(filters.dateFrom);
    if (!Number.isNaN(d.getTime())) range.gte = d;
  }
  if (filters.dateTo) {
    const d = new Date(filters.dateTo);
    if (!Number.isNaN(d.getTime())) range.lte = d;
  }
  return Object.keys(range).length ? { [field]: range } : {};
}

async function runStudentTable(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...buildDateWhere(filters),
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
  const rows = await prisma.student.findMany({
    where,
    select: {
      studentId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      country: true,
      city: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return {
    headers: ["Student ID", "First Name", "Last Name", "Email", "Phone", "Country", "City", "Status", "Created"],
    rows: rows.map((r) => ({
      "Student ID": r.studentId,
      "First Name": r.firstName,
      "Last Name": r.lastName,
      Email: r.email,
      Phone: r.phone ?? "",
      Country: r.country ?? "",
      City: r.city ?? "",
      Status: r.status,
      Created: new Date(r.createdAt).toISOString().slice(0, 10),
    })),
  };
}

async function runLeadTable(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...buildDateWhere(filters),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.employeeId ? { assignedEmployeeId: filters.employeeId } : {}),
  };
  const rows = await prisma.lead.findMany({
    where,
    select: {
      name: true,
      phone: true,
      email: true,
      source: true,
      status: true,
      preferredIntake: true,
      educationLevel: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return {
    headers: ["Name", "Phone", "Email", "Source", "Status", "Preferred Intake", "Education Level", "Created"],
    rows: rows.map((r) => ({
      Name: r.name,
      Phone: r.phone ?? "",
      Email: r.email ?? "",
      Source: r.source ?? "",
      Status: r.status,
      "Preferred Intake": r.preferredIntake ?? "",
      "Education Level": r.educationLevel ?? "",
      Created: new Date(r.createdAt).toISOString().slice(0, 10),
    })),
  };
}

async function runApplicationTable(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...buildDateWhere(filters),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.countryId ? { countryId: filters.countryId } : {}),
    ...(filters.universityId ? { universityId: filters.universityId } : {}),
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.intakeId ? { intakeId: filters.intakeId } : {}),
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
  };
  const rows = await prisma.application.findMany({
    where,
    select: {
      applicationNumber: true,
      stageKey: true,
      status: true,
      priority: true,
      country: { select: { name: true } },
      university: { select: { name: true } },
      course: { select: { name: true } },
      student: { select: { firstName: true, lastName: true, studentId: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return {
    headers: ["Application #", "Student", "Student ID", "Country", "University", "Course", "Stage", "Status", "Priority", "Created"],
    rows: rows.map((r) => ({
      "Application #": r.applicationNumber,
      Student: `${r.student.firstName} ${r.student.lastName}`,
      "Student ID": r.student.studentId,
      Country: r.country.name,
      University: r.university?.name ?? "",
      Course: r.course?.name ?? "",
      Stage: r.stageKey,
      Status: r.status,
      Priority: r.priority,
      Created: new Date(r.createdAt).toISOString().slice(0, 10),
    })),
  };
}

async function runVisaTable(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...buildDateWhere(filters, "createdAt"),
    ...(filters.status ? { stage: filters.status } : {}),
    ...(filters.countryId ? { application: { countryId: filters.countryId } } : {}),
  };
  const rows = await prisma.visaApplication.findMany({
    where,
    select: {
      stage: true,
      visaType: true,
      submittedAt: true,
      decisionAt: true,
      application: {
        select: {
          applicationNumber: true,
          student: { select: { firstName: true, lastName: true, studentId: true } },
          country: { select: { name: true } },
        },
      },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return {
    headers: ["Application #", "Student", "Student ID", "Country", "Visa Type", "Stage", "Submitted", "Decision", "Created"],
    rows: rows.map((r) => ({
      "Application #": r.application.applicationNumber,
      Student: `${r.application.student.firstName} ${r.application.student.lastName}`,
      "Student ID": r.application.student.studentId,
      Country: r.application.country.name,
      "Visa Type": r.visaType ?? "",
      Stage: r.stage,
      Submitted: r.submittedAt ? new Date(r.submittedAt).toISOString().slice(0, 10) : "",
      Decision: r.decisionAt ? new Date(r.decisionAt).toISOString().slice(0, 10) : "",
      Created: new Date(r.createdAt).toISOString().slice(0, 10),
    })),
  };
}

async function runEmployeeTable(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
  };
  const employees = await prisma.employee.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { students: { where: { deletedAt: null } } } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const stats = await Promise.all(
    employees.map(async (emp) => {
      const [pending, overdue, completed] = await Promise.all([
        prisma.task.count({
          where: {
            assignedToId: emp.userId,
            deletedAt: null,
            status: { in: ["TODO", "IN_PROGRESS"] },
          },
        }),
        prisma.task.count({
          where: {
            assignedToId: emp.userId,
            deletedAt: null,
            status: { in: ["TODO", "IN_PROGRESS"] },
            dueDate: { lt: new Date() },
          },
        }),
        prisma.task.count({
          where: {
            assignedToId: emp.userId,
            deletedAt: null,
            status: "COMPLETED",
          },
        }),
      ]);
      return {
        Name: emp.user.name,
        Email: emp.user.email,
        Students: emp._count.students,
        Pending: pending,
        Overdue: overdue,
        Completed: completed,
      };
    }),
  );
  return {
    headers: ["Name", "Email", "Students", "Pending", "Overdue", "Completed"],
    rows: stats,
  };
}

async function runFinanceTable(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...buildDateWhere(filters, "paymentDate"),
  };
  const rows = await prisma.payment.findMany({
    where,
    select: {
      amount: true,
      currency: true,
      paymentMethod: true,
      transactionReference: true,
      status: true,
      paymentDate: true,
      student: { select: { firstName: true, lastName: true, studentId: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return {
    headers: ["Student", "Student ID", "Invoice #", "Amount", "Currency", "Method", "Reference", "Status", "Date"],
    rows: rows.map((r) => ({
      Student: `${r.student.firstName} ${r.student.lastName}`,
      "Student ID": r.student.studentId,
      "Invoice #": r.invoice?.invoiceNumber ?? "",
      Amount: r.amount,
      Currency: r.currency,
      Method: r.paymentMethod,
      Reference: r.transactionReference ?? "",
      Status: r.status,
      Date: r.paymentDate ? new Date(r.paymentDate).toISOString().slice(0, 10) : "",
    })),
  };
}

async function runDocumentTable(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...buildDateWhere(filters),
    ...(filters.status ? { status: filters.status } : {}),
  };
  const rows = await prisma.document.findMany({
    where,
    select: {
      name: true,
      fileName: true,
      status: true,
      uploadedAt: true,
      reviewedAt: true,
      expiresAt: true,
      student: { select: { firstName: true, lastName: true, studentId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return {
    headers: ["Document", "File", "Student", "Student ID", "Status", "Uploaded", "Reviewed", "Expires"],
    rows: rows.map((r) => ({
      Document: r.name,
      File: r.fileName,
      Student: `${r.student.firstName} ${r.student.lastName}`,
      "Student ID": r.student.studentId,
      Status: r.status,
      Uploaded: r.uploadedAt ? new Date(r.uploadedAt).toISOString().slice(0, 10) : "",
      Reviewed: r.reviewedAt ? new Date(r.reviewedAt).toISOString().slice(0, 10) : "",
      Expires: r.expiresAt ? new Date(r.expiresAt).toISOString().slice(0, 10) : "",
    })),
  };
}
