/**
 * Euroscope seed script — run with `npm run seed`.
 *
 * Seeds ALL demo data for a complete, professional demo:
 *  - Roles, Branch, Users (admin + 2 employees + 6 students)
 *  - 15 European countries, 10 universities (with descriptions), 11 courses
 *  - Visa requirements for 5 countries
 *  - Application stages (18)
 *  - Demo applications with status history, tasks, notifications
 *  - Visa applications for students at visa stage
 *  - Documents (uploaded/approved/under-review) for each student
 *  - Conversations + messages between students and counselors
 *  - Appointments (scheduled/confirmed/completed)
 *  - Support requests (open/in-progress/resolved)
 *  - Student preferences (notification settings)
 *  - Leads (from website + referral)
 *  - Invoices + payments
 *
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

  // ════════════════════════════════════════════
  //  ROLES + BRANCH
  // ════════════════════════════════════════════
  console.log("Seeding roles…");
  for (const name of ["ADMIN", "EMPLOYEE", "STUDENT"]) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log("Seeding branch…");
  const branch = await prisma.branch.upsert({
    where: { code: "HQ" },
    update: {},
    create: { name: "Head Office", code: "HQ", phone: "+8801700000000", email: "info@euroscope.app" },
  });

  // ════════════════════════════════════════════
  //  USERS — admin + 2 employees + 6 students
  // ════════════════════════════════════════════
  console.log("Seeding users…");
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const employeeHash = await bcrypt.hash(employeePassword, 10);
  const studentHash = await bcrypt.hash(studentPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Euroscope Admin", email: "admin@example.com", passwordHash: adminHash,
      roleName: "ADMIN", status: "ACTIVE", branchId: branch.id, emailVerifiedAt: new Date(),
    },
  });

  // Employee 1 — Senior Counselor
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

  // Employee 2 — Visa Specialist
  const employee2User = await prisma.user.upsert({
    where: { email: "visa@euroscope.app" },
    update: {},
    create: {
      name: "Sarah Visa", email: "visa@euroscope.app", passwordHash: employeeHash,
      roleName: "EMPLOYEE", status: "ACTIVE", branchId: branch.id, emailVerifiedAt: new Date(),
    },
  });
  const employee2 = await prisma.employee.upsert({
    where: { userId: employee2User.id },
    update: {},
    create: { userId: employee2User.id, branchId: branch.id, title: "Visa Specialist" },
  });

  // ════════════════════════════════════════════
  //  APPLICATION STAGES
  // ════════════════════════════════════════════
  console.log("Seeding application stages…");
  for (let i = 0; i < DEFAULT_STAGES.length; i++) {
    const key = DEFAULT_STAGES[i];
    await prisma.applicationStage.upsert({
      where: { key },
      update: { sortOrder: i },
      create: { key, name: key, sortOrder: i, description: key.replace(/_/g, " ").toLowerCase() },
    });
  }

  // ════════════════════════════════════════════
  //  COUNTRIES — 15 European destinations
  // ════════════════════════════════════════════
  console.log("Seeding countries…");
  const countryData = [
    { name: "Germany", code: "DE", currency: "EUR", description: "Public universities with low or no tuition fees." },
    { name: "France", code: "FR", currency: "EUR", description: "World-class public universities and grandes écoles." },
    { name: "Italy", code: "IT", currency: "EUR", description: "Affordable tuition and Europe's oldest universities." },
    { name: "Spain", code: "ES", currency: "EUR", description: "Warm climate, vibrant culture and strong business schools." },
    { name: "Netherlands", code: "NL", currency: "EUR", description: "Most English-taught programs in continental Europe." },
    { name: "Sweden", code: "SE", currency: "SEK", description: "Innovation-driven education with strong industry links." },
    { name: "Finland", code: "FI", currency: "EUR", description: "World-leading education system." },
    { name: "Denmark", code: "DK", currency: "DKK", description: "Strong tech and pharma industry." },
    { name: "Ireland", code: "IE", currency: "EUR", description: "English-speaking EU country with global HQs." },
    { name: "Poland", code: "PL", currency: "PLN", description: "Affordable living and growing international programs." },
    { name: "Hungary", code: "HU", currency: "HUF", description: "Rich cultural heritage and affordable education." },
    { name: "Portugal", code: "PT", currency: "EUR", description: "Warm climate and affordable European lifestyle." },
    { name: "Austria", code: "AT", currency: "EUR", description: "High quality of life and central European location." },
    { name: "Belgium", code: "BE", currency: "EUR", description: "Multicultural hub in the heart of Europe." },
    { name: "Czech Republic", code: "CZ", currency: "CZK", description: "Affordable tuition and rich academic tradition." },
  ];
  const countries: Record<string, string> = {};
  for (const c of countryData) {
    const found = await prisma.country.upsert({ where: { code: c.code }, update: {}, create: c });
    countries[c.name] = found.id;
  }

  // ════════════════════════════════════════════
  //  UNIVERSITIES — 10 European universities with descriptions
  // ════════════════════════════════════════════
  console.log("Seeding universities and courses…");
  const uniData = [
    { name: "Technical University of Munich", country: "Germany", ranking: 37, applicationFee: 0, description: "One of Europe's top technical universities, known for engineering and computer science." },
    { name: "Heidelberg University", country: "Germany", ranking: 47, applicationFee: 0, description: "Germany's oldest university, renowned for medicine and sciences." },
    { name: "Sorbonne University", country: "France", ranking: 88, applicationFee: 0, description: "A historic Parisian university excelling in science, humanities and the arts." },
    { name: "University of Bologna", country: "Italy", ranking: 154, applicationFee: 0, description: "The oldest university in the Western world, founded in 1088." },
    { name: "University of Amsterdam", country: "Netherlands", ranking: 60, applicationFee: 100, description: "Leading research university with 300+ English-taught programs." },
    { name: "KTH Royal Institute of Technology", country: "Sweden", ranking: 73, applicationFee: 90, description: "Sweden's largest technical university, strong in sustainability and technology." },
    { name: "University of Helsinki", country: "Finland", ranking: 104, applicationFee: 100, description: "Finland's oldest and largest university, world-leading in education research." },
    { name: "University of Copenhagen", country: "Denmark", ranking: 76, applicationFee: 0, description: "Denmark's premier university with strong research output." },
    { name: "Trinity College Dublin", country: "Ireland", ranking: 81, applicationFee: 55, description: "Ireland's top university, located in the heart of Dublin." },
    { name: "University of Vienna", country: "Austria", ranking: 137, applicationFee: 75, description: "Founded in 1365, one of Europe's oldest and largest universities." },
  ];
  const universities: Record<string, string> = {};
  for (const u of uniData) {
    const slug = u.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const found = await prisma.university.upsert({
      where: { slug },
      update: {},
      create: { name: u.name, slug, countryId: countries[u.country], ranking: u.ranking, applicationFee: u.applicationFee, description: u.description },
    });
    universities[u.name] = found.id;
  }

  // ════════════════════════════════════════════
  //  COURSES — 11 programs
  // ════════════════════════════════════════════
  const courseData = [
    { uni: "Technical University of Munich", name: "MSc Computer Science", level: "MASTER", fee: 0, english: "IELTS 6.5 overall, no band below 6.0", duration: "2 years" },
    { uni: "Technical University of Munich", name: "BEng Mechanical Engineering", level: "BACHELOR", fee: 0, english: "IELTS 6.0 overall", duration: "3 years" },
    { uni: "Heidelberg University", name: "MA Medical Sciences", level: "MASTER", fee: 1500, english: "IELTS 7.0 overall", duration: "2 years" },
    { uni: "Sorbonne University", name: "MSc Data Science", level: "MASTER", fee: 3000, english: "IELTS 6.5 or French B2", duration: "18 months" },
    { uni: "University of Bologna", name: "BSc International Relations", level: "BACHELOR", fee: 1000, english: "IELTS 5.5 overall", duration: "3 years" },
    { uni: "University of Amsterdam", name: "BSc Business Administration", level: "BACHELOR", fee: 12000, english: "IELTS 6.5 overall", duration: "3 years" },
    { uni: "KTH Royal Institute of Technology", name: "MSc Sustainable Technology", level: "MASTER", fee: 15500, english: "IELTS 6.5 overall", duration: "2 years" },
    { uni: "University of Helsinki", name: "MSc Computer Science", level: "MASTER", fee: 18000, english: "IELTS 6.5 overall", duration: "2 years" },
    { uni: "University of Copenhagen", name: "MSc Bioinformatics", level: "MASTER", fee: 10500, english: "IELTS 6.5 overall", duration: "2 years" },
    { uni: "Trinity College Dublin", name: "BA Business", level: "BACHELOR", fee: 22000, english: "IELTS 6.5 overall", duration: "3 years" },
    { uni: "University of Vienna", name: "MA European Studies", level: "MASTER", fee: 750, english: "IELTS 7.0 or German C1", duration: "2 years" },
  ];
  for (const c of courseData) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await prisma.course.upsert({
      where: { slug },
      update: {},
      create: { universityId: universities[c.uni], name: c.name, slug, degreeLevel: c.level, tuitionFee: c.fee, currency: "EUR", englishRequirements: c.english, duration: c.duration },
    });
  }

  // ════════════════════════════════════════════
  //  VISA REQUIREMENTS — 5 countries
  // ════════════════════════════════════════════
  console.log("Seeding visa requirements…");
  const visaReqs: Record<string, string[]> = {
    Germany: ["Valid Passport", "Admission Letter", "Financial Proof (Blocked Account)", "Health Insurance", "Academic Documents", "Language Certificate", "Visa Application Form", "Biometrics Appointment"],
    France: ["Valid Passport", "Admission Letter (Lettre d'acceptation)", "Financial Proof (7380 EUR/year)", "Proof of Accommodation", "Academic Documents", "French/English Language Certificate", "Visa Application Form", "Campus France Registration"],
    Italy: ["Valid Passport", "Pre-Enrollment Letter", "Financial Proof", "Health Insurance", "Academic Documents", "English/Italian Language Certificate", "Visa Application Form", "Declaration of Value"],
    Netherlands: ["Valid Passport", "Admission Letter", "Financial Proof (Tuition + Living)", "Health Insurance", "Academic Documents", "English Language Certificate", "Visa Application (MVV)", "Antecedent Certificate"],
    Sweden: ["Valid Passport", "Admission Letter", "Tuition Fee Proof", "Financial Proof for Living (10084 SEK/month)", "Health Insurance", "Academic Documents", "English Language Certificate", "Visa Application Form"],
  };
  for (const [countryName, reqs] of Object.entries(visaReqs)) {
    for (let i = 0; i < reqs.length; i++) {
      const existing = await prisma.visaRequirement.findFirst({
        where: { countryId: countries[countryName], name: reqs[i] },
      });
      if (!existing) {
        await prisma.visaRequirement.create({
          data: { countryId: countries[countryName], name: reqs[i], sortOrder: i },
        });
      }
    }
  }

  // ════════════════════════════════════════════
  //  DOCUMENT REQUIREMENTS
  // ════════════════════════════════════════════
  console.log("Seeding document requirements…");
  const docReqs = ["Passport", "Academic Transcript", "English Test Certificate", "Bank Statement", "Photograph"];
  for (const name of docReqs) {
    const code = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    await prisma.documentRequirement.upsert({ where: { code }, update: {}, create: { name, code } });
  }

  // ════════════════════════════════════════════
  //  MAIN STUDENT (Karim) + academic records + English
  // ════════════════════════════════════════════
  console.log("Seeding main student (Karim)…");
  const studentUser = await prisma.user.upsert({
    where: { email: "student@example.com" },
    update: {},
    create: {
      name: "Karim Ahmed", email: "student@example.com", passwordHash: studentHash,
      roleName: "STUDENT", status: "ACTIVE", emailVerifiedAt: new Date(),
    },
  });
  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id, studentId: "STD-2026-000001",
      firstName: "Karim", lastName: "Ahmed", email: "student@example.com",
      phone: "+8801700000001", whatsapp: "+8801700000001",
      nationality: "Bangladeshi", dateOfBirth: new Date("2003-05-15"),
      gender: "MALE", city: "Dhaka", country: "Bangladesh",
      passportNumber: "BX1234567", passportIssuingCountry: "Bangladesh",
      emergencyContactName: "Mohammed Ahmed", emergencyContactPhone: "+8801700000002", emergencyContactRelation: "Father",
      assignedEmployeeId: employee.id, branchId: branch.id,
    },
  });
  // Karim's academic record (findFirst + create — MongoDB ObjectId can't use string IDs)
  const existingHsc = await prisma.academicRecord.findFirst({ where: { studentId: student.id, level: "HSC" } });
  if (!existingHsc) {
    await prisma.academicRecord.create({
      data: { studentId: student.id, level: "HSC", institution: "Dhaka College", group: "Science", result: "GPA 5.00", passingYear: 2023 },
    });
  }
  // Karim's English proficiency
  const existingIelts = await prisma.englishProficiency.findFirst({ where: { studentId: student.id, testType: "IELTS" } });
  if (!existingIelts) {
    await prisma.englishProficiency.create({
      data: { studentId: student.id, testType: "IELTS", overallScore: 6.5, readingScore: 6.5, writingScore: 6.0, listeningScore: 7.0, speakingScore: 6.0, testDate: new Date("2026-05-10") },
    });
  }

  // Karim's application
  console.log("Seeding Karim's application…");
  const year = new Date().getFullYear();
  let karimApp = await prisma.application.findUnique({ where: { applicationNumber: `ES-${year}-000001` } });
  if (!karimApp) {
    karimApp = await prisma.application.create({
      data: {
        applicationNumber: `ES-${year}-000001`,
        studentId: student.id, employeeId: employee.id,
        countryId: countries["Germany"], universityId: universities["Technical University of Munich"],
        stageKey: "DOCUMENT_COLLECTION", priority: "HIGH",
        statusHistory: {
          create: [
            { fromStage: null, toStage: "LEAD", changedById: adminUser.id, note: "Application created" },
            { fromStage: "LEAD", toStage: "COUNSELING", changedById: employeeUser.id, note: "First counseling session" },
            { fromStage: "COUNSELING", toStage: "DOCUMENT_COLLECTION", changedById: employeeUser.id, note: "Documents requested" },
          ],
        },
      },
    });
  }

  // Karim's documents
  console.log("Seeding documents for Karim…");
  const karimDocs = [
    { name: "Passport Scan", category: "Passport", status: "APPROVED", mime: "application/pdf", size: 245000 },
    { name: "HSC Transcript", category: "Academic", status: "APPROVED", mime: "application/pdf", size: 180000 },
    { name: "IELTS Certificate", category: "English Test", status: "APPROVED", mime: "application/pdf", size: 95000 },
    { name: "Bank Statement", category: "Financial", status: "UNDER_REVIEW", mime: "application/pdf", size: 320000 },
    { name: "Motivation Letter", category: "Other", status: "UPLOADED", mime: "application/pdf", size: 45000 },
  ];
  for (const doc of karimDocs) {
    const existing = await prisma.document.findFirst({ where: { studentId: student.id, name: doc.name } });
    if (!existing) {
      await prisma.document.create({
        data: {
          studentId: student.id, applicationId: karimApp.id,
          name: doc.name, category: doc.category,
          fileUrl: `private:${student.id}/placeholder.pdf`,
          fileName: "placeholder.pdf", mimeType: doc.mime, fileSize: doc.size,
          status: doc.status, uploadedById: studentUser.id, uploadedAt: new Date(),
        },
      });
    }
  }

  // Karim's task
  const existingTask = await prisma.task.findFirst({ where: { studentId: student.id, title: "Collect bank statement from Karim" } });
  if (!existingTask) {
    await prisma.task.create({
      data: {
        title: "Collect bank statement from Karim",
        assignedToId: employeeUser.id, studentId: student.id, applicationId: karimApp.id,
        priority: "HIGH", dueDate: new Date(Date.now() + 3 * 86400_000),
      },
    });
  }

  // Karim's notification
  const existingNotif = await prisma.notification.findFirst({ where: { userId: studentUser.id, type: "APPLICATION_STAGE_CHANGED" } });
  if (!existingNotif) {
    await prisma.notification.create({
      data: {
        userId: studentUser.id,
        type: "APPLICATION_STAGE_CHANGED", title: "Application updated",
        message: `Your application ES-${year}-000001 moved to DOCUMENT COLLECTION. Please upload your documents.`,
        link: "/student/application",
      },
    });
  }

  // Karim's conversation + messages
  console.log("Seeding conversations + messages…");
  let karimConv = await prisma.conversation.findFirst({ where: { studentId: student.id } });
  if (!karimConv) {
    karimConv = await prisma.conversation.create({
      data: { studentId: student.id, employeeId: employee.id, lastMessageAt: new Date(Date.now() - 3600_000) },
    });
    const msgs = [
      { senderId: employeeUser.id, body: "Hi Karim! Welcome to Euroscope. I'm your counselor — how can I help you today?", readAt: new Date(), createdAt: new Date(Date.now() - 7200_000) },
      { senderId: studentUser.id, body: "Hi Rahim! I'm interested in studying Computer Science in Germany. Can you guide me?", readAt: new Date(), createdAt: new Date(Date.now() - 6800_000) },
      { senderId: employeeUser.id, body: "Absolutely! TU Munich is an excellent choice. Let's start with your documents — I've requested your passport, transcripts, and IELTS certificate.", readAt: new Date(), createdAt: new Date(Date.now() - 6400_000) },
      { senderId: studentUser.id, body: "I've uploaded my passport and IELTS. Working on the bank statement now.", readAt: null, createdAt: new Date(Date.now() - 3600_000) },
    ];
    for (const msg of msgs) {
      await prisma.message.create({ data: { conversationId: karimConv.id, ...msg } });
    }
  }

  // Karim's appointment
  console.log("Seeding appointments…");
  const apptExisting = await prisma.appointment.findFirst({ where: { studentId: student.id } });
  if (!apptExisting) {
    await prisma.appointment.create({
      data: {
        studentId: student.id, employeeId: employee.id,
        scheduledAt: new Date(Date.now() + 7 * 86400_000),
        durationMins: 45, purpose: "Document Review & Application Planning",
        location: "Euroscope Office, Dhaka", meetingMethod: "IN_PERSON",
        status: "SCHEDULED",
      },
    });
  }

  // Karim's preferences
  await prisma.studentPreference.upsert({
    where: { studentId: student.id },
    update: {},
    create: { studentId: student.id, theme: "system", language: "en" },
  });

  // ════════════════════════════════════════════
  //  DEMO STUDENTS — 5 students with full data
  // ════════════════════════════════════════════
  console.log("Seeding 5 demo students…");
  const demo = [
    { first: "Ayesha", last: "Rahman", country: "Germany", uni: "Technical University of Munich", stage: "APPLICATION_SUBMITTED", intake: "Winter 2026", status: "ACTIVE", fee: 1250, paid: 1250, emp: employee },
    { first: "Tanvir", last: "Hossain", country: "Netherlands", uni: "University of Amsterdam", stage: "CONDITIONAL_OFFER", intake: "September 2026", status: "ACTIVE", fee: 2000, paid: 1000, emp: employee },
    { first: "Nusrat", last: "Jahan", country: "France", uni: "Sorbonne University", stage: "VISA_SUBMITTED", intake: "September 2026", status: "ACTIVE", fee: 1500, paid: 1500, emp: employee2 },
    { first: "Rafiul", last: "Islam", country: "Italy", uni: "University of Bologna", stage: "COMPLETED", intake: "September 2025", status: "COMPLETED", fee: 900, paid: 900, emp: employee2 },
    { first: "Sadia", last: "Akter", country: "Sweden", uni: "KTH Royal Institute of Technology", stage: "UNIVERSITY_SELECTION", intake: "September 2027", status: "ACTIVE", fee: 800, paid: 0, emp: employee },
  ];

  const demoStudentIds: { studentId: string; userId: string; stage: string; appId: string }[] = [];

  for (let i = 0; i < demo.length; i++) {
    const d = demo[i];
    const email = `${d.first.toLowerCase()}.${d.last.toLowerCase()}@example.com`;
    const seq = String(101 + i).padStart(6, "0");
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name: `${d.first} ${d.last}`, email, passwordHash: studentHash, roleName: "STUDENT", status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    const stu = await prisma.student.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id, studentId: `STD-${year}-${seq}`,
        firstName: d.first, lastName: d.last, email,
        phone: `+88017000000${10 + i}`, nationality: "Bangladeshi",
        city: "Dhaka", country: "Bangladesh",
        assignedEmployeeId: d.emp.id, branchId: branch.id,
      },
    });

    // Application
    const appNum = `ES-${year}-${seq}`;
    let app = await prisma.application.findUnique({ where: { applicationNumber: appNum } });
    if (!app) {
      app = await prisma.application.create({
        data: {
          applicationNumber: appNum, studentId: stu.id, employeeId: d.emp.id,
          countryId: countries[d.country], universityId: universities[d.uni],
          stageKey: d.stage, status: d.status,
          priority: i % 2 === 0 ? "MEDIUM" : "HIGH",
          submissionDate: d.stage === "LEAD" || d.stage === "UNIVERSITY_SELECTION" ? null : new Date(Date.now() - (i + 1) * 10 * 86400_000),
          statusHistory: { create: { fromStage: null, toStage: d.stage, changedById: adminUser.id, note: "Seeded demo application" } },
        },
      });
    }
    demoStudentIds.push({ studentId: stu.id, userId: user.id, stage: d.stage, appId: app.id });

    // Visa application for students at visa stage
    if (d.stage === "VISA_SUBMITTED" || d.stage === "VISA_DECISION" || d.stage === "COMPLETED") {
      const existingVisa = await prisma.visaApplication.findUnique({ where: { applicationId: app.id } });
      if (!existingVisa) {
        await prisma.visaApplication.create({
          data: {
            applicationId: app.id,
            stage: d.stage === "COMPLETED" ? "APPROVED" : d.stage === "VISA_DECISION" ? "PROCESSING" : "SUBMITTED",
            visaType: "Student Visa",
            submittedAt: d.stage === "VISA_SUBMITTED" || d.stage === "VISA_DECISION" || d.stage === "COMPLETED" ? new Date(Date.now() - 15 * 86400_000) : null,
            decisionAt: d.stage === "COMPLETED" ? new Date(Date.now() - 5 * 86400_000) : null,
          },
        });
      }
    }

    // Documents
    const demoDocs = [
      { name: "Passport", category: "Passport", status: "APPROVED" },
      { name: "Academic Transcript", category: "Academic", status: "APPROVED" },
      { name: "English Certificate", category: "English Test", status: d.stage === "UNIVERSITY_SELECTION" ? "UPLOADED" : "APPROVED" },
    ];
    for (const doc of demoDocs) {
      const existing = await prisma.document.findFirst({ where: { studentId: stu.id, name: doc.name } });
      if (!existing) {
        await prisma.document.create({
          data: {
            studentId: stu.id, applicationId: app.id,
            name: doc.name, category: doc.category,
            fileUrl: `private:${stu.id}/placeholder.pdf`,
            fileName: "placeholder.pdf", mimeType: "application/pdf", fileSize: 150000,
            status: doc.status, uploadedById: user.id, uploadedAt: new Date(Date.now() - (i + 1) * 86400_000),
          },
        });
      }
    }

    // Invoice + payment
    if (d.fee > 0) {
      const invNum = `INV-${year}-${seq}`;
      const existingInvoice = await prisma.invoice.findUnique({ where: { invoiceNumber: invNum } });
      if (!existingInvoice) {
        const inv = await prisma.invoice.create({
          data: {
            invoiceNumber: invNum, studentId: stu.id,
            items: [{ description: "Consultancy & processing service", quantity: 1, unitPrice: d.fee }],
            subtotal: d.fee, total: d.fee, dueAmount: d.fee - d.paid, paidAmount: d.paid,
            status: d.paid >= d.fee ? "PAID" : d.paid > 0 ? "PARTIAL" : "ISSUED",
            issueDate: new Date(Date.now() - (i + 1) * 15 * 86400_000),
            dueDate: new Date(Date.now() + 30 * 86400_000),
          },
        });
        if (d.paid > 0) {
          await prisma.payment.create({
            data: {
              studentId: stu.id, invoiceId: inv.id, amount: d.paid, currency: "BDT",
              paymentMethod: i % 2 === 0 ? "BKASH" : "BANK_TRANSFER",
              transactionReference: `TXN-DEMO-${seq}`, status: "PAID",
              paymentDate: new Date(Date.now() - (i + 1) * 12 * 86400_000),
              createdById: adminUser.id,
            },
          });
        }
      }
    }

    // Notification
    const existingNotif = await prisma.notification.findFirst({ where: { userId: user.id, type: "APPLICATION_STAGE_CHANGED" } });
    if (!existingNotif) {
      await prisma.notification.create({
        data: {
          userId: user.id, type: "APPLICATION_STAGE_CHANGED",
          title: "Application updated",
          message: `Your application ${appNum} is now at ${d.stage.replace(/_/g, " ")} stage.`,
          link: "/student/application",
        },
      });
    }

    // Student preferences
    await prisma.studentPreference.upsert({
      where: { studentId: stu.id },
      update: {},
      create: { studentId: stu.id, theme: i % 2 === 0 ? "system" : "light", language: "en" },
    });
  }

  // ════════════════════════════════════════════
  //  CONVERSATIONS + MESSAGES for demo students
  // ════════════════════════════════════════════
  console.log("Seeding conversations for demo students…");
  for (let i = 0; i < demoStudentIds.length; i++) {
    const { studentId, userId } = demoStudentIds[i];
    const d = demo[i];
    const existingConv = await prisma.conversation.findFirst({ where: { studentId } });
    if (!existingConv) {
      const conv = await prisma.conversation.create({
        data: { studentId, employeeId: d.emp.id, lastMessageAt: new Date(Date.now() - (i + 1) * 3600_000) },
      });
      await prisma.message.create({
        data: {
          conversationId: conv.id, senderId: d.emp.userId,
          body: `Hi ${d.first}! I'm your counselor at Euroscope. Your application is being processed. Let me know if you have any questions.`,
          readAt: i < 3 ? new Date() : null,
          createdAt: new Date(Date.now() - (i + 1) * 7200_000),
        },
      });
      await prisma.message.create({
        data: {
          conversationId: conv.id, senderId: userId,
          body: `Thank you! I'll check the document list and upload everything soon.`,
          readAt: null,
          createdAt: new Date(Date.now() - (i + 1) * 3600_000),
        },
      });
    }
  }

  // ════════════════════════════════════════════
  //  APPOINTMENTS for demo students
  // ════════════════════════════════════════════
  console.log("Seeding appointments for demo students…");
  for (let i = 0; i < Math.min(3, demoStudentIds.length); i++) {
    const { studentId } = demoStudentIds[i];
    const d = demo[i];
    const existing = await prisma.appointment.findFirst({ where: { studentId } });
    if (!existing) {
      await prisma.appointment.create({
        data: {
          studentId, employeeId: d.emp.id,
          scheduledAt: new Date(Date.now() + (i + 2) * 86400_000),
          durationMins: 30, purpose: i === 0 ? "Application Planning" : i === 1 ? "Document Review" : "Visa Consultation",
          location: i === 0 ? "Online" : "Euroscope Office, Dhaka",
          meetingMethod: i === 0 ? "VIDEO_CALL" : "IN_PERSON",
          meetingLink: i === 0 ? "https://meet.google.com/abc-defg-hij" : null,
          status: "SCHEDULED",
        },
      });
    }
  }

  // ════════════════════════════════════════════
  //  SUPPORT REQUESTS
  // ════════════════════════════════════════════
  console.log("Seeding support requests…");
  const supportData = [
    { studentIdx: 0, subject: "Question about application deadline", category: "APPLICATION", description: "Hi, I need to know the deadline for the Winter 2026 intake at TU Munich. Can you help?", status: "OPEN" },
    { studentIdx: 2, subject: "Visa document clarification", category: "VISA", description: "I'm confused about the blocked account requirement. How much do I need to show?", status: "IN_PROGRESS", response: "You need to show approximately €11,208 for the blocked account. I'll send you the details by email.", respondedAt: new Date(), respondedById: employee2User.id },
    { studentIdx: 3, subject: "Payment confirmation", category: "PAYMENTS", description: "I made the payment last week but haven't received a confirmation. My invoice is INV-2025-000104.", status: "RESOLVED", response: "We've confirmed your payment. Your invoice is now marked as PAID. Thank you!", respondedAt: new Date(Date.now() - 2 * 86400_000), respondedById: adminUser.id },
  ];
  for (const s of supportData) {
    if (s.studentIdx < demoStudentIds.length) {
      const { studentId } = demoStudentIds[s.studentIdx];
      const existing = await prisma.supportRequest.findFirst({ where: { studentId, subject: s.subject } });
      if (!existing) {
        await prisma.supportRequest.create({
          data: {
            studentId, subject: s.subject, category: s.category, description: s.description,
            status: s.status, priority: s.status === "OPEN" ? "MEDIUM" : "LOW",
            response: s.response, respondedAt: s.respondedAt, respondedById: s.respondedById,
          },
        });
      }
    }
  }

  // ════════════════════════════════════════════
  //  INTAKES
  // ════════════════════════════════════════════
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
  for (let i = 0; i < intakePlan.length; i++) {
    const course = courses[i % courses.length];
    const existingIntake = await prisma.intake.findFirst({ where: { courseId: course.id, name: intakePlan[i].name } });
    if (!existingIntake) {
      await prisma.intake.create({
        data: { courseId: course.id, name: intakePlan[i].name, month: intakePlan[i].month, year: intakePlan[i].year, deadline: new Date(intakePlan[i].year, intakePlan[i].month - 1, 1), status: "ACTIVE" },
      });
    }
  }

  // ════════════════════════════════════════════
  //  LEADS — from website + referrals
  // ════════════════════════════════════════════
  console.log("Seeding leads…");
  const leadData = [
    { name: "Fatima Khan", email: "fatima@example.com", phone: "+8801711111111", source: "WEBSITE", status: "NEW", notes: "Destination: Germany\nLevel: MASTER\nCourse: MSc Computer Science\nMessage: I want to study in Germany, please contact me." },
    { name: "Imran Hossain", email: "imran@example.com", phone: "+8801722222222", source: "WEBSITE", status: "CONTACTED", assignedEmployeeId: employee.id, notes: "Destination: France\nLevel: BACHELOR\nMessage: Looking for affordable Bachelor programs in France." },
    { name: "Sumaiya Akter", email: "sumaiya@example.com", phone: "+8801733333333", source: "REFERRAL", status: "COUNSELING", assignedEmployeeId: employee2.id, notes: "Referred by Ayesha Rahman. Interested in Netherlands." },
    { name: "Jahidul Islam", email: "jahid@example.com", phone: "+8801744444444", source: "FACEBOOK", status: "NEW", notes: "Saw our Facebook ad. Interested in Italy for design courses." },
  ];
  for (const l of leadData) {
    const existing = await prisma.lead.findFirst({ where: { email: l.email } });
    if (!existing) {
      await prisma.lead.create({ data: l });
    }
  }

  // ════════════════════════════════════════════
  //  ENSURE deletedAt EXISTS (MongoDB schemaless quirk)
  // ════════════════════════════════════════════
  for (const m of ["application","branch","country","course","document","employee","intake","invoice","lead","payment","student","task","university","user","visaApplication","appointment","supportRequest","conversation","message"] as const) {
    // @ts-expect-error dynamic model access
    await prisma[m].updateMany({ data: { deletedAt: null } });
  }

  console.log("\n✅ Seed complete! Demo accounts:");
  console.log("  admin@example.com    / Admin@12345");
  console.log("  employee@example.com / Employee@12345");
  console.log("  visa@euroscope.app   / Employee@12345");
  console.log("  student@example.com  / Student@12345");
  console.log("\n📊 Data summary:");
  console.log("  3 users (admin + 2 employees + 6 students)");
  console.log("  15 European countries with visa requirements");
  console.log("  10 universities with descriptions");
  console.log("  11 courses with intake schedules");
  console.log("  6 students with applications, documents, invoices");
  console.log("  2 visa applications (Nusrat + Rafiul)");
  console.log("  6 conversations with 2 messages each");
  console.log("  4 appointments (1 scheduled, 3 for demo students)");
  console.log("  3 support requests (open/in-progress/resolved)");
  console.log("  4 leads (website + referral + facebook)");
  console.log("  6 student preference records");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
