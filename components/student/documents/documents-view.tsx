"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  FileText,
  RefreshCw,
  Upload,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, Badge } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { DOCUMENT_CATEGORIES } from "@/lib/constants/documents";
import { cn } from "@/lib/utils";
import { DocumentCard, type DocumentItem } from "./document-card";
import { UploadSheet } from "./upload-sheet";
import { DocumentPreview } from "./document-preview";

type ListResponse = { documents: DocumentItem[] };

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "REQUESTED", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

/**
 * Mobile-first document center for Module 06. Renders:
 *  - A category filter chip row (Personal, Academic, English Test,
 *    Financial, Passport, University, Visa, Other, All)
 *  - A status filter row (All / Pending / Approved / Rejected)
 *  - The document cards list, grouped by category when no category
 *    filter is selected; flat when filtered
 *  - A sticky "Upload" CTA at the bottom (above the bottom nav on
 *    mobile) for quick access to the upload sheet
 *  - States: loading skeleton, server error, offline, empty
 *
 * The Upload sheet (bottom-sheet mobile / right-drawer desktop) is
 * reused for both new uploads and replacements — the only difference
 * is whether `replaceId` is passed.
 */
export function DocumentsView() {
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<DocumentItem | null>(null);
  // Incremented each time the upload sheet opens — passed as the `key`
  // so the sheet component remounts and its useState initializers run
  // fresh. This is the React-recommended alternative to
  // "reset state in an effect when a prop changes".
  const [sheetInstance, setSheetInstance] = useState(0);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  const listQ = useQuery<ListResponse>({
    queryKey: ["student-documents", categoryFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const qs = params.toString();
      return apiFetch<ListResponse>(
        `/api/student/documents${qs ? `?${qs}` : ""}`,
      );
    },
    retry: false,
    staleTime: 15_000,
  });

  const online = useOnlineStatus();

  // Derive `docs` and `grouped` BEFORE the early returns — hooks must
  // be called in the same order every render, so useMemo can't come
  // after a conditional return.
  const docs = useMemo(() => listQ.data?.documents ?? [], [listQ.data]);
  const grouped = useMemo(() => {
    if (categoryFilter) return null;
    const groups: Record<string, DocumentItem[]> = {};
    for (const d of docs) {
      const key = d.category ?? "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }
    return groups;
  }, [docs, categoryFilter]);

  function handleUploaded() {
    // Invalidate the list query to refetch with the new document.
    qc.invalidateQueries({ queryKey: ["student-documents"] });
  }

  function openUpload() {
    setReplaceTarget(null);
    setSheetInstance((n) => n + 1);
    setUploadOpen(true);
  }

  function openReplace(doc: DocumentItem) {
    setReplaceTarget(doc);
    setSheetInstance((n) => n + 1);
    setUploadOpen(true);
  }

  function openUploadForRequested() {
    // For REQUESTED documents, "Upload" opens the new-upload sheet
    // (no replaceId) with the name pre-filled from the requirement.
    setReplaceTarget(null);
    setSheetInstance((n) => n + 1);
    setUploadOpen(true);
  }

  // Loading state — skeleton cards.
  if (listQ.isLoading && !listQ.data) {
    return (
      <MobilePage>
        <FilterSkeleton />
        <div className="space-y-3" aria-busy="true" aria-label="Loading documents">
          {Array.from({ length: 4 }).map((_, i) => (
            <MobileCard key={i}>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
              <Skeleton className="mt-3 h-8 w-1/3" />
            </MobileCard>
          ))}
        </div>
      </MobilePage>
    );
  }

  // Error state — server or offline.
  if (listQ.isError && !listQ.data) {
    return (
      <MobilePage>
        <MobileCard className="py-8 text-center">
          {!online ? (
            <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          ) : (
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
          )}
          <h2 className="mt-3 text-base font-semibold">
            {!online ? "You're offline" : "Couldn't load your documents"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {!online
              ? "Check your connection and try again."
              : listQ.error instanceof Error
                ? listQ.error.message
                : "Please try again in a moment."}
          </p>
          <Button onClick={() => listQ.refetch()} className="mt-4" disabled={!online}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Retry
          </Button>
        </MobileCard>
      </MobilePage>
    );
  }

  // `docs` and `grouped` are derived above (before the early returns)
  // so hooks ordering is stable.

  return (
    <MobilePage>
      {/* Header summary card */}
      <MobileCard className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold">My Documents</h1>
          <Badge tone="info">{docs.length} total</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload, preview, and track your documents. Files are stored privately — only you and your assigned counselor can access them.
        </p>
      </MobileCard>

      {/* Category filter chips */}
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1.5">
          <CategoryChip
            active={categoryFilter === null}
            onClick={() => setCategoryFilter(null)}
          >
            All
          </CategoryChip>
          {DOCUMENT_CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </CategoryChip>
          ))}
        </div>
      </div>

      {/* Status filter row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatusFilter(s.value)}
            aria-pressed={statusFilter === s.value}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
              statusFilter === s.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Documents list */}
      {docs.length === 0 ? (
        <MobileCard className="py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <FileText className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-semibold">No documents here</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {categoryFilter || statusFilter !== "ALL"
              ? "No documents match your filters. Try clearing them."
              : "Upload your first document to get started."}
          </p>
          <Button onClick={openUpload} className="mt-4">
            <Upload className="h-4 w-4" aria-hidden /> Upload Document
          </Button>
        </MobileCard>
      ) : grouped ? (
        // Grouped-by-category view (no filter active)
        <div className="space-y-4">
          {DOCUMENT_CATEGORIES.map((cat) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {cat} · {items.length}
                </h2>
                <div className="space-y-2">
                  {items.map((d) => (
                    <DocumentCard
                      key={d.id}
                      doc={d}
                      onUpload={openUploadForRequested}
                      onReplace={openReplace}
                      onView={setPreviewDoc}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {/* "Other" group — documents with null category */}
          {grouped["Other"] && grouped["Other"].length > 0 && (
            <div className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Other · {grouped["Other"].length}
              </h2>
              <div className="space-y-2">
                {grouped["Other"].map((d) => (
                  <DocumentCard
                    key={d.id}
                    doc={d}
                    onUpload={openUploadForRequested}
                    onReplace={openReplace}
                    onView={setPreviewDoc}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Flat filtered view
        <div className="space-y-2">
          {docs.map((d) => (
            <DocumentCard
              key={d.id}
              doc={d}
              onUpload={openUploadForRequested}
              onReplace={openReplace}
              onView={setPreviewDoc}
            />
          ))}
        </div>
      )}

      {/* Sticky upload CTA (mobile) */}
      {docs.length > 0 && (
        <div
          className={cn(
            "fixed inset-x-0 z-20 mx-auto flex max-w-md items-center justify-center gap-2 px-3",
            "bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] md:hidden",
          )}
        >
          <button
            type="button"
            onClick={openUpload}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Upload a new document"
          >
            <Upload className="h-4 w-4" aria-hidden /> Upload Document
          </button>
        </div>
      )}

      {/* Refresh + offline indicator */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching ? "Refreshing…" : "Updated just now"}</span>
        {!online && (
          <span className="flex items-center gap-1 text-warning">
            <WifiOff className="h-3 w-3" aria-hidden /> Offline
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={() => listQ.refetch()} disabled={listQ.isFetching}>
          <RefreshCw className={cn("h-3.5 w-3.5", listQ.isFetching && "animate-spin")} aria-hidden />
        </Button>
      </div>

      {/* Modals */}
      <UploadSheet
        key={sheetInstance}
        open={uploadOpen}
        onOpenChange={(v) => {
          setUploadOpen(v);
          if (!v) setReplaceTarget(null);
        }}
        replaceId={replaceTarget?.id}
        replaceName={replaceTarget?.name}
        defaultCategory={replaceTarget?.category ?? undefined}
        onUploaded={handleUploaded}
      />

      <DocumentPreview
        doc={previewDoc}
        open={!!previewDoc}
        onOpenChange={(v) => {
          if (!v) setPreviewDoc(null);
        }}
      />
    </MobilePage>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FilterSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-48 rounded-full" />
      <Skeleton className="h-7 w-40 rounded-full" />
    </div>
  );
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
