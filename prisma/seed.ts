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


  console.log("Seeding intakes…");
  const courses = await prisma.course.findMany();
  const intakePlan = [
    { name: "January 2027", month: 1, year: 2027 },
    { name: "May 2027", month: 5, year: 2027 },
    { name: "September 2026", month: 9, year: 2026 },
    { name: "September 2027", month: 9, year: 2027 },
    { name: "January 2026", month: 1, year: 2026 },
    { name: "May 2026", month: 5, year: 2026 },
  ];
  const intakes: Record<string, string> = {};
  for (let i = 0; i < intakePlan.length; i++) {
    const course = courses[i % courses.length];
    const existingIntake = await prisma.intake.findFirst({ where: { courseId: course.id, name: intakePlan[i].name } });
    const rec = existingIntake ?? await prisma.intake.create({
      data: {
        courseId: course.id,
        name: intakePlan[i].name,
        month: intakePlan[i].month,
        year: intakePlan[i].year,
        deadline: new Date(intakePlan[i].year, intakePlan[i].month - 1, 1),
        status: "ACTIVE",
      },
    });
    intakes[intakePlan[i].name] = rec.id;
  }

  console.log("Seeding demo students, applications, invoices and payments…");
  const year = new Date().getFullYear();
  const demo = [
    { first: "Ayesha", last: "Rahman", country: "Canada", uni: "University of Toronto", stage: "APPLICATION_SUBMITTED", intake: "January 2027", status: "ACTIVE", fee: 1250, paid: 1250 },
    { first: "Tanvir", last: "Hossain", country: "Australia", uni: "University of Melbourne", stage: "CONDITIONAL_OFFER", intake: "May 2027", status: "ACTIVE", fee: 2000, paid: 1000 },
    { first: "Nusrat", last: "Jahan", country: "United Kingdom", uni: "University of Manchester", stage: "VISA_SUBMITTED", intake: "September 2026", status: "ACTIVE", fee: 1500, paid: 1500 },
    { first: "Rafiul", last: "Islam", country: "Canada", uni: "University of Toronto", stage: "COMPLETED", intake: "January 2026", status: "COMPLETED", fee: 900, paid: 900 },
    { first: "Sadia", last: "Akter", country: "USA", uni: "University of Melbourne", stage: "UNIVERSITY_SELECTION", intake: "September 2027", status: "ACTIVE", fee: 800, paid: 0 },
  ];
  for (let i = 0; i < demo.length; i++) {
    const d = demo[i];
    const email = `${d.first.toLowerCase()}.${d.last.toLowerCase()}@example.com`;
    const seq = String(101 + i).padStart(6, "0");
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: `${d.first} ${d.last}`, email, passwordHash: studentHash,
        roleName: "STUDENT", status: "ACTIVE", emailVerifiedAt: new Date(),
      },
    });
    const stu = await prisma.student.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        studentId: `STD-${year}-${seq}`,
        firstName: d.first, lastName: d.last, email,
        phone: `+88017000000${10 + i}`,
        nationality: "Bangladeshi", city: "Dhaka", country: "Bangladesh",
        assignedEmployeeId: employee.id, branchId: branch.id,
      },
    });
    const app = await prisma.application.findUnique({ where: { applicationNumber: `SV-${year}-${seq}` } });
    if (!app) {
      await prisma.application.create({
        data: {
          applicationNumber: `SV-${year}-${seq}`,
          studentId: stu.id,
          employeeId: employee.id,
          countryId: countries[d.country],
          universityId: universities[d.uni],
          intakeId: intakes[d.intake],
          stageKey: d.stage,
          status: d.status,
          priority: i % 2 === 0 ? "MEDIUM" : "HIGH",
          submissionDate: d.stage === "LEAD" || d.stage === "UNIVERSITY_SELECTION" ? null : new Date(Date.now() - (i + 1) * 10 * 86400_000),
          statusHistory: {
            create: { fromStage: null, toStage: d.stage, changedById: adminUser.id, note: "Seeded demo application" },
          },
        },
      });
    }
    if (d.fee > 0) {
      const existingInvoice = await prisma.invoice.findUnique({ where: { invoiceNumber: `INV-${year}-${seq}` } });
      if (!existingInvoice) {
        const inv = await prisma.invoice.create({
          data: {
            invoiceNumber: `INV-${year}-${seq}`,
            studentId: stu.id,
            items: [{ description: "Consultancy & processing service", quantity: 1, unitPrice: d.fee }],
            subtotal: d.fee, total: d.fee, dueAmount: d.fee - d.paid,
            paidAmount: d.paid,
            status: d.paid >= d.fee ? "PAID" : d.paid > 0 ? "PARTIAL" : "ISSUED",
            issueDate: new Date(Date.now() - (i + 1) * 15 * 86400_000),
            dueDate: new Date(Date.now() + 30 * 86400_000),
          },
        });
        if (d.paid > 0) {
          await prisma.payment.create({
            data: {
              studentId: stu.id,
              invoiceId: inv.id,
              amount: d.paid,
              currency: "BDT",
              paymentMethod: i % 2 === 0 ? "BKASH" : "BANK_TRANSFER",
              transactionReference: `TXN-DEMO-${seq}`,
              status: "PAID",
              paymentDate: new Date(Date.now() - (i + 1) * 12 * 86400_000),
              createdById: adminUser.id,
            },
          });
        }
      }
    }
  }

  // MongoDB: ensure the deletedAt key exists so `where: { deletedAt: null }` matches.
  for (const m of ["application","branch","country","course","document","employee","intake","invoice","lead","payment","student","task","university","user","visaApplication"] as const) {
    // @ts-expect-error dynamic model access
    await prisma[m].updateMany({ data: { deletedAt: null } });
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
