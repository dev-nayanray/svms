import { z } from "zod";

export const studentCreateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  passportNumber: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  password: z.string().min(8).optional(),
});

export const studentUpdateSchema = studentCreateSchema
  .partial()
  .omit({ password: true })
  .extend({
    branchId: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"]).optional(),
  });

export const LEAD_STATUSES_Z = z.enum([
  "NEW", "CONTACTED", "COUNSELING", "QUALIFIED", "CONVERTED", "LOST",
]);
export const LEAD_SOURCES_Z = z.enum([
  "WEBSITE", "FACEBOOK", "WHATSAPP", "REFERRAL", "WALK_IN", "CAMPAIGN", "AGENT", "OTHER",
]);

export const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  interestedCountry: z.string().optional(),
  preferredIntake: z.string().optional(),
  educationLevel: z.string().optional(),
  englishScore: z.string().optional(),
  source: LEAD_SOURCES_Z.optional(),
  assignedEmployeeId: z.string().optional(),
  status: LEAD_STATUSES_Z.optional(),
  notes: z.string().optional(),
});

export const applicationSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  employeeId: z.string().optional(),
  countryId: z.string().min(1, "Country is required"),
  universityId: z.string().optional(),
  courseId: z.string().optional(),
  intakeId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export const applicationStatusSchema = z.object({
  stageKey: z.string().min(1, "Stage is required"),
  note: z.string().optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().max(5000).optional(),
  assignedToId: z.string().min(1, "Assignee is required"),
  studentId: z.string().optional(),
  applicationId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.coerce.date().optional(),
});

/**
 * Update schema for tasks. Partial — admins can edit any combination of
 * fields. The `status` field triggers `completedAt` automatically when
 * set to COMPLETED. `assignedToId` changes go through the dedicated
 * assign endpoint so they can be audit-logged distinctly.
 */
export const taskUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().max(5000).optional(),
  studentId: z.string().optional(),
  applicationId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

/**
 * Assign/reassign schema. Just the new `assignedToId` — the audit log
 * records the old → new assignee.
 */
export const taskAssignSchema = z.object({
  assignedToId: z.string().min(1, "Assignee is required"),
});

export const documentUploadSchema = z.object({
  studentId: z.string().min(1),
  applicationId: z.string().optional(),
  requirementId: z.string().optional(),
  name: z.string().min(1, "Document name is required"),
  fileUrl: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024, "Max file size is 10MB"),
});

/**
 * Review decision schema. Rejection REQUIRES a reason (reviewNote) —
 * the student must be told why their document was rejected so they can
 * fix and re-upload. Approval and under-review notes are optional.
 */
export const documentReviewSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED", "UNDER_REVIEW"]),
    reviewNote: z.string().max(2000).optional(),
  })
  .refine(
    (data) => data.decision !== "REJECTED" || (!!data.reviewNote && data.reviewNote.trim().length > 0),
    {
      message: "A rejection reason is required",
      path: ["reviewNote"],
    },
  );

/**
 * Request re-upload schema. The admin provides a reason explaining why
 * the student needs to re-upload the document. The document's status is
 * reset to REQUESTED and the note is stored as the reviewNote.
 */
export const documentReuploadSchema = z.object({
  reason: z.string().min(1, "A reason is required").max(2000, "Reason is too long"),
});

/**
 * Archive toggle schema. `archived: true` soft-deletes the document
 * (sets deletedAt + deletedBy); `archived: false` restores it.
 */
export const documentArchiveSchema = z.object({
  archived: z.boolean(),
});

export const paymentSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  applicationId: z.string().optional(),
  invoiceId: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("BDT"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "BKASH", "NAGAD", "CARD", "OTHER"]),
  transactionReference: z.string().optional(),
  paymentDate: z.coerce.date().optional(),
});

/**
 * Update schema for payments. Partial — admins can edit the amount,
 * method, reference, and date. Status changes go through the dedicated
 * refund/cancel endpoints so they can be audit-logged distinctly.
 */
export const paymentUpdateSchema = z.object({
  amount: z.number().positive("Amount must be positive").optional(),
  currency: z.string().optional(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "BKASH", "NAGAD", "CARD", "OTHER"]).optional(),
  transactionReference: z.string().optional(),
  paymentDate: z.coerce.date().nullable().optional(),
});

/**
 * Refund schema. The admin provides an optional reason which is stored
 * in the audit log. The payment's status changes to REFUNDED and the
 * linked invoice's paid/due amounts are adjusted accordingly.
 */
