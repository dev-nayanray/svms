import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { HeroSection } from "@/components/marketing/hero";
import { DestinationSection } from "@/components/marketing/destinations";
import {
  ProblemSection,
  SolutionSection,
  JourneyTimeline,
  HowItWorks,
  TrustSection,
  CTASection,
} from "@/components/marketing/sections";
import { FeatureGrid, ProductShowcase } from "@/components/marketing/showcase";
import { FAQ } from "@/components/marketing/faq";

/**
 * Marketing homepage — the public face of Euroscope.
 *
 * Authenticated users are redirected to their role's panel so they
 * don't see the marketing site on every visit. Unauthenticated users
 * see the full marketing experience with the hero, destinations,
 * problem/solution, journey timeline, features, product showcase,
 * trust, FAQ and final CTA.
 */
export default async function HomePage() {
  const session = await getSession();
  if (session.user.role) {
    const role = session.user.role;
    redirect(role === "ADMIN" ? "/admin" : role === "EMPLOYEE" ? "/employee" : "/student");
  }

  return (
    <>
      <HeroSection />
      <DestinationSection />
      <ProblemSection />
      <SolutionSection />
      <JourneyTimeline />
      <FeatureGrid />
      <ProductShowcase />
      <HowItWorks />
      <TrustSection />
      <FAQ />
      <CTASection />
    </>
  );
}
