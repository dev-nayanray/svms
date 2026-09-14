# SVMS Work Log

---
Task ID: seed-fix-001
Agent: main
Task: Fix PrismaClientValidationError on `prisma.university.updateMany({ where: { status: null ... } })` in `prisma/seed.ts`.

Work Log:
- Inspected `prisma/seed.ts` lines 620-683, identified the broken pattern on lines 652, 654, 656, 658, 659.
- Cross-referenced `prisma/schema.prisma`: confirmed `status` is non-nullable `String @default("ACTIVE")` on University, Country, Course, VisaRequirement, DocumentRequirement.
- Root cause: `status: null as unknown as string` only fools the TypeScript compiler; Prisma 6.19.3 runtime validator rejects null in `where` clauses for non-nullable fields.
- Verified that MongoDB's `$ne` (Prisma's `not:` operator) also matches documents where the field is null or missing entirely, so the second `updateMany` on each block already covers the null case.
- Removed the redundant null-query lines, kept only the `{ status: { not: "ACTIVE" } }` lines.
- Verified no other occurrences of the broken pattern in the codebase via grep.
- Type-checked via `npx tsc --noEmit --project tsconfig.json` — no errors in `seed.ts`.

Stage Summary:
- Fixed file: `/home/z/my-project/prisma/seed.ts` (lines 651-661).
- Seed script should now run cleanly past the status-patch step.
- User should re-run `npm run seed` on their local environment after pulling this change.
