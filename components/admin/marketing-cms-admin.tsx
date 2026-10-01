"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-kit";
import { Button, Input, Label, Textarea, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  Globe, PanelTop, PanelBottom, Share2, Megaphone,
  Search, Save, Loader2, Plus, Trash2,
  ExternalLink, Phone, Mail, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  id: string; label: string; href: string; hasDropdown?: boolean;
  children?: NavItem[]; enabled: boolean; order: number; openInNewTab?: boolean;
};
type FooterColumn = { id: string; heading: string; order: number; links: { id: string; label: string; href: string }[] };
type SocialLink = { id: string; platform: string; label: string; url: string; enabled: boolean; order: number };
type AnnouncementBar = { enabled: boolean; message: string; link?: string; linkLabel?: string; bgColor: string; textColor: string; dismissible: boolean; startDate?: string; endDate?: string };
type SEOConfig = { defaultTitle: string; defaultDescription: string; ogImage?: string; twitterCard: string; robots: string; canonical?: string };
type ContactConfig = { email: string; phone: string; whatsapp?: string; address: string; mapsUrl?: string; hours: string };

type CMSConfig = {
  navigation: NavItem[];
  footer: { columns: FooterColumn[]; copyright: string; description: string };
  social: SocialLink[];
  announcement: AnnouncementBar;
  seo: SEOConfig;
  contact: ContactConfig;
};

type Tab = "overview" | "navigation" | "footer" | "social" | "announcement" | "seo" | "contact";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <Globe className="h-4 w-4" /> },
  { key: "navigation", label: "Navigation", icon: <PanelTop className="h-4 w-4" /> },
  { key: "footer", label: "Footer", icon: <PanelBottom className="h-4 w-4" /> },
  { key: "social", label: "Social Media", icon: <Share2 className="h-4 w-4" /> },
  { key: "announcement", label: "Announcement", icon: <Megaphone className="h-4 w-4" /> },
  { key: "seo", label: "SEO", icon: <Search className="h-4 w-4" /> },
  { key: "contact", label: "Contact", icon: <Phone className="h-4 w-4" /> },
];

