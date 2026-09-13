"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-kit";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Loader2, Save, Eye, Plus, Trash2, Megaphone, Star, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketingContent } from "@/lib/services/marketing-content";

const DEFAULT_CONTENT: MarketingContent = {
  hero: {
    badge: "European Education Consultancy",
    headlinePart1: "Study in Europe.",
    headlinePart2: "Start Your Future.",
    subtitle:
      "Euroscope is a European education consultancy that guides students through every step — from choosing the right university to preparing your visa. We don't just give you a portal — we walk with you.",
    ctaPrimaryText: "Book a Free Consultation",
    ctaPrimaryHref: "/contact",
    ctaSecondaryText: "Explore Europe",
    ctaSecondaryHref: "/study-in-europe",
    trustLine: "Personalized guidance · End-to-end support · European expertise",
  },
  cta: {
    eyebrow: "Get Started",
    headlinePart1: "Your European Future",
    headlinePart2: "Starts Here.",
    subtitle:
      "Talk to our counselors and get a personalized plan for your European study journey. No pressure, no obligation — just honest guidance.",
    ctaPrimaryText: "Book a Free Consultation",
    ctaPrimaryHref: "/contact",
    ctaSecondaryText: "Explore Destinations",
    ctaSecondaryHref: "/study-in-europe",
  },
  faq: [],
};

