import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ICONS, FaIcon } from "@/components/marketing/icons";
import { Container, Section, Eyebrow, MarketingButton } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { CTASection } from "@/components/marketing/sections";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const course = await prisma.course.findUnique({
    where: { slug },
    include: { university: { include: { country: true } } },
  });
  if (!course) {
    return { title: "Course not found" };
  }
  return {
    title: `${course.name} at ${course.university?.name ?? "Euroscope"}`,
    description: `${course.name} — ${course.degreeLevel} at ${course.university?.name ?? "a European university"}. Tuition fees and entry requirements.`,
  };
}

/**
 * Course detail page — public marketing page for a single course.
 *
 * Shows: course name, university, level, tuition fee, entry requirements,
 * and a CTA to start an application.
 */
export default async function CourseDetailPage({ params }: Params) {
  const { slug } = await params;
  const course = await prisma.course.findUnique({
    where: { slug, deletedAt: null },
    include: {
      university: {
        include: { country: true },
      },
    },
  });

  if (!course) notFound();

  const university = course.university;

  return (
    <>
      {/* Hero header */}
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden>
          <div
            className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full opacity-35 blur-[120px]"
            style={{ background: "radial-gradient(circle, #1e40af 0%, transparent 60%)" }}
          />
          <div className="absolute inset-0 euroscope-grid-bg opacity-20" />
        </div>
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <MarketingReveal>
              <Eyebrow tone="accent" className="justify-center">
                {course.degreeLevel} Program
              </Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
                {course.name}
              </h1>
            </MarketingReveal>
            {university && (
              <MarketingReveal delay={160}>
                <p className="mt-4 text-lg text-white/70">
                  at{" "}
                  <Link
                    href={`/universities/${university.slug}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    {university.name}
                  </Link>
                  {university.country && (
                    <span className="ml-2">
                      {university.country.flag} {university.country.name}
                    </span>
                  )}
                </p>
              </MarketingReveal>
            )}
            <MarketingReveal delay={240}>
              <div className="mt-8 flex justify-center">
                <MarketingButton href="/contact" variant="primary" size="lg">
                  Apply for this course
                  <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
                </MarketingButton>
              </div>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      {/* Course details */}
      <Section tone="default">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Level</p>
              <p className="mt-2 font-display text-xl font-bold">{course.degreeLevel}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tuition Fee</p>
              <p className="mt-2 font-display text-xl font-bold">
                {course.tuitionFee
                  ? `${course.currency || "EUR"} ${course.tuitionFee.toLocaleString()}`
                  : "Free"}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Duration</p>
              <p className="mt-2 font-display text-xl font-bold">{course.duration || "—"}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Application Fee</p>
              <p className="mt-2 font-display text-xl font-bold">
                {university?.applicationFee ? `${university.country?.currency || "EUR"} ${university.applicationFee}` : "Free"}
              </p>
            </div>
          </div>

          {/* Entry requirements */}
          {(course.englishRequirements || course.ieltsRequirement || course.toeflRequirement) && (
            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-bold tracking-tight">Entry requirements</h2>
              <div className="mt-4 space-y-3">
                {course.englishRequirements && (
                  <div className="flex items-start gap-3">
                    <FaIcon icon={ICONS.fileLines} className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold">English requirement</p>
                      <p className="text-sm text-muted-foreground">{course.englishRequirements}</p>
                    </div>
                  </div>
                )}
                {course.ieltsRequirement && (
                  <div className="flex items-start gap-3">
                    <FaIcon icon={ICONS.clipboardCheck} className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold">IELTS</p>
                      <p className="text-sm text-muted-foreground">{course.ieltsRequirement}</p>
                    </div>
                  </div>
                )}
                {course.toeflRequirement && (
                  <div className="flex items-start gap-3">
                    <FaIcon icon={ICONS.clipboardCheck} className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold">TOEFL</p>
                      <p className="text-sm text-muted-foreground">{course.toeflRequirement}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {course.academicRequirements && (
            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-bold tracking-tight">Academic requirements</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{course.academicRequirements}</p>
            </div>
          )}
        </Container>
      </Section>

      <CTASection />
    </>
  );
}
