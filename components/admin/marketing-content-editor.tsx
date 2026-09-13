"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Loader2, Save } from "lucide-react";
import type { MarketingContent } from "@/lib/services/marketing-content";

const DEFAULT_CONTENT: MarketingContent = {
  hero: {
    badge: "European Education Consultancy",
    headlinePart1: "Study in Europe.",
    headlinePart2: "Start Your Future.",
    subtitle: "",
    ctaPrimaryText: "Book a Free Consultation",
    ctaPrimaryHref: "/contact",
    ctaSecondaryText: "Explore Europe",
    ctaSecondaryHref: "/study-in-europe",
    trustLine: "",
  },
  cta: {
    eyebrow: "Get Started",
    headlinePart1: "Your European Future",
    headlinePart2: "Starts Here.",
    subtitle: "",
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

  const { isLoading } = useQuery({
    queryKey: ["admin", "marketing-content"],
    queryFn: () => apiFetch<MarketingContent>("/api/admin/marketing-content"),
    retry: false,
  });

  // Load content into state once the query resolves
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<MarketingContent>("/api/admin/marketing-content");
        setContent(data);
      } catch {
        // keep defaults
      }
    })();
  }, []);

  const saveMutation = useMutation({
    mutationFn: (data: MarketingContent) =>
      apiFetch("/api/admin/marketing-content", { method: "PUT", json: data }),
    onSuccess: () => {
      toast({ title: "Saved", description: "Marketing content updated." });
      qc.invalidateQueries({ queryKey: ["admin", "marketing-content"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save.", variant: "error" });
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

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Marketing Content"
        description="Edit the marketing site hero, CTA, and FAQ. Changes go live immediately."
      />
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open("/?preview=1", "_blank")}
        >
          Preview Site
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

      <div className="space-y-6">
        {/* Hero section */}
        <Card>
          <CardHeader>
            <CardTitle>Homepage Hero</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Badge text" value={content.hero.badge} onChange={(v) => updateHero("badge", v)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Headline (part 1)" value={content.hero.headlinePart1} onChange={(v) => updateHero("headlinePart1", v)} />
              <Field label="Headline (part 2, gradient)" value={content.hero.headlinePart2} onChange={(v) => updateHero("headlinePart2", v)} />
            </div>
            <Field label="Subtitle" value={content.hero.subtitle} onChange={(v) => updateHero("subtitle", v)} textarea />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary CTA text" value={content.hero.ctaPrimaryText} onChange={(v) => updateHero("ctaPrimaryText", v)} />
              <Field label="Primary CTA link" value={content.hero.ctaPrimaryHref} onChange={(v) => updateHero("ctaPrimaryHref", v)} />
              <Field label="Secondary CTA text" value={content.hero.ctaSecondaryText} onChange={(v) => updateHero("ctaSecondaryText", v)} />
              <Field label="Secondary CTA link" value={content.hero.ctaSecondaryHref} onChange={(v) => updateHero("ctaSecondaryHref", v)} />
            </div>
            <Field label="Trust line" value={content.hero.trustLine} onChange={(v) => updateHero("trustLine", v)} />
          </CardContent>
        </Card>

        {/* CTA section */}
        <Card>
          <CardHeader>
            <CardTitle>Final CTA Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Eyebrow" value={content.cta.eyebrow} onChange={(v) => updateCta("eyebrow", v)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Headline (part 1)" value={content.cta.headlinePart1} onChange={(v) => updateCta("headlinePart1", v)} />
              <Field label="Headline (part 2, gradient)" value={content.cta.headlinePart2} onChange={(v) => updateCta("headlinePart2", v)} />
            </div>
            <Field label="Subtitle" value={content.cta.subtitle} onChange={(v) => updateCta("subtitle", v)} textarea />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary CTA text" value={content.cta.ctaPrimaryText} onChange={(v) => updateCta("ctaPrimaryText", v)} />
              <Field label="Primary CTA link" value={content.cta.ctaPrimaryHref} onChange={(v) => updateCta("ctaPrimaryHref", v)} />
              <Field label="Secondary CTA text" value={content.cta.ctaSecondaryText} onChange={(v) => updateCta("ctaSecondaryText", v)} />
              <Field label="Secondary CTA link" value={content.cta.ctaSecondaryHref} onChange={(v) => updateCta("ctaSecondaryHref", v)} />
            </div>
          </CardContent>
        </Card>

        {/* FAQ section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>FAQ Items ({content.faq.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={addFaqItem}>
                + Add FAQ
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {content.faq.map((item, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    FAQ #{i + 1}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFaqItem(i)}
                    className="text-destructive"
                  >
                    Remove
                  </Button>
                </div>
                <Field label="Question" value={item.q} onChange={(v) => updateFaqItem(i, "q", v)} />
                <Field label="Answer" value={item.a} onChange={(v) => updateFaqItem(i, "a", v)} textarea />
              </div>
            ))}
            {content.faq.length === 0 && (
              <p className="text-sm text-muted-foreground">No FAQ items. Click &ldquo;Add FAQ&rdquo; to create one.</p>
            )}
          </CardContent>
        </Card>

        {/* Save bar */}
        <div className="sticky bottom-4 flex justify-end gap-2 rounded-lg border border-border bg-card p-3 shadow-lg">
          <Button
            variant="outline"
            onClick={() => window.open("/?preview=1", "_blank")}
          >
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
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

function Field({
  label,
  value,
  onChange,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
        />
      )}
    </label>
  );
}
