"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-kit";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Loader2, Save, Eye, Plus, Trash2, Megaphone, Star, HelpCircle, Layers, Shield, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketingContent, ContentItem } from "@/lib/services/marketing-content";

// Available icon keys for the dropdown
const ICON_OPTIONS = [
  "comments", "graduationCap", "clipboardCheck", "fileLines", "planeDeparture", "envelope",
  "earthEurope", "users", "handshake", "eye", "clock", "shieldCheck",
  "fileQuestion", "layerGroup", "triangleWarning", "passport", "calendarXmark", "poorCommunication",
  "lock", "userShield", "folderLock", "scroll",
  "lightbulb", "route", "peopleArrows", "plane",
  "arrowRight", "sparkles", "locationDot", "compass", "userGraduate", "star",
];

const DEFAULT_CONTENT: MarketingContent = {
  hero: {
    badge: "European Education Consultancy",
    headlinePart1: "Study in Europe.",
    headlinePart2: "Start Your Future.",
    subtitle: "Euroscope is a European education consultancy that guides students through every step — from choosing the right university to preparing your visa. We don't just give you a portal — we walk with you.",
    ctaPrimaryText: "Book a Free Consultation", ctaPrimaryHref: "/contact",
    ctaSecondaryText: "Explore Europe", ctaSecondaryHref: "/study-in-europe",
    trustLine: "Personalized guidance · End-to-end support · European expertise",
  },
  services: [], whyEuroscope: [], howWeHelp: [], problems: [], trust: [],
  cta: {
    eyebrow: "Get Started", headlinePart1: "Your European Future", headlinePart2: "Starts Here.",
    subtitle: "Talk to our counselors and get a personalized plan for your European study journey. No pressure, no obligation — just honest guidance.",
    ctaPrimaryText: "Book a Free Consultation", ctaPrimaryHref: "/contact",
    ctaSecondaryText: "Explore Destinations", ctaSecondaryHref: "/study-in-europe",
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
      try { setContent(await apiFetch<MarketingContent>("/api/admin/marketing-content")); }
      catch { /* keep defaults */ }
      finally { setLoading(false); }
    })();
  }, []);

  const saveMutation = useMutation({
    mutationFn: (data: MarketingContent) => apiFetch("/api/admin/marketing-content", { method: "PUT", json: data }),
    onSuccess: () => { toast({ title: "Saved", description: "Marketing content updated." }); qc.invalidateQueries({ queryKey: ["admin", "marketing-content"] }); },
    onError: () => { toast({ title: "Error", description: "Failed to save.", variant: "error" }); },
  });

  const handleSave = () => saveMutation.mutate(content);
  const updateHero = (f: keyof MarketingContent["hero"], v: string) => setContent((c) => ({ ...c, hero: { ...c.hero, [f]: v } }));
  const updateCta = (f: keyof MarketingContent["cta"], v: string) => setContent((c) => ({ ...c, cta: { ...c.cta, [f]: v } }));
  const updateFaq = (i: number, f: "q" | "a", v: string) => setContent((c) => ({ ...c, faq: c.faq.map((x, j) => j === i ? { ...x, [f]: v } : x) }));
  const addFaq = () => setContent((c) => ({ ...c, faq: [...c.faq, { q: "", a: "" }] }));
  const removeFaq = (i: number) => setContent((c) => ({ ...c, faq: c.faq.filter((_, j) => j !== i) }));
  const updateItems = (key: keyof Pick<MarketingContent, "services" | "whyEuroscope" | "howWeHelp" | "problems" | "trust">, i: number, f: keyof ContentItem, v: string) => setContent((c) => ({ ...c, [key]: c[key].map((x, j) => j === i ? { ...x, [f]: v } : x) }));
  const addItem = (key: keyof Pick<MarketingContent, "services" | "whyEuroscope" | "howWeHelp" | "problems" | "trust">) => setContent((c) => ({ ...c, [key]: [...c[key], { icon: "comments", title: "New item", description: "" }] }));
  const removeItem = (key: keyof Pick<MarketingContent, "services" | "whyEuroscope" | "howWeHelp" | "problems" | "trust">, i: number) => setContent((c) => ({ ...c, [key]: c[key].filter((_, j) => j !== i) }));

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const TABS = [
    { id: "hero", label: "Hero", icon: <Star className="h-4 w-4" /> },
    { id: "services", label: `Services (${content.services.length})`, icon: <Layers className="h-4 w-4" /> },
    { id: "why", label: `Why Us (${content.whyEuroscope.length})`, icon: <Shield className="h-4 w-4" /> },
    { id: "how", label: `How We Help (${content.howWeHelp.length})`, icon: <Lightbulb className="h-4 w-4" /> },
    { id: "problems", label: `Problems (${content.problems.length})`, icon: <HelpCircle className="h-4 w-4" /> },
    { id: "trust", label: `Trust (${content.trust.length})`, icon: <Shield className="h-4 w-4" /> },
    { id: "cta", label: "Final CTA", icon: <Megaphone className="h-4 w-4" /> },
    { id: "faq", label: `FAQ (${content.faq.length})`, icon: <HelpCircle className="h-4 w-4" /> },
  ];

  return (
    <div>
      <PageHeader title="Marketing Site" description="Edit all marketing site content. Changes go live immediately after saving." />
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Megaphone className="h-4 w-4" aria-hidden /><span>Content stored in database, served dynamically.</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/?preview=1", "_blank")}><Eye className="h-4 w-4" />Preview</Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex overflow-x-auto border-b border-border bg-muted/30">
          {TABS.map((tab) => (
            <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} icon={tab.icon} label={tab.label} />
          ))}
        </div>
        <div className="p-6">
          {activeTab === "hero" && (<HeroEditor content={content} updateHero={updateHero} />)}
          {activeTab === "cta" && (<CtaEditor content={content} updateCta={updateCta} />)}
          {activeTab === "faq" && (<FaqEditor items={content.faq} add={addFaq} remove={removeFaq} update={updateFaq} />)}
          {activeTab === "services" && (<ItemsEditor title="Services" items={content.services} add={() => addItem("services")} remove={(i) => removeItem("services", i)} update={(i, f, v) => updateItems("services", i, f, v)} />)}
          {activeTab === "why" && (<ItemsEditor title="Why Euroscope" items={content.whyEuroscope} add={() => addItem("whyEuroscope")} remove={(i) => removeItem("whyEuroscope", i)} update={(i, f, v) => updateItems("whyEuroscope", i, f, v)} />)}
          {activeTab === "how" && (<ItemsEditor title="How We Help" items={content.howWeHelp} add={() => addItem("howWeHelp")} remove={(i) => removeItem("howWeHelp", i)} update={(i, f, v) => updateItems("howWeHelp", i, f, v)} />)}
          {activeTab === "problems" && (<ItemsEditor title="Problems" items={content.problems} add={() => addItem("problems")} remove={(i) => removeItem("problems", i)} update={(i, f, v) => updateItems("problems", i, f, v)} />)}
          {activeTab === "trust" && (<ItemsEditor title="Trust & Security" items={content.trust} add={() => addItem("trust")} remove={(i) => removeItem("trust", i)} update={(i, f, v) => updateItems("trust", i, f, v)} />)}
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-2 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-md">
        <p className="text-xs text-muted-foreground">{TABS.find((t) => t.id === activeTab)?.label}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/?preview=1", "_blank")}><Eye className="h-4 w-4" />Preview</Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save All</Button>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex shrink-0 items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2", active ? "border-primary text-primary" : "border-transparent text-foreground/60 hover:text-foreground")}>
      {icon}{label}
    </button>
  );
}

