"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "What is Euroscope?",
    a: "Euroscope is a complete platform for students planning to study in Europe. It brings university discovery, application management, document tracking, visa preparation, and communication into one organized workspace — for students, employees, and administrators.",
  },
  {
    q: "Which European countries can I study in?",
    a: "Euroscope currently supports eight European destinations: Germany, France, Italy, Spain, the Netherlands, Ireland, Sweden, and Finland. We are continually expanding to additional countries.",
  },
  {
    q: "How does Euroscope help students?",
    a: "Students get a personal dashboard showing application progress, document checklists, deadlines, payments, and direct communication with their counselor. Every step of the journey is tracked so students always know what to do next.",
  },
  {
    q: "Can I track my application status?",
    a: "Yes. Euroscope tracks applications through eighteen stages — from lead capture to arrival in Europe. Students see real-time progress and the next action required.",
  },
  {
    q: "Can I manage documents through Euroscope?",
    a: "Yes. Students upload required documents, see their status (Requested, Uploaded, Under Review, Approved, Rejected), and receive notifications when documents are reviewed by their counselor.",
  },
  {
    q: "How does visa preparation work?",
    a: "Euroscope provides a structured visa workflow covering preparation, submission, biometrics, interview, and decision tracking. Your counselor guides you through each step with required documents and appointment management.",
  },
  {
    q: "Can employees manage multiple students?",
    a: "Yes. The employee workspace is a CRM-style dashboard showing assigned students, applications, documents, tasks, visa cases, and appointments — all in one place, scoped to the employee's assignments.",
  },
  {
    q: "Is Euroscope suitable for education consultancies?",
    a: "Yes. Euroscope is built for education consultancies of any size — from solo counselors to multi-branch operations. Admins get full oversight of students, employees, branches, finance, and reports with role-based permissions and audit logging.",
  },
  {
    q: "How can I get started?",
    a: "Use the contact form to book a free consultation. We'll set up your account and walk you through the platform based on whether you're a student, counselor, or administrator.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container-marketing">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            FAQ
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Questions, answered
          </h2>
          <p className="mt-4 text-base text-muted-foreground text-pretty">
            Everything you need to know about Euroscope, the platform, and how it supports your European study journey.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl divide-y divide-border rounded-lg border border-border bg-card">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  className="flex w-full items-center justify-between gap-4 p-5 text-left focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-${i}`}
                >
                  <span className="text-sm font-semibold sm:text-base">{item.q}</span>
                  <ChevronDown
                    className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
                {isOpen && (
                  <div id={`faq-${i}`} className="px-5 pb-5 text-sm text-muted-foreground text-pretty">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
