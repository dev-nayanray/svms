import type { Metadata } from "next";
import { ServicesSection, WhyEuroscopeSection } from "@/components/marketing/services";
import { TrustSection, CTASection } from "@/components/marketing/sections";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Services — How Euroscope Helps You Study in Europe",
  description:
    "Personal counselling, university selection, application management, document guidance, visa preparation and travel support — end-to-end services for studying in Europe.",
};

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Our Services"
        title="Personal guidance for every step"
        subtitle="From your first consultation to your arrival in Europe — our counselors provide end-to-end support tailored to you."
        cta={{ href: "/contact", label: "Book a Free Consultation" }}
      />

      <ServicesSection />
      <WhyEuroscopeSection />
      <TrustSection />
      <CTASection />
    </>
  );
}
