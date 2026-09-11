import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient };

const base =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = base;

// Models with a soft-delete `deletedAt` field. On MongoDB, documents created
// without the key do not match `where: { deletedAt: null }` filters, so every
// create must store the key explicitly.
const SOFT_DELETE_MODELS = new Set([
  "Application",
  "Branch",
  "Country",
  "Course",
  "Document",
  "Employee",
  "Intake",
  "Invoice",
  "Lead",
  "Payment",
  "Student",
  "Task",
  "University",
  "User",
  "VisaApplication",
]);

const ensureSoftDeleteKey = (data: unknown) => {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (d.deletedAt === undefined) d.deletedAt = null;
  }
};

export const prisma = base.$extends({
  query: {
    $allModels: {
      async create({ model, args, query }) {
        if (model && SOFT_DELETE_MODELS.has(model)) ensureSoftDeleteKey(args.data);
        return query(args);
      },
      async createMany({ model, args, query }) {
        if (model && SOFT_DELETE_MODELS.has(model)) {
          if (Array.isArray(args.data)) args.data.forEach(ensureSoftDeleteKey);
          else ensureSoftDeleteKey(args.data);
        }
        return query(args);
      },
      async upsert({ model, args, query }) {
        if (model && SOFT_DELETE_MODELS.has(model)) ensureSoftDeleteKey(args.create);
        return query(args);
      },
    },
  },
});
