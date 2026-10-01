import { prisma } from "@/lib/db";

/**
 * Data Export Service
 *
 * Exports SVMS data in JSON or CSV format. All exports are:
 *  - Server-side only (no client-side data processing)
 *  - Permission-aware (caller must verify RBAC before calling)
 *  - Sensitive-field-aware (passwords, hashes, tokens are never exported)
 *  - Rate-limited at the API layer
 *  - Audit-logged at the API layer
 *
 * Supported modules: students, leads, applications, documents, payments,
 * invoices, tasks, appointments, universities, courses, countries, employees,
 * branches, visa, messages, notifications.
 */

// Fields that must NEVER be exported — security-critical
const FORBIDDEN_FIELDS = new Set([
  "passwordHash",
  "password",
  "token",
  "secret",
  "authSecret",
  "sessionToken",
  "resetToken",
  "verificationToken",
]);

type ExportModule =
  | "students"
  | "leads"
  | "applications"
  | "documents"
  | "payments"
  | "invoices"
  | "tasks"
  | "appointments"
  | "universities"
  | "courses"
  | "countries"
  | "employees"
  | "branches"
  | "visa"
  | "messages"
  | "notifications";

type ExportFormat = "json" | "csv";

type ExportFilters = {
  status?: string;
  branchId?: string;
  employeeId?: string;
  countryId?: string;
  dateFrom?: string;
  dateTo?: string;
  demoOnly?: boolean;
};

/** Sensitive field warning for PII-containing modules */
const PII_MODULES = new Set<ExportModule>(["students", "employees", "leads", "payments", "invoices"]);
export function isPIIModule(module: ExportModule): boolean {
  return PII_MODULES.has(module);
}

/** Strip forbidden fields from a record */
function sanitizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (FORBIDDEN_FIELDS.has(key)) continue;
    // Recursively sanitize nested objects
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key] = sanitizeRecord(value as Record<string, unknown>);
    } else if (value instanceof Date) {
      sanitized[key] = value.toISOString();
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/** Build Prisma where clause from filters */
function buildWhere(module: ExportModule, filters: ExportFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.employeeId) where.assignedEmployeeId = filters.employeeId;
  if (filters.countryId) where.countryId = filters.countryId;
  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
    if (filters.dateTo) dateFilter.lte = new Date(filters.dateTo);
    where.createdAt = dateFilter;
  }
  if (filters.demoOnly) {
    where.email = { contains: "euroscope.demo" };
  }
  return where;
}

/** Select fields per module (exclude sensitive fields at the Prisma level) */
function getSelect(module: ExportModule): Record<string, unknown> | undefined {
  // For most modules, select all fields except passwordHash
  // Prisma select is per-model — we define safe selections here
  switch (module) {
    case "students":
      return {
        id: true, studentId: true, firstName: true, lastName: true, email: true,
        phone: true, status: true, branchId: true, assignedEmployeeId: true,
        dateOfBirth: true, gender: true, nationality: true, country: true,
        city: true, createdAt: true, updatedAt: true,
      };
    case "employees":
      return {
        id: true, title: true, branchId: true,
        user: { select: { id: true, name: true, email: true, status: true, lastLoginAt: true } },
        createdAt: true, updatedAt: true,
      };
    default:
      return undefined; // select all (safe for non-PII modules)
  }
}

/** Fetch records for a module */
async function fetchRecords(
  module: ExportModule,
  filters: ExportFilters,
  limit: number = 10000,
): Promise<Record<string, unknown>[]> {
  const where = buildWhere(module, filters);
  const select = getSelect(module);

  switch (module) {
    case "students":
      return prisma.student.findMany({ where: { ...where, deletedAt: null }, select: select as never, take: limit, orderBy: { createdAt: "desc" } });
    case "leads":
      return prisma.lead.findMany({ where: { ...where, deletedAt: null }, take: limit, orderBy: { createdAt: "desc" } });
    case "applications":
      return prisma.application.findMany({ where: { ...where, deletedAt: null }, include: { country: { select: { name: true } }, university: { select: { name: true } }, course: { select: { name: true } } }, take: limit, orderBy: { createdAt: "desc" } });
    case "documents":
      return prisma.document.findMany({ where: { ...where, deletedAt: null }, take: limit, orderBy: { createdAt: "desc" } });
    case "payments":
      return prisma.payment.findMany({ where: { ...where, deletedAt: null }, take: limit, orderBy: { createdAt: "desc" } });
    case "invoices":
      return prisma.invoice.findMany({ where: { ...where, deletedAt: null }, take: limit, orderBy: { createdAt: "desc" } });
    case "tasks":
      return prisma.task.findMany({ where: { ...where, deletedAt: null }, take: limit, orderBy: { createdAt: "desc" } });
    case "appointments":
      return prisma.appointment.findMany({ where, take: limit, orderBy: { scheduledAt: "desc" } });
    case "universities":
      return prisma.university.findMany({ where: { ...where, deletedAt: null }, include: { country: { select: { name: true } } }, take: limit, orderBy: { name: "asc" } });
    case "courses":
      return prisma.course.findMany({ where: { ...where, deletedAt: null }, include: { university: { select: { name: true } } }, take: limit, orderBy: { name: "asc" } });
    case "countries":
      return prisma.country.findMany({ where: { ...where, deletedAt: null }, take: limit, orderBy: { name: "asc" } });
    case "employees":
      return prisma.employee.findMany({ where: { ...where, deletedAt: null }, select: select as never, take: limit, orderBy: { createdAt: "desc" } });
    case "branches":
      return prisma.branch.findMany({ where: { ...where, deletedAt: null }, take: limit, orderBy: { name: "asc" } });
    case "visa":
      return prisma.visaApplication.findMany({ where, include: { application: { select: { applicationNumber: true, student: { select: { firstName: true, lastName: true, studentId: true } } } } }, take: limit, orderBy: { createdAt: "desc" } });
    case "messages":
      return prisma.message.findMany({ where, take: limit, orderBy: { createdAt: "desc" } });
    case "notifications":
      return prisma.notification.findMany({ where, take: limit, orderBy: { createdAt: "desc" } });
    default:
      return [];
  }
}