function HeroEditor({ content, updateHero }: { content: MarketingContent; updateHero: (f: keyof MarketingContent["hero"], v: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="mb-4"><h3 className="text-sm font-semibold">Homepage Hero</h3><p className="mt-1 text-xs text-muted-foreground">The first thing visitors see.</p></div>
      <Field label="Badge text" value={content.hero.badge} onChange={(v) => updateHero("badge", v)} hint="Small label above the headline" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Headline (part 1)" value={content.hero.headlinePart1} onChange={(v) => updateHero("headlinePart1", v)} />
        <Field label="Headline (part 2 — gradient)" value={content.hero.headlinePart2} onChange={(v) => updateHero("headlinePart2", v)} hint="Shown in gradient color" />
      </div>
      <Field label="Subtitle" value={content.hero.subtitle} onChange={(v) => updateHero("subtitle", v)} textarea />
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">CTA Buttons</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primary text" value={content.hero.ctaPrimaryText} onChange={(v) => updateHero("ctaPrimaryText", v)} />
          <Field label="Primary link" value={content.hero.ctaPrimaryHref} onChange={(v) => updateHero("ctaPrimaryHref", v)} />
          <Field label="Secondary text" value={content.hero.ctaSecondaryText} onChange={(v) => updateHero("ctaSecondaryText", v)} />
          <Field label="Secondary link" value={content.hero.ctaSecondaryHref} onChange={(v) => updateHero("ctaSecondaryHref", v)} />
        </div>
      </div>
      <Field label="Trust line" value={content.hero.trustLine} onChange={(v) => updateHero("trustLine", v)} />
    </div>
  );
}

function CtaEditor({ content, updateCta }: { content: MarketingContent; updateCta: (f: keyof MarketingContent["cta"], v: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="mb-4"><h3 className="text-sm font-semibold">Final CTA Section</h3><p className="mt-1 text-xs text-muted-foreground">Bottom CTA on every page.</p></div>
      <Field label="Eyebrow" value={content.cta.eyebrow} onChange={(v) => updateCta("eyebrow", v)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Headline (part 1)" value={content.cta.headlinePart1} onChange={(v) => updateCta("headlinePart1", v)} />
        <Field label="Headline (part 2 — gradient)" value={content.cta.headlinePart2} onChange={(v) => updateCta("headlinePart2", v)} />
      </div>
      <Field label="Subtitle" value={content.cta.subtitle} onChange={(v) => updateCta("subtitle", v)} textarea />
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">CTA Buttons</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primary text" value={content.cta.ctaPrimaryText} onChange={(v) => updateCta("ctaPrimaryText", v)} />
          <Field label="Primary link" value={content.cta.ctaPrimaryHref} onChange={(v) => updateCta("ctaPrimaryHref", v)} />
          <Field label="Secondary text" value={content.cta.ctaSecondaryText} onChange={(v) => updateCta("ctaSecondaryText", v)} />
          <Field label="Secondary link" value={content.cta.ctaSecondaryHref} onChange={(v) => updateCta("ctaSecondaryHref", v)} />
        </div>
      </div>
    </div>
  );
}

function FaqEditor({ items, add, remove, update }: { items: { q: string; a: string }[]; add: () => void; remove: (i: number) => void; update: (i: number, f: "q" | "a", v: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-sm font-semibold">FAQ Items</h3><p className="mt-1 text-xs text-muted-foreground">Add, edit, or remove questions.</p></div>
        <Button size="sm" variant="outline" onClick={add}><Plus className="h-4 w-4" />Add FAQ</Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
            <Button size="sm" variant="ghost" onClick={() => remove(i)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" />Remove</Button>
          </div>
          <Field label="Question" value={item.q} onChange={(v) => update(i, "q", v)} />
          <Field label="Answer" value={item.a} onChange={(v) => update(i, "a", v)} textarea />
        </div>
      ))}
      {items.length === 0 && (<div className="rounded-lg border border-dashed border-border p-12 text-center"><HelpCircle className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm text-muted-foreground">No items. Click &ldquo;Add&rdquo; to create one.</p></div>)}
    </div>
  );
}

function ItemsEditor({ title, items, add, remove, update }: { title: string; items: ContentItem[]; add: () => void; remove: (i: number) => void; update: (i: number, f: keyof ContentItem, v: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">Each card has an icon, title, and description.</p></div>
        <Button size="sm" variant="outline" onClick={add}><Plus className="h-4 w-4" />Add Item</Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
            <Button size="sm" variant="ghost" onClick={() => remove(i)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" />Remove</Button>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Icon</span>
            <select value={item.icon} onChange={(e) => update(i, "icon", e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none">
              {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
            </select>
          </label>
          <Field label="Title" value={item.title} onChange={(v) => update(i, "title", v)} />
          <Field label="Description" value={item.description} onChange={(v) => update(i, "description", v)} textarea />
        </div>
      ))}
      {items.length === 0 && (<div className="rounded-lg border border-dashed border-border p-12 text-center"><Layers className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm text-muted-foreground">No items. Click &ldquo;Add Item&rdquo; to create one.</p></div>)}
    </div>
  );
}

function Field({ label, value, onChange, textarea = false, hint }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10" />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10" />
      )}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
