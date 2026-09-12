"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container, Section, Eyebrow } from "./ui";
import { MarketingReveal } from "./reveal";
import { APP_NAME } from "@/lib/constants/app";

const FAQS = [
  {
    q: "What is Euroscope?",
    a: `${APP_NAME} is a European education and student visa management platform. It helps students manage their entire journey — from choosing a university to preparing their visa application — in one organized place. It also serves education consultancies that manage multiple students.`,
  },
  {
    q: "Which European countries can I study in?",
    a: `${APP_NAME} supports applications to universities across major European study destinations including Germany, France, Italy, Spain, the Netherlands, Sweden, Finland, Denmark, Ireland, Poland, Hungary, Portugal, Austria, Belgium and the Czech Republic. Browse the Study in Europe section for details.`,
  },
  {
    q: "How does Euroscope help students?",
    a: `Students get a personal dashboard with their application pipeline, document checklist, visa progress, task deadlines, payments and messages with their counselor. Real-time updates arrive via Server-Sent Events — no refreshing required.`,
  },
  {
    q: "Can I track my application?",
    a: `Yes. Every application moves through a visible pipeline — Lead → Counselling → Document Collection → University Application → Offer → Visa → Travel. Students see the current stage, history and next steps in real time.`,
  },
  {
    q: "Can I manage documents through Euroscope?",
    a: `Yes. Students upload documents (passport, transcripts, English certificate, financial proof, etc.) to private storage. Counselors review and approve/reject with feedback. Version history is preserved when a document is replaced.`,
  },
  {
    q: "How does visa preparation work?",
    a: `${APP_NAME} maintains country-specific visa requirements (e.g., German student visa requires passport, admission letter, blocked account proof, health insurance). Students see a checklist, mark requirements complete, and track visa submission → biometrics → interview → decision.`,
  },
  {
    q: "Can employees manage multiple students?",
    a: `Yes. Education employees get a dedicated panel with their assigned students, applications, documents, tasks, visa cases and appointments. They can review documents, schedule appointments, send messages and track performance.`,
  },
  {
    q: "Is Euroscope suitable for education consultancies?",
    a: `Yes. ${APP_NAME} is built for education consultancies of any size. Admins manage branches, employees, students, finance, reports, roles and permissions, and audit logs. The platform scales from a single counselor to a multi-branch operation.`,
  },
  {
    q: "How can I get started?",
    a: `Click "Start Your Journey" or "Book a Free Consultation" to schedule a call. We'll walk you through the platform, set up your account, and help you start your European study journey.`,
  },
];

function FAQItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 rounded-xl p-4 text-left focus-visible:outline-2 focus-visible:outline-ring"
        aria-expanded={open}
      >
        <span className="font-display text-sm font-semibold sm:text-base">{q}</span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
          {a}
        </div>
      )}
    </div>
  );
}

export function FAQ() {
  return (
    <Section tone="default" id="faq">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow className="justify-center">FAQ</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h2>
          </MarketingReveal>
        </div>
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQS.map((faq, i) => (
            <MarketingReveal key={faq.q} delay={i * 50}>
              <FAQItem q={faq.q} a={faq.a} defaultOpen={i === 0} />
            </MarketingReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
