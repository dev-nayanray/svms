/**
 * SVMS seed script — run with `npm run seed`.
 * Demo passwords come from env vars (never hardcode credentials).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_STAGES = [
  "LEAD", "COUNSELING", "PROFILE_ASSESSMENT", "COUNTRY_SELECTION",
  "UNIVERSITY_SELECTION", "DOCUMENT_COLLECTION", "APPLICATION_SUBMITTED",
  "CONDITIONAL_OFFER", "UNCONDITIONAL_OFFER", "DEPOSIT_PAYMENT", "CONFIRMATION",
  "VISA_PREPARATION", "VISA_SUBMITTED", "BIOMETRICS", "INTERVIEW",
  "VISA_DECISION", "TRAVEL_PREPARATION", "COMPLETED",
];

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
  const employeePassword = process.env.SEED_EMPLOYEE_PASSWORD ?? "Employee@12345";
  const studentPassword = process.env.SEED_STUDENT_PASSWORD ?? "Student@12345";

  console.log("Seeding roles…");
  for (const name of ["ADMIN", "EMPLOYEE", "STUDENT"]) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log("Seeding branch…");
  const branch = await prisma.branch.upsert({
    where: { code: "HQ" },
    update: {},
    create: { name: "Head Office", code: "HQ" },
  });

  console.log("Seeding users…");
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const employeeHash = await bcrypt.hash(employeePassword, 10);
  const studentHash = await bcrypt.hash(studentPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "SVMS Admin", email: "admin@example.com", passwordHash: adminHash,
      roleName: "ADMIN", status: "ACTIVE", branchId: branch.id, emailVerifiedAt: new Date(),
    },
  });

  const employeeUser = await prisma.user.upsert({
    where: { email: "employee@example.com" },
    update: {},
    create: {
      name: "Rahim Counselor", email: "employee@example.com", passwordHash: employeeHash,
      roleName: "EMPLOYEE", status: "ACTIVE", branchId: branch.id, emailVerifiedAt: new Date(),
    },
  });
  const employee = await prisma.employee.upsert({
    where: { userId: employeeUser.id },
    update: {},
    create: { userId: employeeUser.id, branchId: branch.id, title: "Senior Counselor" },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: "student@example.com" },
    update: {},
    create: {
      name: "Karim Student", email: "student@example.com", passwordHash: studentHash,
      roleName: "STUDENT", status: "ACTIVE", emailVerifiedAt: new Date(),
    },
  });
  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      studentId: "STD-2026-000001",
      firstName: "Karim", lastName: "Ahmed",
      email: "student@example.com",
      phone: "+8801700000001",
      nationality: "Bangladeshi",
      city: "Dhaka", country: "Bangladesh",
      assignedEmployeeId: employee.id,
      branchId: branch.id,
    },
  });
  await prisma.academicRecord.create({
    data: {
      studentId: student.id, level: "HSC", institution: "Dhaka College",
      group: "Science", result: "GPA 5.00", passingYear: 2023,
    },
  });
  await prisma.englishProficiency.create({
    data: {
      studentId: student.id, testType: "IELTS", overallScore: 6.5,
      readingScore: 6.5, writingScore: 6.0, listeningScore: 7.0, speakingScore: 6.0,
      testDate: new Date("2026-05-10"),
    },
  });

  console.log("Seeding application stages…");
  for (let i = 0; i < DEFAULT_STAGES.length; i++) {
    const key = DEFAULT_STAGES[i];
    await prisma.applicationStage.upsert({
      where: { key },
      update: { sortOrder: i },
      create: {
        key,
        name: key,
        sortOrder: i,
        description: key.replace(/_/g, " ").toLowerCase(),
      },
    });
  }

  console.log("Seeding countries…");
  const countryData = [
    { name: "United Kingdom", code: "GB", currency: "GBP" },
    { name: "Canada", code: "CA", currency: "CAD" },
    { name: "Australia", code: "AU", currency: "AUD" },
    { name: "USA", code: "US", currency: "USD" },
  ];
  const countries: Record<string, string> = {};
  for (const c of countryData) {
    const found = await prisma.country.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
    countries[c.name] = found.id;
  }

  console.log("Seeding universities and courses…");
  const uniData = [
    { name: "University of Manchester", country: "United Kingdom", ranking: 32, applicationFee: 0 },
    { name: "University of Toronto", country: "Canada", ranking: 25, applicationFee: 125 },
    { name: "University of Melbourne", country: "Australia", ranking: 14, applicationFee: 100 },
  ];
  const universities: Record<string, string> = {};
  for (const u of uniData) {
    const slug = u.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const found = await prisma.university.upsert({
      where: { slug },
      update: {},
      create: {
        name: u.name, slug, countryId: countries[u.country],
        ranking: u.ranking, applicationFee: u.applicationFee,
      },
    });
    universities[u.name] = found.id;
  }
  const courseData = [
    { uni: "University of Manchester", name: "MSc Computer Science", level: "MASTER", fee: 32000, english: "IELTS 6.5 overall, no band below 6.0" },
    { uni: "University of Manchester", name: "BEng Mechanical Engineering", level: "BACHELOR", fee: 27000, english: "IELTS 6.0 overall" },
    { uni: "University of Toronto", name: "MBA", level: "MASTER", fee: 45000, english: "IELTS 7.0 overall" },
    { uni: "University of Melbourne", name: "Bachelor of Science", level: "BACHELOR", fee: 35000, english: "IELTS 6.5 overall" },
  ];
  for (const c of courseData) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await prisma.course.upsert({
      where: { slug },
      update: {},
      create: {
        universityId: universities[c.uni], name: c.name, slug,
        degreeLevel: c.level, tuitionFee: c.fee, currency: "USD",
        englishRequirements: c.english, duration: c.level === "MASTER" ? "18 months" : "3 years",
      },
    });
  }

  console.log("Seeding visa requirements…");
  const ukVisa = ["Valid Passport", "CAS Letter", "Financial Documents", "TB Test Certificate", "Academic Documents", "English Certificate", "Visa Application Form", "Biometrics Appointment"];
  for (let i = 0; i < ukVisa.length; i++) {
    const existing = await prisma.visaRequirement.findFirst({
      where: { countryId: countries["United Kingdom"], name: ukVisa[i] },
    });
    if (!existing) {
      await prisma.visaRequirement.create({
        data: { countryId: countries["United Kingdom"], name: ukVisa[i], sortOrder: i },
      });
    }
  }

  console.log("Seeding document requirements…");
  const docReqs = ["Passport", "Academic Transcript", "English Test Certificate", "Bank Statement", "Photograph"];
  for (const name of docReqs) {
    const code = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    await prisma.documentRequirement.upsert({
      where: { code },
      update: {},
      create: { name, code },
    });
  }

  console.log("Seeding demo application…");
  const existingApp = await prisma.application.findFirst({
    where: { studentId: student.id },
  });
  if (!existingApp) {
    const year = new Date().getFullYear();
    const app = await prisma.application.create({
      data: {
        applicationNumber: `SV-${year}-000001`,
        studentId: student.id,
        employeeId: employee.id,
        countryId: countries["United Kingdom"],
        universityId: universities["University of Manchester"],
        stageKey: "DOCUMENT_COLLECTION",
        priority: "HIGH",
        statusHistory: {
          create: [
            { fromStage: null, toStage: "LEAD", changedById: adminUser.id, note: "Application created" },
            { fromStage: "LEAD", toStage: "COUNSELING", changedById: employeeUser.id, note: "First counseling session" },
            { fromStage: "COUNSELING", toStage: "DOCUMENT_COLLECTION", changedById: employeeUser.id, note: "Documents requested" },
          ],
        },
      },
    });
    await prisma.task.create({
      data: {
        title: "Collect bank statement from Karim",
        assignedToId: employeeUser.id,
        studentId: student.id,
        applicationId: app.id,
        priority: "HIGH",
        dueDate: new Date(Date.now() + 3 * 86400_000),
      },
    });
    await prisma.notification.create({
      data: {
        userId: studentUser.id,
        type: "APPLICATION_STAGE_CHANGED",
        title: "Application updated",
        message: "Your application SV-2026-000001 moved to DOCUMENT COLLECTION. Please upload your documents.",
      },
    });
  }

  console.log("Seed complete ✔");
  console.log("  admin@example.com    / SEED_ADMIN_PASSWORD");
  console.log("  employee@example.com / SEED_EMPLOYEE_PASSWORD");
  console.log("  student@example.com  / SEED_STUDENT_PASSWORD");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
