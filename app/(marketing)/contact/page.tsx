import type { Metadata } from "next";
import { Container, Section, Eyebrow } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact — Book Your Free Consultation",
  description:
    "Book a free consultation with Euroscope. Tell us about your European study plans and our team will reach out within 24 hours.",
};

export default function ContactPage() {
  return (
    <Section tone="default">
      <Container>
        <div className="mx-auto max-w-2xl">
          <MarketingReveal>
            <Eyebrow>Contact</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Book your free consultation
            </h1>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Tell us a bit about your European study plans. One of our counselors will
              reach out within 24 hours to schedule a free consultation.
            </p>
          </MarketingReveal>
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <MarketingReveal delay={240}>
            <ContactForm />
          </MarketingReveal>
        </div>
      </Container>
    </Section>
  );
}