/** Export module data as JSON string */
export async function exportAsJson(
  module: ExportModule,
  filters: ExportFilters,
  limit: number = 10000,
): Promise<{ data: string; count: number; module: string }> {
  const records = await fetchRecords(module, filters, limit);
  const sanitized = records.map((r) => sanitizeRecord(r as Record<string, unknown>));
  const payload = {
    version: "1.0",
    module,
    exportedAt: new Date().toISOString(),
    count: sanitized.length,
    records: sanitized,
  };
  return { data: JSON.stringify(payload, null, 2), count: sanitized.length, module };
}

/** Export module data as CSV string */
export async function exportAsCsv(
  module: ExportModule,
  filters: ExportFilters,
  limit: number = 10000,
): Promise<{ data: string; count: number; module: string }> {
  const records = await fetchRecords(module, filters, limit);
  const sanitized = records.map((r) => sanitizeRecord(r as Record<string, unknown>));

  if (sanitized.length === 0) {
    return { data: "\uFEFFNo data\r\n", count: 0, module };
  }

  // Flatten records for CSV
  const flatRecords = sanitized.map((r) => flattenObject(r));
  const headers = [...new Set(flatRecords.flatMap((r) => Object.keys(r)))];

  // Build CSV with UTF-8 BOM + RFC 4180 escaping
  const lines: string[] = ["\uFEFF" + headers.map(escapeCsv).join(",")];
  for (const record of flatRecords) {
    lines.push(headers.map((h) => escapeCsv(String(record[h] ?? ""))).join(","));
  }
  return { data: lines.join("\r\n"), count: sanitized.length, module };
}

/** Flatten nested objects for CSV (e.g., { country: { name: "UK" } } → { "country.name": "UK" }) */
function flattenObject(obj: Record<string, unknown>, prefix: string = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(value ?? "");
    }
  }
  return result;
}

/** RFC 4180 CSV escaping */
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Get record counts for all modules (for the Data Management overview) */
export async function getDataOverview() {
  const [
    students, leads, applications, documents, payments, invoices,
    tasks, appointments, universities, courses, countries, employees,
    branches, visa, messages, notifications, auditLogs,
  ] = await Promise.all([
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.lead.count({ where: { deletedAt: null } }),
    prisma.application.count({ where: { deletedAt: null } }),
    prisma.document.count({ where: { deletedAt: null } }),
    prisma.payment.count({ where: { deletedAt: null } }),
    prisma.invoice.count({ where: { deletedAt: null } }),
    prisma.task.count({ where: { deletedAt: null } }),
    prisma.appointment.count(),
    prisma.university.count({ where: { deletedAt: null } }),
    prisma.course.count({ where: { deletedAt: null } }),
    prisma.country.count({ where: { deletedAt: null } }),
    prisma.employee.count({ where: { deletedAt: null } }),
    prisma.branch.count({ where: { deletedAt: null } }),
    prisma.visaApplication.count(),
    prisma.message.count(),
    prisma.notification.count(),
    prisma.auditLog.count(),
  ]);

  // Count demo students
  const demoStudents = await prisma.student.count({
    where: { email: { contains: "euroscope.demo" }, deletedAt: null },
  });

  return {
    students, leads, applications, documents, payments, invoices,
    tasks, appointments, universities, courses, countries, employees,
    branches, visa, messages, notifications, auditLogs,
    demoStudents,
  };
}

export type { ExportModule, ExportFormat, ExportFilters };
