import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Container, Section, Eyebrow } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { CTASection } from "@/components/marketing/sections";
import Link from "next/link";

export const metadata: Metadata = {
  title: "European Courses — Browse Study Programs",
  description:
    "Browse study programs available at European universities. Filter by level, tuition fee and language requirements.",
};

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await prisma.course.findMany({
    where: { deletedAt: null },
    include: {
      university: {
        include: { country: true },
      },
    },
    orderBy: [{ university: { name: "asc" } }, { name: "asc" }],
    take: 50,
  });

  return (
    <>
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0 euroscope-dot-bg opacity-40" aria-hidden />
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <MarketingReveal>
              <Eyebrow tone="accent" className="justify-center">Courses</Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Find your study program
              </h1>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70">
                Browse bachelor, master and PhD programs across European universities.
                See tuition fees, language requirements and intake schedules.
              </p>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      <Section tone="default">
        <Container>
          {courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No courses seeded yet. Run <code className="rounded bg-muted px-1.5 py-0.5">npm run seed</code> to populate.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Course</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell">University</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Level</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {courses.map((course) => (
                    <tr key={course.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/courses/${course.slug}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {course.name}
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                        {course.university?.name ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {course.university?.country?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                          {course.degreeLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {course.tuitionFee ? `${course.currency || "EUR"} ${course.tuitionFee.toLocaleString()}` : "Free"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </Section>

      <CTASection />
    </>
  );
}