export const paymentRefundSchema = z.object({
  reason: z.string().max(2000).optional(),
});

export const invoiceSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  applicationId: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive().default(1),
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1, "At least one item is required"),
  discount: z.number().nonnegative().default(0),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

/**
 * Update schema for invoices. Partial — admins can edit items, discount,
 * issue/due dates, and status. Totals are always recomputed server-side
 * when items or discount change.
 */
export const invoiceUpdateSchema = z.object({
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1, "At least one item is required")
    .optional(),
  discount: z.number().nonnegative().optional(),
  issueDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: z.enum(["DRAFT", "ISSUED", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]).optional(),
});

export const universitySchema = z.object({
  name: z.string().min(1, "Name is required").max(160, "Name is too long"),
  countryId: z.string().min(1, "Country is required"),
  website: z.string().url().optional().or(z.literal("")),
  city: z.string().max(120).optional(),
  logo: z.string().url().optional().or(z.literal("")),
  description: z.string().max(5000).optional(),
  ranking: z.coerce.number().int().positive().optional(),
  applicationFee: z.coerce.number().nonnegative().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

/**
 * Update schema for universities. Mirrors the create schema as a partial,
 * plus an `archived` boolean that toggles the soft-delete tombstone
 * (separate from `status` so the audit trail can record lifecycle events
 * distinctly from activate/deactivate).
 *
 * `slug` is intentionally NOT in the update schema — slugs are referenced
 * by external systems and are immutable after creation.
 */
export const universityUpdateSchema = universitySchema.partial().extend({
  archived: z.boolean().optional(),
});

export const courseSchema = z.object({
  universityId: z.string().min(1, "University is required"),
  name: z.string().min(1, "Name is required"),
  degreeLevel: z.enum(["DIPLOMA", "BACHELOR", "MASTER", "PHD", "OTHER"]),
  duration: z.string().optional(),
  tuitionFee: z.coerce.number().nonnegative().optional(),
  currency: z.string().default("USD"),
  applicationFee: z.coerce.number().nonnegative().optional(),
  academicRequirements: z.string().optional(),
  englishRequirements: z.string().optional(),
  ieltsRequirement: z.string().max(200).optional(),
  toeflRequirement: z.string().max(200).optional(),
  pteRequirement: z.string().max(200).optional(),
  applicationDeadline: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

/**
 * Update schema for courses. Mirrors the create schema as a partial,
 * plus an `archived` boolean that toggles the soft-delete tombstone
 * (separate from `status` so the audit trail can record lifecycle
 * events distinctly from activate/deactivate).
 */
export const courseUpdateSchema = courseSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const countrySchema = z.object({
  name: z.string().min(1, "Name is required").max(120, "Name is too long"),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(3, "Code must be 2-3 characters")
    .regex(/^[A-Za-z]{2,3}$/, "Code must be 2-3 letters (A-Z)"),
  flag: z.string().max(16, "Flag is too long").optional(),
  currency: z.string().max(8, "Currency code is too long").optional(),
  description: z.string().max(2000, "Description is too long").optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const countryUpdateSchema = countrySchema.partial().extend({
  archived: z.boolean().optional(),
});

export const visaRequirementCreateSchema = z.object({
  countryId: z.string().min(1, "Country is required"),
  name: z.string().min(1, "Name is required").max(160),
  description: z.string().max(2000).optional(),
  required: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const visaRequirementUpdateSchema = visaRequirementCreateSchema
  .partial()
  .omit({ countryId: true });

export const documentRequirementSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  code: z
    .string()
    .min(1, "Code is required")
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Code must be lowercase, digits, or underscores"),
  description: z.string().max(2000).optional(),
  countryId: z.string().optional(),
  required: z.coerce.boolean().default(true),
  appliesTo: z.enum(["APPLICATION", "VISA", "PROFILE"]).default("APPLICATION"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const documentRequirementUpdateSchema = documentRequirementSchema
  .partial()
  .omit({ code: true });

export const noteSchema = z.object({
  studentId: z.string().min(1),
  applicationId: z.string().optional(),
  body: z.string().min(1, "Note is required"),
  visibility: z.enum(["INTERNAL", "STUDENT"]).default("INTERNAL"),
});

export const employeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  title: z.string().optional(),
  branchId: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const employeeUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  branchId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"]).optional(),
  roleName: z.enum(["EMPLOYEE", "ADMIN"]).optional(),
});

export const branchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1).min(2, "Code is required").max(10),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const intakeSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  name: z.string().min(1, "Name is required"),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2024).max(2100),
  deadline: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

/**
 * Update schema for intakes. Mirrors the create schema as a partial,
 * plus an `archived` boolean that toggles the soft-delete tombstone.
 */
export const intakeUpdateSchema = intakeSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const visaRequirementSchema = visaRequirementCreateSchema;

// ─────────────────────────────────────────────
// Visa applications (Module: Admin Visa Management)
// ─────────────────────────────────────────────

/**
 * Schema for creating a visa application record. Tied to an existing
 * application (the student's case file). The visaType is optional free
 * text so admins can enter custom types.
 */
export const visaApplicationCreateSchema = z.object({
  applicationId: z.string().min(1, "Application is required"),
  visaType: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
});

/**
 * Schema for updating a visa application's editable fields (visaType,
 * notes, and the optional date fields). The `stage` field is NOT here —
 * stage changes go through the dedicated stage-change endpoint so they
 * can be audit-logged distinctly.
 */
export const visaApplicationUpdateSchema = z.object({
  visaType: z.string().max(200).optional(),
  submittedAt: z.coerce.date().nullable().optional(),
  biometricsAt: z.coerce.date().nullable().optional(),
  interviewAt: z.coerce.date().nullable().optional(),
  decisionAt: z.coerce.date().nullable().optional(),
  notes: z.string().max(5000).optional(),
});

/**
 * Schema for a visa stage change. The `note` is optional but recommended
 * — it's stored in the ApplicationStatusHistory entry and the audit log.
 */
export const visaStageChangeSchema = z.object({
  stage: z.enum([
    "PREPARATION",
    "SUBMITTED",
    "BIOMETRICS",
    "INTERVIEW",
    "PROCESSING",
    "APPROVED",
    "REFUSED",
    "WITHDRAWN",
    "COMPLETED",
  ]),
  note: z.string().max(2000).optional(),
});

export const settingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
});

export const leadUpdateSchema = leadSchema.partial().extend({
  archived: z.boolean().optional(),
});

// ─────────────────────────────────────────────
// Student discovery — university browsing, favorites, counseling requests
// ─────────────────────────────────────────────

/**
 * Parses the query-string of `/api/student/universities`. Extends the base
 * pagination schema with the discovery filters (country, city, ranking,
 * status, course, intake). All filter values are optional and coerce-safe
 * so missing query params fall back to undefined.
 */
export const studentUniversityQuerySchema = paginationSchema.extend({
  countryId: z.string().optional(),
  city: z.string().optional(),
  rankingMax: z.coerce.number().int().positive().optional(),
  courseId: z.string().optional(),
  intakeId: z.string().optional(),
  favoriteOnly: z.coerce.boolean().optional(),
  sortBy: z.enum(["name", "ranking", "applicationFee", "createdAt"]).optional(),
});

export const counselingRequestSchema = z.object({
  universityId: z.string().min(1, "University is required"),
  courseId: z.string().optional(),
  message: z.string().max(2000, "Message is too long").optional(),
});

export const favoriteToggleSchema = z.object({
  universityId: z.string().min(1, "University is required"),
});

// ─────────────────────────────────────────────
// Student discovery — courses & intakes (Module 08)
// ─────────────────────────────────────────────

/**
 * Parses the query-string of `/api/student/courses`. Mirrors
 * `studentUniversityQuerySchema` but with course-specific filters:
 * degree level, tuition range, intake join, and English-test requirement.
 */
export const studentCourseQuerySchema = paginationSchema.extend({
  countryId: z.string().optional(),
  universityId: z.string().optional(),
  degreeLevel: z.string().optional(),
  tuitionMin: z.coerce.number().nonnegative().optional(),
  tuitionMax: z.coerce.number().nonnegative().optional(),
  intakeId: z.string().optional(),
  englishTest: z.enum(["ielts", "toefl", "pte", "any"]).optional(),
  sortBy: z.enum(["name", "tuitionFee", "degreeLevel", "createdAt"]).optional(),
});

/**
 * Parses the query-string of `/api/student/intakes`. Used to browse
 * upcoming intakes across all student-visible courses, optionally
 * scoped to a country, university, or course.
 */
export const studentIntakeQuerySchema = paginationSchema
  .extend({
    countryId: z.string().optional(),
    universityId: z.string().optional(),
    courseId: z.string().optional(),
    upcomingOnly: z.coerce.boolean().optional(),
  })
  .omit({ status: true }); // intakes use their own status filter