export function MarketingCMSAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [config, setConfig] = useState<CMSConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery<CMSConfig>({
    queryKey: ["/api/admin/marketing-cms"],
    queryFn: () => apiFetch<CMSConfig>("/api/admin/marketing-cms"),
  });

  // Sync fetched data to local state
  if (data && !config) setConfig(data);

  function updateConfig(patch: Partial<CMSConfig>) {
    if (!config) return;
    setConfig({ ...config, ...patch });
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      await apiFetch("/api/admin/marketing-cms", { method: "PUT", json: config });
      toast({ title: "Marketing settings saved", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/marketing-cms"] });
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !config) {
    return (
      <div className="space-y-4">
        <PageHeader title="Marketing Site" description="Manage your public website content, navigation, footer, and SEO." />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing Site"
        description="Manage your public website content, navigation, footer, and SEO."
        actions={
          <div className="flex gap-2">
            <a href="/" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3.5 w-3.5" /> Preview
              </Button>
            </a>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Changes
            </Button>
          </div>
        }
      />

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === "overview" && <OverviewTab config={config} onTab={setActiveTab} />}
        {activeTab === "navigation" && <NavigationTab config={config} onUpdate={updateConfig} />}
        {activeTab === "footer" && <FooterTab config={config} onUpdate={updateConfig} />}
        {activeTab === "social" && <SocialTab config={config} onUpdate={updateConfig} />}
        {activeTab === "announcement" && <AnnouncementTab config={config} onUpdate={updateConfig} />}
        {activeTab === "seo" && <SEOTab config={config} onUpdate={updateConfig} />}
        {activeTab === "contact" && <ContactTab config={config} onUpdate={updateConfig} />}
      </div>
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────

function OverviewTab({ config, onTab }: { config: CMSConfig; onTab: (t: Tab) => void }) {
  const enabledNav = config.navigation.filter(n => n.enabled).length;
  const enabledSocial = config.social.filter(s => s.enabled).length;
  const footerCols = config.footer.columns.length;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <OverviewCard title="Navigation" status={`${enabledNav} items`} icon={<PanelTop className="h-5 w-5" />} onClick={() => onTab("navigation")} />
      <OverviewCard title="Footer" status={`${footerCols} columns`} icon={<PanelBottom className="h-5 w-5" />} onClick={() => onTab("footer")} />
      <OverviewCard title="Social Media" status={`${enabledSocial} active`} icon={<Share2 className="h-5 w-5" />} onClick={() => onTab("social")} />
      <OverviewCard title="Announcement Bar" status={config.announcement.enabled ? "Active" : "Disabled"} icon={<Megaphone className="h-5 w-5" />} onClick={() => onTab("announcement")} />
      <OverviewCard title="SEO" status="Configured" icon={<Search className="h-5 w-5" />} onClick={() => onTab("seo")} />
      <OverviewCard title="Contact Info" status="Configured" icon={<Phone className="h-5 w-5" />} onClick={() => onTab("contact")} />
    </div>
  );
}

function OverviewCard({ title, status, icon, onClick }: { title: string; status: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <Badge tone="info">{status}</Badge>
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">Manage →</p>
    </button>
  );
}

// ── Navigation Tab ─────────────────────────────────────────────────

function NavigationTab({ config, onUpdate }: { config: CMSConfig; onUpdate: (p: Partial<CMSConfig>) => void }) {
  function updateNav(idx: number, patch: Partial<NavItem>) {
    const nav = [...config.navigation];
    nav[idx] = { ...nav[idx], ...patch };
    onUpdate({ navigation: nav });
  }
  function deleteNav(idx: number) {
    onUpdate({ navigation: config.navigation.filter((_, i) => i !== idx) });
  }
  function addNav() {
    onUpdate({
      navigation: [...config.navigation, {
        id: `nav-${Date.now()}`, label: "New Link", href: "/", enabled: true, order: config.navigation.length,
      }],
    });
  }
  function moveNav(idx: number, dir: -1 | 1) {
    const nav = [...config.navigation];
    const target = idx + dir;
    if (target < 0 || target >= nav.length) return;
    [nav[idx], nav[target]] = [nav[target], nav[idx]];
    onUpdate({ navigation: nav });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Header Navigation</h2>
        <Button size="sm" variant="outline" onClick={addNav}><Plus className="h-3.5 w-3.5" /> Add Link</Button>
      </div>
      <div className="space-y-2">
        {config.navigation.map((item, idx) => (
          <div key={item.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => moveNav(idx, -1)} className="text-muted-foreground hover:text-foreground" disabled={idx === 0}>▲</button>
                <button onClick={() => moveNav(idx, 1)} className="text-muted-foreground hover:text-foreground" disabled={idx === config.navigation.length - 1}>▼</button>
              </div>
              <Input
                value={item.label}
                onChange={(e) => updateNav(idx, { label: e.target.value })}
                className="h-8 w-40"
                placeholder="Label"
              />
              <Input
                value={item.href}
                onChange={(e) => updateNav(idx, { href: e.target.value })}
                className="h-8 flex-1"
                placeholder="/path or https://..."
              />
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => updateNav(idx, { enabled: e.target.checked })}
                  className="h-4 w-4"
                />
                Enabled
              </label>
              <Button size="sm" variant="ghost" onClick={() => deleteNav(idx)} className="text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {item.children && item.children.length > 0 && (
              <div className="ml-8 mt-2 space-y-1 border-l-2 border-border pl-3">
                {item.children.map((child) => (
                  <div key={child.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>└─</span>
                    <span className="font-medium">{child.label}</span>
                    <span>→</span>
                    <code className="text-primary">{child.href}</code>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Footer Tab ─────────────────────────────────────────────────────

function FooterTab({ config, onUpdate }: { config: CMSConfig; onUpdate: (p: Partial<CMSConfig>) => void }) {
  const { footer } = config;

  function updateFooter(patch: Partial<CMSConfig["footer"]>) {
    onUpdate({ footer: { ...footer, ...patch } });
  }
  function updateColumn(idx: number, heading: string) {
    const columns = [...footer.columns];
    columns[idx] = { ...columns[idx], heading };
    updateFooter({ columns });
  }
  function deleteColumn(idx: number) {
    updateFooter({ columns: footer.columns.filter((_, i) => i !== idx) });
  }
  function addColumn() {
    updateFooter({
      columns: [...footer.columns, { id: `fc-${Date.now()}`, heading: "New Column", order: footer.columns.length, links: [] }],
    });
  }
  function addLink(colIdx: number) {
    const columns = [...footer.columns];
    columns[colIdx].links.push({ id: `fl-${Date.now()}`, label: "New Link", href: "/" });
    updateFooter({ columns });
  }
  function updateLink(colIdx: number, linkIdx: number, patch: { label?: string; href?: string }) {
    const columns = [...footer.columns];
    columns[colIdx].links[linkIdx] = { ...columns[colIdx].links[linkIdx], ...patch };
    updateFooter({ columns });
  }
  function deleteLink(colIdx: number, linkIdx: number) {
    const columns = [...footer.columns];
    columns[colIdx].links.splice(linkIdx, 1);
    updateFooter({ columns });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <Label>Footer Description</Label>
          <Textarea value={footer.description} onChange={(e) => updateFooter({ description: e.target.value })} rows={2} className="mt-1" />
        </div>
        <div>
          <Label>Copyright Text</Label>
          <Input value={footer.copyright} onChange={(e) => updateFooter({ copyright: e.target.value })} className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">Use {"{year}"} for dynamic year.</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Footer Columns</h3>
        <Button size="sm" variant="outline" onClick={addColumn}><Plus className="h-3.5 w-3.5" /> Add Column</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {footer.columns.map((col, colIdx) => (
          <div key={col.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Input value={col.heading} onChange={(e) => updateColumn(colIdx, e.target.value)} className="h-8 flex-1 font-semibold" />
              <Button size="sm" variant="ghost" onClick={() => deleteColumn(colIdx)} className="text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-2 space-y-1">
              {col.links.map((link, linkIdx) => (
                <div key={link.id} className="flex items-center gap-1.5">
                  <Input value={link.label} onChange={(e) => updateLink(colIdx, linkIdx, { label: e.target.value })} className="h-7 text-xs" placeholder="Label" />
                  <Input value={link.href} onChange={(e) => updateLink(colIdx, linkIdx, { href: e.target.value })} className="h-7 text-xs" placeholder="/path" />
                  <button onClick={() => deleteLink(colIdx, linkIdx)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
              <button onClick={() => addLink(colIdx)} className="text-xs text-primary hover:underline">+ Add Link</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Social Tab ─────────────────────────────────────────────────────

function SocialTab({ config, onUpdate }: { config: CMSConfig; onUpdate: (p: Partial<CMSConfig>) => void }) {
  function updateSocial(idx: number, patch: Partial<SocialLink>) {
    const social = [...config.social];
    social[idx] = { ...social[idx], ...patch };
    onUpdate({ social });
  }
  function deleteSocial(idx: number) {
    onUpdate({ social: config.social.filter((_, i) => i !== idx) });
  }
  function addSocial() {
    onUpdate({
      social: [...config.social, {
        id: `soc-${Date.now()}`, platform: "Other", label: "New Profile", url: "https://", enabled: true, order: config.social.length,
      }],
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Social Media Links</h2>
        <Button size="sm" variant="outline" onClick={addSocial}><Plus className="h-3.5 w-3.5" /> Add Profile</Button>
      </div>
      <div className="space-y-2">
        {config.social.map((link, idx) => (
          <div key={link.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
            <select
              value={link.platform}
              onChange={(e) => updateSocial(idx, { platform: e.target.value, label: e.target.value })}
              className="h-8 rounded-md border border-border bg-card px-2 text-sm"
            >
              {["Facebook","Instagram","LinkedIn","YouTube","TikTok","X","WhatsApp","Telegram","Pinterest","Other"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <Input value={link.url} onChange={(e) => updateSocial(idx, { url: e.target.value })} className="h-8 flex-1" placeholder="https://..." />
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={link.enabled} onChange={(e) => updateSocial(idx, { enabled: e.target.checked })} className="h-4 w-4" />
              Enabled
            </label>
            <Button size="sm" variant="ghost" onClick={() => deleteSocial(idx)} className="text-red-600 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Announcement Tab ───────────────────────────────────────────────

function AnnouncementTab({ config, onUpdate }: { config: CMSConfig; onUpdate: (p: Partial<CMSConfig>) => void }) {
  const a = config.announcement;
  function update(patch: Partial<AnnouncementBar>) {
    onUpdate({ announcement: { ...a, ...patch } });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Announcement Bar</h2>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={a.enabled} onChange={(e) => update({ enabled: e.target.checked })} className="h-4 w-4" />
        Enable announcement bar
      </label>
      {a.enabled && (
        <div className="space-y-3">
          <div>
            <Label>Message</Label>
            <Textarea value={a.message} onChange={(e) => update({ message: e.target.value })} rows={2} className="mt-1" placeholder="Applications for September intake are now open!" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Link URL (optional)</Label>
              <Input value={a.link ?? ""} onChange={(e) => update({ link: e.target.value })} className="mt-1" placeholder="/contact" />
            </div>
            <div>
              <Label>Link Label (optional)</Label>
              <Input value={a.linkLabel ?? ""} onChange={(e) => update({ linkLabel: e.target.value })} className="mt-1" placeholder="Apply Now" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Background Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={a.bgColor} onChange={(e) => update({ bgColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded-md border border-border" />
                <Input value={a.bgColor} onChange={(e) => update({ bgColor: e.target.value })} className="font-mono text-sm" />
              </div>
            </div>
            <div>
              <Label>Text Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={a.textColor} onChange={(e) => update({ textColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded-md border border-border" />
                <Input value={a.textColor} onChange={(e) => update({ textColor: e.target.value })} className="font-mono text-sm" />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={a.dismissible} onChange={(e) => update({ dismissible: e.target.checked })} className="h-4 w-4" />
            Allow users to dismiss
          </label>
          {/* Live Preview */}
          <div className="rounded-lg overflow-hidden border border-border">
            <div className="p-3 text-center text-sm font-medium" style={{ backgroundColor: a.bgColor, color: a.textColor }}>
              {a.message || "Your announcement message will appear here."}
              {a.linkLabel && <span className="ml-2 underline">{a.linkLabel}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SEO Tab ────────────────────────────────────────────────────────

function SEOTab({ config, onUpdate }: { config: CMSConfig; onUpdate: (p: Partial<CMSConfig>) => void }) {
  const seo = config.seo;
  function update(patch: Partial<SEOConfig>) {
    onUpdate({ seo: { ...seo, ...patch } });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">SEO Configuration</h2>
      <div>
        <Label>Default Page Title</Label>
        <Input value={seo.defaultTitle} onChange={(e) => update({ defaultTitle: e.target.value })} className="mt-1" />
        <p className="mt-1 text-xs text-muted-foreground">{seo.defaultTitle.length} characters (recommended: 50-60)</p>
      </div>
      <div>
        <Label>Default Meta Description</Label>
        <Textarea value={seo.defaultDescription} onChange={(e) => update({ defaultDescription: e.target.value })} rows={2} className="mt-1" />
        <p className="mt-1 text-xs text-muted-foreground">{seo.defaultDescription.length} characters (recommended: 150-160)</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Robots</Label>
          <select value={seo.robots} onChange={(e) => update({ robots: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm">
            <option value="index, follow">Index, Follow (default)</option>
            <option value="noindex, nofollow">No Index, No Follow</option>
          </select>
        </div>
        <div>
          <Label>Twitter Card Type</Label>
          <select value={seo.twitterCard} onChange={(e) => update({ twitterCard: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm">
            <option value="summary">Summary</option>
            <option value="summary_large_image">Summary with Large Image</option>
          </select>
        </div>
      </div>
      {/* Google Preview */}
      <div className="rounded-lg border border-border p-3">
        <p className="text-xs font-semibold text-muted-foreground">Google Search Preview</p>
        <div className="mt-2">
          <p className="text-sm text-blue-600">{seo.defaultTitle}</p>
          <p className="text-xs text-green-700">https://euroscope.app</p>
          <p className="text-xs text-muted-foreground">{seo.defaultDescription}</p>
        </div>
      </div>
    </div>
  );
}

// ── Contact Tab ────────────────────────────────────────────────────

function ContactTab({ config, onUpdate }: { config: CMSConfig; onUpdate: (p: Partial<CMSConfig>) => void }) {
  const c = config.contact;
  function update(patch: Partial<ContactConfig>) {
    onUpdate({ contact: { ...c, ...patch } });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Contact & Business Information</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label><Mail className="mr-1 inline h-3.5 w-3.5" />Email</Label>
          <Input value={c.email} onChange={(e) => update({ email: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label><Phone className="mr-1 inline h-3.5 w-3.5" />Phone</Label>
          <Input value={c.phone} onChange={(e) => update({ phone: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input value={c.whatsapp ?? ""} onChange={(e) => update({ whatsapp: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label><MapPin className="mr-1 inline h-3.5 w-3.5" />Address</Label>
          <Input value={c.address} onChange={(e) => update({ address: e.target.value })} className="mt-1" />
        </div>
      </div>
      <div>
        <Label>Office Hours</Label>
        <Input value={c.hours} onChange={(e) => update({ hours: e.target.value })} className="mt-1" />
      </div>
      <div>
        <Label>Google Maps URL</Label>
        <Input value={c.mapsUrl ?? ""} onChange={(e) => update({ mapsUrl: e.target.value })} className="mt-1" placeholder="https://maps.google.com/..." />
      </div>
    </div>
  );
}