export function MarketingContentEditor() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [content, setContent] = useState<MarketingContent>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("hero");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<MarketingContent>("/api/admin/marketing-content");
        setContent(data);
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveMutation = useMutation({
    mutationFn: (data: MarketingContent) =>
      apiFetch("/api/admin/marketing-content", { method: "PUT", json: data }),
    onSuccess: () => {
      toast({ title: "Saved", description: "Marketing content updated successfully." });
      qc.invalidateQueries({ queryKey: ["admin", "marketing-content"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save. Please try again.", variant: "error" });
    },
  });

  const handleSave = () => saveMutation.mutate(content);

  const updateHero = (field: keyof MarketingContent["hero"], value: string) =>
    setContent((c) => ({ ...c, hero: { ...c.hero, [field]: value } }));

  const updateCta = (field: keyof MarketingContent["cta"], value: string) =>
    setContent((c) => ({ ...c, cta: { ...c.cta, [field]: value } }));

  const updateFaqItem = (index: number, field: "q" | "a", value: string) =>
    setContent((c) => ({
      ...c,
      faq: c.faq.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));

  const addFaqItem = () =>
    setContent((c) => ({ ...c, faq: [...c.faq, { q: "", a: "" }] }));

  const removeFaqItem = (index: number) =>
    setContent((c) => ({ ...c, faq: c.faq.filter((_, i) => i !== index) }));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Marketing Site"
        description="Edit the marketing site content. Changes go live immediately after saving."
      />

      {/* Top action bar */}
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Megaphone className="h-4 w-4" aria-hidden />
          <span>Content is stored in the database and served dynamically.</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/?preview=1", "_blank")}
          >
            <Eye className="h-4 w-4" aria-hidden />
            Preview
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Premium tab interface */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Tab list — premium pill style */}
        <div className="flex border-b border-border bg-muted/30">
          <TabButton
            active={activeTab === "hero"}
            onClick={() => setActiveTab("hero")}
            icon={<Star className="h-4 w-4" aria-hidden />}
            label="Homepage Hero"
          />
          <TabButton
            active={activeTab === "cta"}
            onClick={() => setActiveTab("cta")}
            icon={<Megaphone className="h-4 w-4" aria-hidden />}
            label="Final CTA"
          />
          <TabButton
            active={activeTab === "faq"}
            onClick={() => setActiveTab("faq")}
            icon={<HelpCircle className="h-4 w-4" aria-hidden />}
            label={`FAQ (${content.faq.length})`}
          />
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === "hero" && (
            <div className="space-y-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Homepage Hero Section</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  The first thing visitors see. Edit the badge, headline, subtitle, and CTA buttons.
                </p>
              </div>

              <Field label="Badge text" value={content.hero.badge} onChange={(v) => updateHero("badge", v)} hint="Small label above the headline" />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Headline (part 1)" value={content.hero.headlinePart1} onChange={(v) => updateHero("headlinePart1", v)} />
                <Field label="Headline (part 2 — gradient)" value={content.hero.headlinePart2} onChange={(v) => updateHero("headlinePart2", v)} hint="Shown in gradient color" />
              </div>

              <Field label="Subtitle" value={content.hero.subtitle} onChange={(v) => updateHero("subtitle", v)} textarea hint="Main paragraph below the headline" />

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call-to-Action Buttons</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Primary button text" value={content.hero.ctaPrimaryText} onChange={(v) => updateHero("ctaPrimaryText", v)} />
                  <Field label="Primary button link" value={content.hero.ctaPrimaryHref} onChange={(v) => updateHero("ctaPrimaryHref", v)} />
                  <Field label="Secondary button text" value={content.hero.ctaSecondaryText} onChange={(v) => updateHero("ctaSecondaryText", v)} />
                  <Field label="Secondary button link" value={content.hero.ctaSecondaryHref} onChange={(v) => updateHero("ctaSecondaryHref", v)} />
                </div>
              </div>

              <Field label="Trust line" value={content.hero.trustLine} onChange={(v) => updateHero("trustLine", v)} hint="Small text below CTAs (e.g. 'Personalized guidance · End-to-end support')" />
            </div>
          )}

          {activeTab === "cta" && (
            <div className="space-y-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Final CTA Section</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  The last conversion section at the bottom of every marketing page.
                </p>
              </div>

              <Field label="Eyebrow" value={content.cta.eyebrow} onChange={(v) => updateCta("eyebrow", v)} hint="Small label above the headline" />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Headline (part 1)" value={content.cta.headlinePart1} onChange={(v) => updateCta("headlinePart1", v)} />
                <Field label="Headline (part 2 — gradient)" value={content.cta.headlinePart2} onChange={(v) => updateCta("headlinePart2", v)} hint="Shown in gradient color" />
              </div>

              <Field label="Subtitle" value={content.cta.subtitle} onChange={(v) => updateCta("subtitle", v)} textarea />

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call-to-Action Buttons</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Primary button text" value={content.cta.ctaPrimaryText} onChange={(v) => updateCta("ctaPrimaryText", v)} />
                  <Field label="Primary button link" value={content.cta.ctaPrimaryHref} onChange={(v) => updateCta("ctaPrimaryHref", v)} />
                  <Field label="Secondary button text" value={content.cta.ctaSecondaryText} onChange={(v) => updateCta("ctaSecondaryText", v)} />
                  <Field label="Secondary button link" value={content.cta.ctaSecondaryHref} onChange={(v) => updateCta("ctaSecondaryHref", v)} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "faq" && (
            <div className="space-y-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">FAQ Items</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Questions and answers shown in the FAQ section. Add, edit, or remove items.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={addFaqItem}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add FAQ
                </Button>
              </div>

              {content.faq.map((item, i) => (
                <div key={i} className="space-y-3 rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFaqItem(i)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Remove
                    </Button>
                  </div>
                  <Field label="Question" value={item.q} onChange={(v) => updateFaqItem(i, "q", v)} />
                  <Field label="Answer" value={item.a} onChange={(v) => updateFaqItem(i, "a", v)} textarea />
                </div>
              ))}

              {content.faq.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-12 text-center">
                  <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No FAQ items yet. Click &ldquo;Add FAQ&rdquo; to create one.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-2 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-md">
        <p className="text-xs text-muted-foreground">
          {activeTab === "hero" && "Editing: Homepage Hero"}
          {activeTab === "cta" && "Editing: Final CTA Section"}
          {activeTab === "faq" && `Editing: FAQ (${content.faq.length} items)`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/?preview=1", "_blank")}
          >
            <Eye className="h-4 w-4" aria-hidden />
            Preview Site
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save All Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Premium pill-style tab button */
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all",
        active
          ? "border-b-2 border-primary text-primary"
          : "border-b-2 border-transparent text-foreground/60 hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Form field with label, hint, and input/textarea */
function Field({
  label,
  value,
  onChange,
  textarea = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
        />
      )}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
