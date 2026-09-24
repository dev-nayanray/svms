import type { Metadata } from "next";
import { Mail, MapPin, Clock } from "lucide-react";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { ContactForm } from "@/components/marketing/contact-form";
import { SUPPORT_EMAIL } from "@/lib/constants/app";

export const metadata: Metadata = {
  title: "Contact — Book Your Free Consultation",
  description:
    "Book a free consultation with Euroscope. Tell us about your European study goals and we'll help you take the next step.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <MarketingNavbar />
      <main>
        <section className="bg-brand-gradient py-20 text-primary-foreground md:py-24">
          <div className="container-marketing">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-300">
              Contact
            </p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Book your free consultation
            </h1>
            <p className="mt-4 max-w-2xl text-base text-primary-foreground/80 text-pretty sm:text-lg">
              Tell us about your European study goals. A member of our team will contact you within
              one business day to schedule your consultation.
            </p>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-background">
          <div className="container-marketing grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ContactForm />
            </div>

            <aside className="space-y-6">
              <div className="card-elevated p-5">
                <h3 className="text-sm font-semibold">Contact details</h3>
                <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground">
                      {SUPPORT_EMAIL}
                    </a>
                  </li>
                  <li className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>Remote-first, serving students worldwide</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>Replies within one business day</span>
                  </li>
                </ul>
              </div>

              <div className="card-elevated p-5">
                <h3 className="text-sm font-semibold">What happens next</h3>
                <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      1
                    </span>
                    <span>We review your submission and match you with a counselor.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      2
                    </span>
                    <span>You receive an email with available consultation times.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      3
                    </span>
                    <span>We help you plan your European study journey.</span>
                  </li>
                </ol>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
