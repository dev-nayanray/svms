"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Layers,
  RefreshCw,
  Upload,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import {
  MobilePage,
  MobileCard,
  StudentEmptyState,
  StudentErrorState,
  StudentSection,
  FilterChip,
  PageHeader,
  StatusBadge,
} from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { DOCUMENT_CATEGORIES } from "@/lib/constants/documents";
import { cn } from "@/lib/utils";
import { DocumentCard, type DocumentItem } from "./document-card";
import { UploadSheet } from "./upload-sheet";
import { BulkUploadSheet } from "./bulk-upload-sheet";
import { DocumentPreview } from "./document-preview";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<DocumentItem | null>(null);
  // Incremented each time the upload sheet opens — passed as the `key`
  // so the sheet component remounts and its useState initializers run
  // fresh. This is the React-recommended alternative to
  // "reset state in an effect when a prop changes".
  const [sheetInstance, setSheetInstance] = useState(0);
  const [bulkSheetInstance, setBulkSheetInstance] = useState(0);
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

  function openBulkUpload() {
    setBulkSheetInstance((n) => n + 1);
    setBulkOpen(true);
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
        <StudentErrorState
          online={online}
          title={!online ? "You're offline" : "Couldn't load your documents"}
          description={
            !online
              ? "Check your connection and try again."
              : listQ.error instanceof Error
                ? listQ.error.message
                : "Please try again in a moment."
          }
          onRetry={() => listQ.refetch()}
        />
      </MobilePage>
    );
  }

  // `docs` and `grouped` are derived above (before the early returns)
  // so hooks ordering is stable.

  return (
    <MobilePage>
      {/* Header summary card */}
      <PageHeader
        title="My Documents"
        subtitle="Upload, preview, and track your documents. Files are stored privately — only you and your assigned counselor can access them."
        icon={<FileText className="h-5 w-5" aria-hidden />}
        badge={<StatusBadge tone="info">{docs.length} total</StatusBadge>}
      />

      {/* Category filter chips */}
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1.5">
          <FilterChip
            active={categoryFilter === null}
            onClick={() => setCategoryFilter(null)}
          >
            All
          </FilterChip>
          {DOCUMENT_CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Status filter row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((s) => (
          <FilterChip
            key={s.value}
            active={statusFilter === s.value}
            onClick={() => setStatusFilter(s.value)}
          >
            {s.label}
          </FilterChip>
        ))}
      </div>

      {/* Documents list */}
      {docs.length === 0 ? (
        <StudentEmptyState
          icon={<FileText className="h-5 w-5" aria-hidden />}
          title="No documents here"
          description={
            categoryFilter || statusFilter !== "ALL"
              ? "No documents match your filters. Try clearing them."
              : "Upload your first document to get started."
          }
          action={
            <div className="flex gap-2">
              <Button onClick={openUpload} size="sm">
                <Upload className="h-4 w-4" aria-hidden /> Upload
              </Button>
              <Button onClick={openBulkUpload} variant="outline" size="sm">
                <Layers className="h-4 w-4" aria-hidden /> Upload multiple
              </Button>
            </div>
          }
        />
      ) : grouped ? (
        // Grouped-by-category view (no filter active)
        <div className="space-y-4">
          {DOCUMENT_CATEGORIES.map((cat) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;
            return (
              <StudentSection
                key={cat}
                label={`${cat} · ${items.length}`}
                bodyClassName="space-y-2"
              >
                {items.map((d) => (
                  <DocumentCard
                    key={d.id}
                    doc={d}
                    onUpload={openUploadForRequested}
                    onReplace={openReplace}
                    onView={setPreviewDoc}
                  />
                ))}
              </StudentSection>
            );
          })}
          {/* "Other" group — documents with null category */}
          {grouped["Other"] && grouped["Other"].length > 0 && (
            <StudentSection
              label={`Other · ${grouped["Other"].length}`}
              bodyClassName="space-y-2"
            >
              {grouped["Other"].map((d) => (
                <DocumentCard
                  key={d.id}
                  doc={d}
                  onUpload={openUploadForRequested}
                  onReplace={openReplace}
                  onView={setPreviewDoc}
                />
              ))}
            </StudentSection>
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

      {/* Sticky upload CTAs (mobile) */}
      {docs.length > 0 && (
        <div
          className={cn(
            "fixed inset-x-0 z-20 mx-auto flex max-w-lg items-center justify-center gap-2 px-3",
            "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] md:hidden",
          )}
        >
          <button
            type="button"
            onClick={openUpload}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-amber-500"
            aria-label="Upload a single document"
          >
            <Upload className="h-4 w-4" aria-hidden /> Upload
          </button>
          <button
            type="button"
            onClick={openBulkUpload}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-border bg-card/95 px-4 py-2.5 text-sm font-semibold text-foreground shadow-lg backdrop-blur-md transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-amber-500"
            aria-label="Upload multiple documents at once"
          >
            <Layers className="h-4 w-4" aria-hidden /> Multiple
          </button>
        </div>
      )}

      {/* Refresh + offline indicator */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching ? "Refreshing…" : "Updated just now"}</span>
        {!online && (
          <span className="flex items-center gap-1 text-amber-600">
            <WifiOff className="h-3 w-3" aria-hidden /> Offline
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={() => listQ.refetch()} disabled={listQ.isFetching} aria-label="Refresh list">
          <RefreshCw className={cn("h-3.5 w-3.5", listQ.isFetching && "animate-spin")} aria-hidden />
        </Button>
      </div>

      {/* Desktop CTA row */}
      <div className="hidden gap-2 sm:flex">
        <Button onClick={openUpload} size="sm">
          <Upload className="h-3.5 w-3.5" aria-hidden /> Upload single
        </Button>
        <Button onClick={openBulkUpload} size="sm" variant="outline">
          <Layers className="h-3.5 w-3.5" aria-hidden /> Upload multiple
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

      <BulkUploadSheet
        key={bulkSheetInstance}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
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

function FilterSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-48 rounded-full" />
      <Skeleton className="h-7 w-40 rounded-full" />
    </div>
  );
}

