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
  const university = await prisma.university.findUnique({
    where: { slug },
    include: { country: true },
  });
  if (!university) {
    return { title: "University not found" };
  }
  return {
    title: `${university.name} — Study at ${university.name}`,
    description: `${university.name} in ${university.country?.name ?? "Europe"}. Explore courses, tuition fees and admission requirements.`,
  };
}

/**
 * University detail page — public marketing page for a single university.
 *
 * Shows: university name, country, ranking, application fee, available
 * courses, and a CTA to start an application via the contact form.
 *
 * Universities without seeded data 404 cleanly.
 */
export default async function UniversityDetailPage({ params }: Params) {
  const { slug } = await params;
  const university = await prisma.university.findUnique({
    where: { slug, deletedAt: null },
    include: {
      country: true,
      courses: {
        where: { deletedAt: null },
        orderBy: [{ degreeLevel: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!university) notFound();

  const country = university.country;

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
                {country?.flag ?? "🇪🇺"} {country?.name ?? "Europe"}
              </Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
                {university.name}
              </h1>
            </MarketingReveal>
            {university.ranking && (
              <MarketingReveal delay={160}>
                <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/80">
                  <FaIcon icon={ICONS.star} className="h-3.5 w-3.5 text-accent" aria-hidden />
                  World ranking #{university.ranking}
                </p>
              </MarketingReveal>
            )}
            <MarketingReveal delay={240}>
              <div className="mt-8 flex justify-center">
                <MarketingButton href="/contact" variant="primary" size="lg">
                  Start Your Application
                  <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
                </MarketingButton>
              </div>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      {/* Quick facts */}
      <Section tone="default">
        <Container>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Application Fee</p>
              <p className="mt-2 font-display text-2xl font-bold">
                {university.applicationFee ? `${country?.currency ?? "EUR"} ${university.applicationFee}` : "Free"}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Country</p>
              <p className="mt-2 font-display text-2xl font-bold">{country?.name ?? "—"}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">World Ranking</p>
              <p className="mt-2 font-display text-2xl font-bold">
                {university.ranking ? `#${university.ranking}` : "—"}
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Courses */}
      <Section tone="muted">
        <Container>
          <div className="mx-auto max-w-2xl">
            <MarketingReveal>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Available courses
              </h2>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <p className="mt-3 text-sm text-muted-foreground">
                {university.courses.length} program{university.courses.length !== 1 ? "s" : ""} at {university.name}
              </p>
            </MarketingReveal>
          </div>

          {university.courses.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No courses seeded yet. Run <code className="rounded bg-muted px-1.5 py-0.5">npm run seed</code> to populate.
              </p>
            </div>
          ) : (
            <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Course</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Level</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tuition Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {university.courses.map((course) => (
                    <tr key={course.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{course.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{course.degreeLevel}</span>
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

      {/* Country link */}
      {country && (
        <Section tone="default">
          <Container>
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Want to explore more universities in {country.name}?
              </p>
              <Link
                href={`/study-in-europe/${country.name.toLowerCase().replace(/\s+/g, "-")}`}
                className="mt-3 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                View all {country.name} destinations
                <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </Container>
        </Section>
      )}

      <CTASection />
    </>
  );
}
