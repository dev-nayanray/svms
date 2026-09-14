import { Container, Section, Eyebrow, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import { ICONS, FaIcon } from "./icons";

/**
 * PageHero — a reusable premium hero for interior marketing pages.
 *
 * Uses the same multi-layer background as the homepage hero (gradient +
 * radial glows + grid) so all pages feel visually consistent.
 *
 * Usage:
 *   <PageHero
 *     eyebrow="About Us"
 *     title="We make the European dream achievable"
 *     subtitle="Euroscope is a European education consultancy..."
 *     cta={{ href: "/contact", label: "Book a Free Consultation" }}
 *   />
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  cta,
  showCta = true,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  cta?: { href: string; label: string };
  showCta?: boolean;
}) {
  return (
    <Section tone="dark" className="relative overflow-hidden">
      {/* Multi-layer background — matches homepage hero */}
      <div className="absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink to-ink-surface" />
        <div
          className="absolute -top-32 left-1/2 h-[700px] w-[1000px] -translate-x-1/2 rounded-full opacity-40 blur-[140px]"
          style={{ background: "radial-gradient(ellipse, #1e40af 0%, transparent 60%)" }}
        />
        <div
          className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full opacity-15 blur-[120px]"
          style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }}
        />
        <div className="absolute inset-0 euroscope-grid-bg opacity-[0.15]" />
      </div>
      <Container className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <MarketingReveal>
            <Eyebrow tone="accent" className="justify-center">{eyebrow}</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h1 className="mt-6 font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {title}
            </h1>
          </MarketingReveal>
          {subtitle && (
            <MarketingReveal delay={160}>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl">
                {subtitle}
              </p>
            </MarketingReveal>
          )}
          {showCta && cta && (
            <MarketingReveal delay={240}>
              <div className="mt-10 flex justify-center">
                <MarketingButton href={cta.href} variant="primary" size="lg">
                  {cta.label}
                  <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
                </MarketingButton>
              </div>
            </MarketingReveal>
          )}
        </div>
      </Container>
    </Section>
  );
}
