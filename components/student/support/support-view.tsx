"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  CreditCard,
  FileText,
  FolderKanban,
  HelpCircle,
  LifeBuoy,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Stamp,
  WifiOff,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, Badge, Input, Select, Textarea } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInHours, differenceInDays } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────

type FAQItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

type SupportRequest = {
  id: string;
  subject: string;
  category: string;
  description: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  status: string;
  statusLabel: string;
  priority: string;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type FAQResponse = { faq: FAQItem[] };
type ListResponse = { requests: SupportRequest[] };

// ── Constants ──────────────────────────────────────────────────────

const STATUS_TONE: Record<string, "default" | "info" | "warning" | "success"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CLOSED: "default",
};

const CATEGORIES = [
  "Application", "Documents", "University", "Visa",
  "Payments", "Appointments", "Account",
] as const;

const HELP_CARDS = [
  { icon: <FolderKanban className="h-5 w-5" />, label: "Application Help", href: "/student/application", desc: "Track your application progress" },
  { icon: <FileText className="h-5 w-5" />, label: "Document Help", href: "/student/documents", desc: "Upload and manage documents" },
  { icon: <Stamp className="h-5 w-5" />, label: "Visa Help", href: "/student/visa", desc: "Visa status and requirements" },
  { icon: <CreditCard className="h-5 w-5" />, label: "Payment Help", href: "/student/payments", desc: "View invoices and payments" },
  { icon: <MessageSquare className="h-5 w-5" />, label: "Contact Counselor", href: "/student/messages", desc: "Chat with your counselor" },
  { icon: <CalendarClock className="h-5 w-5" />, label: "Appointments", href: "/student/appointments", desc: "Manage your appointments" },
];

// ── Component ──────────────────────────────────────────────────────

