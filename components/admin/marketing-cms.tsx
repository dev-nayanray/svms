"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-kit";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Image as ImageIcon,
  PanelTop,
  Menu,
  Megaphone,
  Home,
  PanelBottom,
  Share2,
  Phone,
  Search,
  Code,
  Save,
  RotateCcw,
  Eye,
  Plus,
  Trash2,
  GripVertical,
  ExternalLink,
  Loader2,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { CmsConfig, NavItem, FooterColumn, SocialLink } from "@/lib/marketing/cms";

type ApiResponse = { config: CmsConfig; defaults: CmsConfig };

const SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "CONTENT" },
  { id: "homepage", label: "Homepage", icon: Home, group: "CONTENT" },
  { id: "identity", label: "Site Identity", icon: ImageIcon, group: "SITE" },
  { id: "header", label: "Header", icon: PanelTop, group: "SITE" },
  { id: "navigation", label: "Navigation", icon: Menu, group: "SITE" },
  { id: "footer", label: "Footer", icon: PanelBottom, group: "SITE" },
  { id: "announcement", label: "Announcement", icon: Megaphone, group: "ENGAGEMENT" },
  { id: "social", label: "Social Media", icon: Share2, group: "ENGAGEMENT" },
  { id: "contact", label: "Contact & Business", icon: Phone, group: "ENGAGEMENT" },
  { id: "seo", label: "SEO", icon: Search, group: "GROWTH" },
  { id: "tracking", label: "Scripts & Tracking", icon: Code, group: "GROWTH" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function MarketingCMS() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [config, setConfig] = useState<CmsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<ApiResponse>("/api/admin/marketing");
        if (!cancelled) setConfig(data.config);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (newConfig: CmsConfig) =>
      apiFetch<{ config: CmsConfig }>("/api/admin/marketing", { method: "PUT", json: newConfig }),
    onSuccess: (data) => {
      setConfig(data.config);
      toast({ title: "Saved", description: "Marketing site updated. Changes are live.", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/marketing/cms"] });
    },
    onError: (err) => toast({ title: "Save failed", description: (err as Error).message, variant: "error" }),
  });

  const resetMutation = useMutation({
    mutationFn: async () =>
      apiFetch<{ config: CmsConfig }>("/api/admin/marketing", { method: "DELETE" }),
    onSuccess: (data) => {
      setConfig(data.config);
      toast({ title: "Reset to defaults", variant: "success" });
    },
  });

  const update = useCallback(<K extends keyof CmsConfig>(key: K, value: CmsConfig[K]) => {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  }, []);

  const handleSave = () => {
    if (!config) return;
    setSaving(true);
    saveMutation.mutate(config, {
      onSettled: () => setSaving(false),
    });
  };

  if (loading || !config) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filteredSections = search
    ? SECTIONS.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()))
    : SECTIONS;

  const groups = Array.from(new Set(filteredSections.map((s) => s.group)));

  return (
    <div className="space-y-0">
      <PageHeader
        title="Marketing Site"
        description="Manage the public marketing website dynamically — header, navigation, footer, social, contact, SEO, and more."
        actions={
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4" /> Preview
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Reset ALL marketing CMS settings to defaults? This cannot be undone.")) {
                  resetMutation.mutate();
                }
              }}
              disabled={resetMutation.isPending}
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending || saving}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Publish
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3">
            <Input
              placeholder="Search sections…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {groups.map((group) => (
              <div key={group} className="flex gap-1 lg:flex-col">
                <p className="hidden px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:block">
                  {group}
                </p>
                {filteredSections.filter((s) => s.group === group).map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        activeSection === section.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {section.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="min-w-0 space-y-6">
          {activeSection === "overview" && <OverviewSection config={config} onNavigate={setActiveSection} />}
          {activeSection === "homepage" && <HomepageSection />}
          {activeSection === "identity" && <IdentitySection />}
          {activeSection === "header" && (
            <HeaderSection
              header={config.header}
              onChange={(header) => update("header", header)}
            />
          )}
          {activeSection === "navigation" && (
            <NavigationSection
              navigation={config.navigation}
              onChange={(navigation) => update("navigation", navigation)}
            />
          )}
          {activeSection === "footer" && (
            <FooterSection
              footer={config.footer}
              onChange={(footer) => update("footer", footer)}
            />
          )}
          {activeSection === "announcement" && (
            <AnnouncementSection
              announcement={config.announcement}
              onChange={(announcement) => update("announcement", announcement)}
            />
          )}
          {activeSection === "social" && (
            <SocialSection
              social={config.social}
              onChange={(social) => update("social", social)}
            />
          )}
          {activeSection === "contact" && (
            <ContactSection
              contact={config.contact}
              onChange={(contact) => update("contact", contact)}
            />
          )}
          {activeSection === "seo" && (
            <SeoSection
              seo={config.seo}
              onChange={(seo) => update("seo", seo)}
            />
          )}
          {activeSection === "tracking" && <TrackingSection />}

          {/* Sticky save bar */}
          <div className="sticky bottom-0 flex items-center justify-between rounded-lg border border-border bg-card/95 p-3 backdrop-blur">
            <div className="text-xs text-muted-foreground">
              {config.lastUpdated ? (
                <span>Last updated {new Date(config.lastUpdated).toLocaleString("en-GB")}</span>
              ) : (
                <span>Not saved yet</span>
              )}
              {config.publishedVersion > 0 && (
                <span className="ml-2">· v{config.publishedVersion}</span>
              )}
            </div>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending || saving}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save & Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Overview ────────────────────────────────────────────

function OverviewSection({ config, onNavigate }: { config: CmsConfig; onNavigate: (s: SectionId) => void }) {
  const lastUpdated = config.lastUpdated ? new Date(config.lastUpdated).toLocaleString("en-GB") : "—";
  return (
    <div className="space-y-4">
      <SectionCard title="Marketing Site Overview" description="Real-time status of all CMS sections.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard label="Published Version" value={`v${config.publishedVersion}`} />
          <StatCard label="Last Updated" value={lastUpdated} />
          <StatCard label="Status" value="Published" tone="success" />
          <StatCard label="Header" value={config.header.ctaText || "No CTA"} />
          <StatCard label="Nav Items" value={String(config.navigation.length)} />
          <StatCard label="Footer Columns" value={String(config.footer.columns.length)} />
          <StatCard label="Social Links" value={String(config.social.filter((s) => s.enabled).length)} />
          <StatCard label="Announcement" value={config.announcement.enabled ? "Active" : "Off"} tone={config.announcement.enabled ? "warning" : "default"} />
          <StatCard label="Contact Email" value={config.contact.email || "—"} />
        </div>
      </SectionCard>
      <SectionCard title="Quick Actions" description="Jump to any section.">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {SECTIONS.filter((s) => s.id !== "overview").map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => onNavigate(s.id)}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background/50 p-3 text-center transition-colors hover:bg-muted"
              >
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs font-medium">{s.label}</span>
              </button>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Section: Homepage ────────────────────────────────────────────

function HomepageSection() {
  return (
    <SectionCard title="Homepage Content" description="Manage the homepage hero, services, CTA, and FAQ content.">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The homepage content (hero, services, why-euroscope, how-we-help, problems, trust, CTA, FAQ) is managed by the existing Marketing Content Editor. Click below to open it.
        </p>
        <a href="/admin/marketing/content">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4" /> Open Content Editor
          </Button>
        </a>
      </div>
    </SectionCard>
  );
}

// ─── Section: Identity ────────────────────────────────────────────

function IdentitySection() {
  return (
    <SectionCard title="Site Identity" description="Logo, brand name, tagline, and brand colors. Managed by the existing Branding & Logo settings.">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Brand identity (logo, brand name, tagline, primary color, contact email/phone) is managed by the existing Branding admin. Changes appear immediately across the entire site.
        </p>
        <a href="/admin/branding">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4" /> Open Branding & Logo
          </Button>
        </a>
      </div>
    </SectionCard>
  );
}

// ─── Section: Header ──────────────────────────────────────────────

function HeaderSection({ header, onChange }: { header: CmsConfig["header"]; onChange: (h: CmsConfig["header"]) => void }) {
  const set = <K extends keyof CmsConfig["header"]>(k: K, v: CmsConfig["header"][K]) => onChange({ ...header, [k]: v });
  return (
    <SectionCard title="Header Configuration" description="Control the public website header — CTA, sticky behavior, visibility.">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>CTA Text</Label>
          <Input value={header.ctaText} onChange={(e) => set("ctaText", e.target.value)} placeholder="Book a Consultation" />
        </div>
        <div className="space-y-1">
          <Label>CTA URL</Label>
          <Input value={header.ctaHref} onChange={(e) => set("ctaHref", e.target.value)} placeholder="/contact" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={header.sticky} onChange={(e) => set("sticky", e.target.checked)} className="h-4 w-4" />
          Sticky header (stays on top when scrolling)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={header.transparent} onChange={(e) => set("transparent", e.target.checked)} className="h-4 w-4" />
          Transparent header (no background)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={header.ctaVisibleDesktop} onChange={(e) => set("ctaVisibleDesktop", e.target.checked)} className="h-4 w-4" />
          Show CTA on desktop
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={header.ctaVisibleMobile} onChange={(e) => set("ctaVisibleMobile", e.target.checked)} className="h-4 w-4" />
          Show CTA on mobile
        </label>
      </div>
    </SectionCard>
  );
}

// ─── Section: Navigation ──────────────────────────────────────────

function NavigationSection({ navigation, onChange }: { navigation: NavItem[]; onChange: (n: NavItem[]) => void }) {
  const update = (id: string, patch: Partial<NavItem>) =>
    onChange(navigation.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const remove = (id: string) => onChange(navigation.filter((item) => item.id !== id));
  const add = () =>
    onChange([
      ...navigation,
      { id: Math.random().toString(36).slice(2, 10), label: "New Item", href: "/", enabled: true },
    ]);
  const move = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= navigation.length) return;
    const copy = [...navigation];
    [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
    onChange(copy);
  };

  const updateChild = (parentId: string, childId: string, patch: Partial<NavItem>) =>
    onChange(
      navigation.map((item) =>
        item.id === parentId
          ? { ...item, children: item.children?.map((c) => (c.id === childId ? { ...c, ...patch } : c)) }
          : item,
      ),
    );
  const addChild = (parentId: string) =>
    onChange(
      navigation.map((item) =>
        item.id === parentId
          ? {
              ...item,
              children: [
                ...(item.children ?? []),
                { id: Math.random().toString(36).slice(2, 10), label: "New Submenu", href: "/", enabled: true },
              ],
            }
          : item,
      ),
    );
  const removeChild = (parentId: string, childId: string) =>
    onChange(
      navigation.map((item) =>
        item.id === parentId
          ? { ...item, children: item.children?.filter((c) => c.id !== childId) }
          : item,
      ),
    );

  return (
    <SectionCard
      title="Navigation Builder"
      description="Manage header menu items. Supports submenus. Reorder with the arrows."
      actions={
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      }
    >
      <div className="space-y-2">
        {navigation.map((item, index) => (
          <NavItemEditor
            key={item.id}
            item={item}
            index={index}
            total={navigation.length}
            onUpdate={(patch) => update(item.id, patch)}
            onRemove={() => remove(item.id)}
            onMove={(dir) => move(index, dir)}
            onUpdateChild={(childId, patch) => updateChild(item.id, childId, patch)}
            onAddChild={() => addChild(item.id)}
            onRemoveChild={(childId) => removeChild(item.id, childId)}
          />
        ))}
        {navigation.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No navigation items. Click &quot;Add Item&quot; to create one.</p>
        )}
      </div>
    </SectionCard>
  );
}

function NavItemEditor({
  item,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
  onUpdateChild,
  onAddChild,
  onRemoveChild,
}: {
  item: NavItem;
  index: number;
  total: number;
  onUpdate: (patch: Partial<NavItem>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onUpdateChild: (childId: string, patch: Partial<NavItem>) => void;
  onAddChild: () => void;
  onRemoveChild: (childId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = (item.children?.length ?? 0) > 0;

  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronDown className="h-3 w-3 rotate-180" />
          </button>
          <GripVertical className="h-3 w-3 text-muted-foreground/50" />
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
        <Input value={item.label} onChange={(e) => onUpdate({ label: e.target.value })} className="h-8 flex-1 text-sm" />
        <Input value={item.href} onChange={(e) => onUpdate({ href: e.target.value })} className="h-8 flex-1 text-sm font-mono" placeholder="/path" />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={item.enabled} onChange={(e) => onUpdate({ enabled: e.target.checked })} className="h-4 w-4" />
          <span className="hidden sm:inline">Enabled</span>
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={item.openInNewTab ?? false} onChange={(e) => onUpdate({ openInNewTab: e.target.checked })} className="h-4 w-4" />
          <span className="hidden sm:inline">New tab</span>
        </label>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {hasChildren ? `${item.children!.length} submenu` : "submenu"}
        </button>
        <button onClick={onRemove} className="text-destructive hover:bg-destructive/10 rounded p-1">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="ml-8 mt-3 space-y-2 border-l-2 border-border pl-3">
          {item.children?.map((child) => (
            <div key={child.id} className="flex items-center gap-2">
              <Input value={child.label} onChange={(e) => onUpdateChild(child.id, { label: e.target.value })} className="h-7 flex-1 text-xs" />
              <Input value={child.href} onChange={(e) => onUpdateChild(child.id, { href: e.target.value })} className="h-7 flex-1 text-xs font-mono" />
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={child.enabled} onChange={(e) => onUpdateChild(child.id, { enabled: e.target.checked })} className="h-3 w-3" />
              </label>
              <button onClick={() => onRemoveChild(child.id)} className="text-destructive hover:bg-destructive/10 rounded p-1">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={onAddChild} className="h-7 text-xs">
            <Plus className="h-3 w-3" /> Add submenu item
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Section: Footer ───────────────────────────────────────────────

function FooterSection({
  footer,
  onChange,
}: {
  footer: CmsConfig["footer"];
  onChange: (f: CmsConfig["footer"]) => void;
}) {
  const set = <K extends keyof CmsConfig["footer"]>(k: K, v: CmsConfig["footer"][K]) => onChange({ ...footer, [k]: v });
  const updateColumn = (id: string, patch: Partial<FooterColumn>) =>
    onChange({ ...footer, columns: footer.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const addColumn = () =>
    onChange({
      ...footer,
      columns: [
        ...footer.columns,
        { id: Math.random().toString(36).slice(2, 10), heading: "New Column", enabled: true, links: [] },
      ],
    });
  const removeColumn = (id: string) =>
    onChange({ ...footer, columns: footer.columns.filter((c) => c.id !== id) });

  const addLink = (colId: string) =>
    onChange({
      ...footer,
      columns: footer.columns.map((c) =>
        c.id === colId
          ? { ...c, links: [...c.links, { id: Math.random().toString(36).slice(2, 10), label: "New Link", href: "/" }] }
          : c,
      ),
    });
  const updateLink = (colId: string, linkId: string, patch: Partial<FooterColumn["links"][number]>) =>
    onChange({
      ...footer,
      columns: footer.columns.map((c) =>
        c.id === colId
          ? { ...c, links: c.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)) }
          : c,
      ),
    });
  const removeLink = (colId: string, linkId: string) =>
    onChange({
      ...footer,
      columns: footer.columns.map((c) =>
        c.id === colId ? { ...c, links: c.links.filter((l) => l.id !== linkId) } : c,
      ),
    });

  return (
    <SectionCard
      title="Footer Builder"
      description="Manage footer description, columns, links, and copyright."
      actions={
        <Button size="sm" variant="outline" onClick={addColumn}>
          <Plus className="h-4 w-4" /> Add Column
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Footer Description</Label>
          <Textarea value={footer.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={1000} />
        </div>
        <div className="space-y-1">
          <Label>Copyright Text</Label>
          <Input value={footer.copyrightText} onChange={(e) => set("copyrightText", e.target.value)} />
          <p className="text-xs text-muted-foreground">Use <code>{"{year}"}</code> for the current year.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={footer.showSocialLinks} onChange={(e) => set("showSocialLinks", e.target.checked)} className="h-4 w-4" />
          Show social links in footer
        </label>
        <div className="space-y-2">
          <p className="text-sm font-medium">Columns</p>
          {footer.columns.map((col) => (
            <div key={col.id} className="rounded-lg border border-border bg-background/50 p-3">
              <div className="flex items-center gap-2">
                <Input value={col.heading} onChange={(e) => updateColumn(col.id, { heading: e.target.value })} className="h-8 flex-1 text-sm font-semibold" />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={col.enabled} onChange={(e) => updateColumn(col.id, { enabled: e.target.checked })} className="h-4 w-4" />
                  <span className="hidden sm:inline">Enabled</span>
                </label>
                <button onClick={() => removeColumn(col.id)} className="text-destructive hover:bg-destructive/10 rounded p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {col.links.map((link) => (
                  <div key={link.id} className="flex items-center gap-2 pl-2">
                    <Input value={link.label} onChange={(e) => updateLink(col.id, link.id, { label: e.target.value })} className="h-7 flex-1 text-xs" />
                    <Input value={link.href} onChange={(e) => updateLink(col.id, link.id, { href: e.target.value })} className="h-7 flex-1 text-xs font-mono" />
                    <button onClick={() => removeLink(col.id, link.id)} className="text-destructive hover:bg-destructive/10 rounded p-1">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => addLink(col.id)} className="h-7 text-xs">
                  <Plus className="h-3 w-3" /> Add link
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Section: Announcement ────────────────────────────────────────

function AnnouncementSection({
  announcement,
  onChange,
}: {
  announcement: CmsConfig["announcement"];
  onChange: (a: CmsConfig["announcement"]) => void;
}) {
  const set = <K extends keyof CmsConfig["announcement"]>(k: K, v: CmsConfig["announcement"][K]) => onChange({ ...announcement, [k]: v });
  return (
    <SectionCard title="Announcement Bar" description="Dismissible banner shown above the header. Supports scheduling.">
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={announcement.enabled} onChange={(e) => set("enabled", e.target.checked)} className="h-4 w-4" />
          Enable announcement bar
        </label>
        <div className="space-y-1">
          <Label>Message</Label>
          <Textarea value={announcement.message} onChange={(e) => set("message", e.target.value)} rows={2} maxLength={500} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Link Text</Label>
            <Input value={announcement.linkText} onChange={(e) => set("linkText", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Link URL</Label>
            <Input value={announcement.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Start At (optional)</Label>
            <Input type="datetime-local" value={announcement.startAt?.slice(0, 16) ?? ""} onChange={(e) => set("startAt", e.target.value ? new Date(e.target.value).toISOString() : null)} />
          </div>
          <div className="space-y-1">
            <Label>End At (optional)</Label>
            <Input type="datetime-local" value={announcement.endAt?.slice(0, 16) ?? ""} onChange={(e) => set("endAt", e.target.value ? new Date(e.target.value).toISOString() : null)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={announcement.dismissible} onChange={(e) => set("dismissible", e.target.checked)} className="h-4 w-4" />
          Allow users to dismiss
        </label>
      </div>
    </SectionCard>
  );
}

// ─── Section: Social ──────────────────────────────────────────────

const PLATFORMS = ["facebook", "instagram", "linkedin", "youtube", "tiktok", "x", "whatsapp", "telegram", "pinterest", "other"];

function SocialSection({ social, onChange }: { social: SocialLink[]; onChange: (s: SocialLink[]) => void }) {
  const add = () =>
    onChange([
      ...social,
      { id: Math.random().toString(36).slice(2, 10), platform: "facebook", label: "Facebook", url: "", enabled: true, openInNewTab: true, order: social.length + 1 },
    ]);
  const update = (id: string, patch: Partial<SocialLink>) => onChange(social.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => onChange(social.filter((s) => s.id !== id));

  return (
    <SectionCard
      title="Social Media Manager"
      description="Manage social media profiles shown in the footer and maintenance page."
      actions={
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" /> Add Profile
        </Button>
      }
    >
      <div className="space-y-2">
        {social.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/50 p-3">
            <select
              value={s.platform}
              onChange={(e) => update(s.id, { platform: e.target.value, label: e.target.options[e.target.selectedIndex].text })}
              className="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
            <Input value={s.label} onChange={(e) => update(s.id, { label: e.target.value })} className="h-8 w-32 text-sm" placeholder="Label" />
            <Input value={s.url} onChange={(e) => update(s.id, { url: e.target.value })} className="h-8 flex-1 text-sm font-mono" placeholder="https://…" />
            <Input type="number" value={s.order} onChange={(e) => update(s.id, { order: Number(e.target.value) })} className="h-8 w-16 text-sm" />
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={s.enabled} onChange={(e) => update(s.id, { enabled: e.target.checked })} className="h-4 w-4" />
              <span className="hidden sm:inline">Enabled</span>
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={s.openInNewTab} onChange={(e) => update(s.id, { openInNewTab: e.target.checked })} className="h-4 w-4" />
              <span className="hidden sm:inline">New tab</span>
            </label>
            <button onClick={() => remove(s.id)} className="text-destructive hover:bg-destructive/10 rounded p-1">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {social.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No social profiles. Click &quot;Add Profile&quot;.</p>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Section: Contact ─────────────────────────────────────────────

function ContactSection({ contact, onChange }: { contact: CmsConfig["contact"]; onChange: (c: CmsConfig["contact"]) => void }) {
  const set = <K extends keyof CmsConfig["contact"]>(k: K, v: CmsConfig["contact"][K]) => onChange({ ...contact, [k]: v });
  return (
    <SectionCard title="Contact & Business Information" description="Single source of truth for company contact info. Used in footer, contact page, and structured data.">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Company Name" value={contact.companyName} onChange={(v) => set("companyName", v)} />
        <Field label="General Email" value={contact.email} onChange={(v) => set("email", v)} />
        <Field label="Support Email" value={contact.supportEmail} onChange={(v) => set("supportEmail", v)} />
        <Field label="Phone" value={contact.phone} onChange={(v) => set("phone", v)} />
        <Field label="WhatsApp" value={contact.whatsapp} onChange={(v) => set("whatsapp", v)} />
        <Field label="Address" value={contact.address} onChange={(v) => set("address", v)} />
        <Field label="Office Hours" value={contact.officeHours} onChange={(v) => set("officeHours", v)} />
        <Field label="Support Hours" value={contact.supportHours} onChange={(v) => set("supportHours", v)} />
        <Field label="Google Maps URL" value={contact.googleMapsUrl} onChange={(v) => set("googleMapsUrl", v)} />
      </div>
    </SectionCard>
  );
}

// ─── Section: SEO ─────────────────────────────────────────────────

function SeoSection({ seo, onChange }: { seo: CmsConfig["seo"]; onChange: (s: CmsConfig["seo"]) => void }) {
  const set = <K extends keyof CmsConfig["seo"]>(k: K, v: CmsConfig["seo"][K]) => onChange({ ...seo, [k]: v });
  return (
    <SectionCard title="Global SEO Settings" description="Default metadata for all public marketing pages. Per-page SEO can be managed in System Operations → SEO.">
      <div className="space-y-3">
        <Field label="Global SEO Title" value={seo.globalTitle} onChange={(v) => set("globalTitle", v)} />
        <div className="space-y-1">
          <Label>Global Meta Description</Label>
          <Textarea value={seo.globalDescription} onChange={(e) => set("globalDescription", e.target.value)} rows={3} maxLength={500} />
          <p className="text-xs text-muted-foreground">{seo.globalDescription.length}/500</p>
        </div>
        <Field label="Default OG Image" value={seo.defaultOgImage} onChange={(v) => set("defaultOgImage", v)} />
        <Field label="Default Twitter/X Image" value={seo.defaultTwitterImage} onChange={(v) => set("defaultTwitterImage", v)} />
        <Field label="Locale" value={seo.locale} onChange={(v) => set("locale", v)} />
        <div className="rounded-md border border-info/30 bg-info/5 p-3">
          <p className="text-xs font-medium text-info">Google Search Preview</p>
          <div className="mt-2 rounded bg-white p-2 text-xs">
            <p className="text-emerald-700">{seo.globalTitle}</p>
            <p className="text-slate-600 line-clamp-2">{seo.globalDescription}</p>
            <p className="text-slate-400">euroscope.app</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Section: Tracking ────────────────────────────────────────────

function TrackingSection() {
  return (
    <SectionCard title="Scripts & Tracking" description="GA4, GTM, Meta Pixel configuration. Managed by System Operations → Analytics.">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Analytics and marketing pixels (Google Analytics 4, Google Tag Manager, Meta Pixel) are managed by the System Operations module. This ensures consent-gated loading + sensitive data filtering.
        </p>
        <a href="/admin/system/analytics">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4" /> Open Analytics Settings
          </Button>
        </a>
      </div>
    </SectionCard>
  );
}

// ─── Shared sub-components ────────────────────────────────────────

function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" }) {
  const tones = {
    default: "border-border",
    success: "border-success/30 bg-success/5",
    warning: "border-warning/30 bg-warning/5",
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

void Check;
