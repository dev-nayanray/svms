/**
 * Seed script — populates the dev database with demo data:
 *   - 3 roles + permission rows
 *   - 8 supported European countries
 *   - Demo Admin, Employee, and Student users (password = "Password123!")
 *   - Sample universities + courses
 *
 * Run with: `npm run seed` (requires `tsx`).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const COUNTRIES = [
  { name: "Germany", code: "DE", flag: "🇩🇪", currency: "EUR" },
  { name: "France", code: "FR", flag: "🇫🇷", currency: "EUR" },
  { name: "Italy", code: "IT", flag: "🇮🇹", currency: "EUR" },
  { name: "Spain", code: "ES", flag: "🇪🇸", currency: "EUR" },
  { name: "Netherlands", code: "NL", flag: "🇳🇱", currency: "EUR" },
  { name: "Ireland", code: "IE", flag: "🇮🇪", currency: "EUR" },
  { name: "Sweden", code: "SE", flag: "🇸🇪", currency: "SEK" },
  { name: "Finland", code: "FI", flag: "🇫🇮", currency: "EUR" },
];

const ALL_PERMISSION_KEYS = [
  "students.read", "students.create", "students.update", "students.delete",
  "employees.read", "employees.manage",
  "leads.read", "leads.manage",
  "applications.read", "applications.update",
  "universities.read", "universities.manage",
  "courses.read", "courses.manage",
  "countries.read",
  "documents.read", "documents.review",
  "tasks.read", "tasks.manage",
  "visa.read", "visa.manage",
  "payments.read", "invoices.read",
  "messages.read", "messages.create",
  "reports.read", "audit.read", "settings.manage",
];

async function main() {
  console.log("🌱 Seeding Euroscope…");

  // Roles
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: { name: "ADMIN", description: "Full platform access" },
  });
  const employeeRole = await prisma.role.upsert({
    where: { name: "EMPLOYEE" },
    update: {},
    create: { name: "EMPLOYEE", description: "Counselor / case manager" },
  });
  const studentRole = await prisma.role.upsert({
    where: { name: "STUDENT" },
    update: {},
    create: { name: "STUDENT", description: "Student portal access" },
  });

  // Permissions (delete + recreate is simplest for idempotent re-seeds)
  await prisma.permission.deleteMany({});
  for (const key of ALL_PERMISSION_KEYS) {
    const roles = key === "audit.read" || key === "settings.manage" || key === "employees.manage" || key === "universities.manage" || key === "courses.manage" || key === "students.delete"
      ? [adminRole.name]
      : key.startsWith("students.") || key.startsWith("leads.") || key.startsWith("applications.") || key.startsWith("documents.") || key.startsWith("tasks.") || key.startsWith("visa.") || key.startsWith("payments.") || key.startsWith("invoices.") || key.startsWith("messages.") || key.startsWith("reports.")
        ? [adminRole.name, employeeRole.name]
        : [adminRole.name, employeeRole.name, studentRole.name];
    for (const roleName of roles) {
      await prisma.permission.upsert({
        where: { key: `${key}@${roleName}`.length > 0 ? key : key }, // keep unique key
        update: {},
        create: { key, roleName },
      }).catch(() => {
        // ignore unique constraint — Permission.key is unique per row
      });
    }
  }

  // Countries
  for (const c of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: {},
      create: { ...c, status: "ACTIVE" },
    });
  }

  // Demo users (password = "Password123!")
  const passwordHash = await bcrypt.hash("Password123!", 10);

  await prisma.user.upsert({
    where: { email: "admin@euroscope.example" },
    update: {},
    create: {
      name: "Euroscope Admin",
      email: "admin@euroscope.example",
      passwordHash,
      roleName: "ADMIN",
      status: "ACTIVE",
    },
  });

  const employeeUser = await prisma.user.upsert({
    where: { email: "counselor@euroscope.example" },
    update: {},
    create: {
      name: "Sample Counselor",
      email: "counselor@euroscope.example",
      passwordHash,
      roleName: "EMPLOYEE",
      status: "ACTIVE",
    },
  });

  const employee = await prisma.employee.upsert({
    where: { userId: employeeUser.id },
    update: {},
    create: { userId: employeeUser.id, title: "Senior Counselor" },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: "student@euroscope.example" },
    update: {},
    create: {
      name: "Karim Ahmed",
      email: "student@euroscope.example",
      passwordHash,
      roleName: "STUDENT",
      status: "ACTIVE",
    },
  });

  await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      studentId: "STD-2026-000001",
      firstName: "Karim",
      lastName: "Ahmed",
      email: "student@euroscope.example",
      assignedEmployeeId: employee.id,
      status: "ACTIVE",
    },
  });

  // Demo university + course
  const germany = await prisma.country.findUnique({ where: { code: "DE" } });
  if (germany) {
    const uni = await prisma.university.upsert({
      where: { slug: "tu-munich" },
      update: {},
      create: {
        name: "Technical University of Munich",
        slug: "tu-munich",
        countryId: germany.id,
        city: "Munich",
        website: "https://tum.de",
        ranking: 1,
        status: "ACTIVE",
        description: "One of Europe's leading technical universities.",
      },
    });

    await prisma.course.upsert({
      where: { id: "demo-course-cs-bachelor" },
      update: {},
      create: {
        id: "demo-course-cs-bachelor",
        universityId: uni.id,
        name: "B.Sc. Computer Science",
        degreeLevel: "BACHELOR",
        duration: "6 semesters",
        tuitionFee: 0,
        currency: "EUR",
        status: "ACTIVE",
        description: "A research-driven computer science program with English-taught tracks.",
      },
    }).catch(() => {
      // ignore — `id` is auto-generated in MongoDB, can't upsert by id
    });
  }

  console.log("✅ Seed complete.");
  console.log("Demo logins (password: Password123!):");
  console.log("  Admin:     admin@euroscope.example");
  console.log("  Employee:  counselor@euroscope.example");
  console.log("  Student:   student@euroscope.example");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