export function SupportView() {
  const qc = useQueryClient();
  const online = useOnlineStatus();

  const [activeTab, setActiveTab] = useState<"faq" | "tickets">("faq");
  const [search, setSearch] = useState("");
  const [faqCategory, setFaqCategory] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  // FAQ query
  const faqQ = useQuery<FAQResponse>({
    queryKey: ["student-faq", search, faqCategory],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (faqCategory) params.set("category", faqCategory);
      const qs = params.toString();
      return apiFetch<FAQResponse>(`/api/student/support/faq${qs ? `?${qs}` : ""}`);
    },
    retry: false,
    staleTime: 60_000,
  });

  // Tickets query
  const ticketsQ = useQuery<ListResponse>({
    queryKey: ["student-support-requests"],
    queryFn: () => apiFetch<ListResponse>("/api/student/support"),
    retry: false,
    staleTime: 15_000,
  });

  const faqItems = faqQ.data?.faq ?? [];
  const tickets = ticketsQ.data?.requests ?? [];

  return (
    <MobilePage>
      {/* Help cards grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {HELP_CARDS.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              {card.icon}
            </span>
            <div>
              <p className="text-sm font-semibold">{card.label}</p>
              <p className="text-xs text-muted-foreground">{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setActiveTab("faq")}
          aria-pressed={activeTab === "faq"}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            activeTab === "faq" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <HelpCircle className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          FAQ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("tickets")}
          aria-pressed={activeTab === "tickets"}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            activeTab === "tickets" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LifeBuoy className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          My Tickets
          {tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length > 0 && (
            <span className="ml-1 rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length}
            </span>
          )}
        </button>
      </div>

      {/* FAQ Tab */}
      {activeTab === "faq" && (
        <>
          {/* Search + category filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search FAQ…"
                className="pl-9"
                aria-label="Search FAQ"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1.5 rounded p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-1.5">
                <button
                  type="button"
                  onClick={() => setFaqCategory("")}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                    !faqCategory ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground",
                  )}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFaqCategory(cat)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                      faqCategory === cat ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* FAQ cards */}
          {faqQ.isLoading && <FAQSkeleton />}
          {faqQ.isError && (
            <MobileCard className="py-6 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
              <p className="mt-2 text-sm text-muted-foreground">Couldn&apos;t load FAQ.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => faqQ.refetch()}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
              </Button>
            </MobileCard>
          )}
          {faqItems.length === 0 && !faqQ.isLoading && (
            <MobileCard className="py-6 text-center">
              <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm text-muted-foreground">
                {search || faqCategory ? "No FAQ matches your search." : "No FAQ available."}
              </p>
            </MobileCard>
          )}
          {faqItems.length > 0 && (
            <div className="space-y-2">
              {faqItems.map((item) => (
                <FAQCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tickets Tab */}
      {activeTab === "tickets" && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">My Support Requests</h2>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> New Request
            </Button>
          </div>

          {ticketsQ.isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}

          {tickets.length === 0 && !ticketsQ.isLoading && (
            <MobileCard className="py-8 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <LifeBuoy className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-3 text-base font-semibold">No support requests</h2>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                Need help? Submit a support request and our team will get back to you.
              </p>
              <Button onClick={() => setShowForm(true)} className="mt-4">
                <Plus className="h-4 w-4" aria-hidden /> Submit Request
              </Button>
            </MobileCard>
          )}

          {tickets.length > 0 && (
            <div className="space-y-2">
              {tickets.map((t) => (
                <TicketCard key={t.id} ticket={t} />
              ))}
            </div>
          )}

          {/* New request form (bottom sheet) */}
          {showForm && (
            <SupportRequestForm
              onClose={() => setShowForm(false)}
              onSubmitted={() => {
                setShowForm(false);
                qc.invalidateQueries({ queryKey: ["student-support-requests"] });
              }}
            />
          )}
        </>
      )}

      {/* Refresh + offline */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>
          {activeTab === "faq"
            ? faqQ.isFetching ? "Searching…" : "FAQ loaded"
            : ticketsQ.isFetching ? "Refreshing…" : "Tickets loaded"}
        </span>
        {!online && (
          <span className="flex items-center gap-1 text-warning">
            <WifiOff className="h-3 w-3" aria-hidden /> Offline
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => activeTab === "faq" ? faqQ.refetch() : ticketsQ.refetch()}
          aria-label="Refresh list"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </MobilePage>
  );
}

// ── FAQ card (expandable) ─────────────────────────────────────────

function FAQCard({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileCard className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-3 text-left focus-visible:outline-2 focus-visible:outline-primary"
      >
        <div className="min-w-0 flex-1">
          <Badge tone="info" className="mb-1.5 text-[10px]">{item.category}</Badge>
          <p className="text-sm font-semibold">{item.question}</p>
        </div>
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-border p-3">
          <p className="text-sm text-muted-foreground">{item.answer}</p>
        </div>
      )}
    </MobileCard>
  );
}

// ── Ticket card ───────────────────────────────────────────────────

function TicketCard({ ticket }: { ticket: SupportRequest }) {
  const [expanded, setExpanded] = useState(false);
  const tone = STATUS_TONE[ticket.status] ?? "default";

  return (
    <MobileCard className={cn("overflow-hidden p-0", tone === "success" && "border-success/30")}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 p-3 text-left focus-visible:outline-2 focus-visible:outline-primary"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge tone="info" className="text-[10px]">{ticket.category}</Badge>
            <Badge tone={tone}>{ticket.statusLabel}</Badge>
          </div>
          <p className="mt-1 truncate text-sm font-semibold">{ticket.subject}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmtRelative(ticket.createdAt)}
          </p>
        </div>
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>
      {expanded && (
        <div className="border-t border-border p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Description</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{ticket.description}</p>
          {ticket.attachmentUrl && (
            <div className="mt-3 rounded-md border border-border p-2">
              <p className="text-xs font-medium">Attachment</p>
              <a href={ticket.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                {ticket.attachmentName || "Download"}
              </a>
            </div>
          )}
          {ticket.response && (
            <div className="mt-3 rounded-md border border-success/30 bg-success/5 p-2">
              <p className="text-xs font-semibold text-success">Support Response</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{ticket.response}</p>
              {ticket.respondedAt && (
                <p className="mt-1 text-[11px] text-muted-foreground">{format(parseISO(ticket.respondedAt), "MMM d, yyyy")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </MobileCard>
  );
}

// ── Support request form (bottom sheet) ──────────────────────────

function SupportRequestForm({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("APPLICATION");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const canSubmit = subject.trim().length >= 3 && description.trim().length >= 10 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/student/support", {
        method: "POST",
        json: {
          subject: subject.trim(),
          category,
          description: description.trim(),
        },
      });
      toast({ title: "Request submitted", description: "Our team will get back to you.", variant: "success" });
      onSubmitted();
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:rounded-xl md:border md:border-t"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted md:hidden" />
        <h3 className="mb-3 text-base font-semibold">Submit Support Request</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              maxLength={200}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} disabled={submitting}>
              <option value="APPLICATION">Application</option>
              <option value="DOCUMENTS">Documents</option>
              <option value="UNIVERSITY">University</option>
              <option value="VISA">Visa</option>
              <option value="PAYMENTS">Payments</option>
              <option value="APPOINTMENTS">Appointments</option>
              <option value="ACCOUNT">Account</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your issue in detail (min 10 characters)"
              maxLength={5000}
              disabled={submitting}
              className="min-h-[100px]"
            />
            <p className="mt-0.5 text-[11px] text-muted-foreground">{description.length}/5000</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function FAQSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtRelative(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    const now = new Date();
    const hours = differenceInHours(now, date);
    if (hours < 24) return `${hours}h ago`;
    const days = differenceInDays(now, date);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    return format(date, "MMM d");
  } catch {
    return "—";
  }
}

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
