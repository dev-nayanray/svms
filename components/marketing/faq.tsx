"use client";

import { useState } from "react";
import { ICONS, FaIcon } from "./icons";
import { cn } from "@/lib/utils";
import { Container, Section, Eyebrow } from "./ui";
import { MarketingReveal } from "./reveal";

const DEFAULT_FAQS = [
  {
    q: "What is Euroscope?",
    a: "Euroscope is a European education and student visa management platform. It helps students manage their entire journey — from choosing a university to preparing their visa application — in one organized place.",
  },
  {
    q: "Which European countries can I study in?",
    a: "Euroscope supports applications to universities across major European study destinations including Germany, France, Italy, Spain, the Netherlands, Sweden, Finland, Denmark, Ireland and more.",
  },
  {
    q: "How can I get started?",
    a: 'Click "Book a Free Consultation" to schedule a call. We\'ll walk you through the platform and help you start your European study journey.',
  },
];

export function FAQ({ items }: { items?: { q: string; a: string }[] }) {
  const faqs = items?.length ? items : DEFAULT_FAQS;
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
          {faqs.map((faq, i: number) => (
            <MarketingReveal key={i} delay={i * 50}>
              <FAQItem q={faq.q} a={faq.a} defaultOpen={i === 0} />
            </MarketingReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

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
        <FaIcon
          icon={ICONS.chevronDown}
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
