"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, Select, Label } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { DOCUMENT_CATEGORIES } from "@/lib/constants/documents";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 10; // hard cap to keep sheet usable + rate-limit friendly

type ItemStatus = "queued" | "uploading" | "done" | "error";

type BulkItem = {
  id: string; // client-side only — generated UUID-ish
  file: File;
  name: string;
  category: string;
  status: ItemStatus;
  progress: number; // 0..100
  errorMessage?: string;
};

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) {
    return `Unsupported file type: ${file.type || "unknown"}. Use PDF, JPG, PNG, or WebP.`;
  }
  if (file.size === 0) return "File is empty.";
  if (file.size > MAX_SIZE) {
    return `File exceeds the 10MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  }
  return null;
}

function nextId(): string {
  // Avoid pulling in crypto.randomUUID for older environments.
  return `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Bottom-sheet (mobile) / right-drawer (desktop) BULK upload flow.
 * Lets a student upload up to 10 documents at once — useful during
 * visa processing when they need to drop 5+ certificates at once.
 *
 * UX:
 *  - Drag-drop or tap-to-select multiple files (multi-select enabled)
 *  - A shared category dropdown at the top — applies to all queued
 *    files by default. Per-file category can be overridden.
 *  - Each row shows: name (editable), category dropdown, size,
 *    status pill (queued / uploading X% / done / failed), remove btn
 *  - "Upload all" button — uploads SEQUENTIALLY (not in parallel)
 *    to respect the server's rate-limit (20 bursts / IP, +1 / 3s).
 *  - Per-file progress bar via XHR upload events.
 *  - Retry-failed-files button after the first pass.
 *  - Auto-close after success (only when there are no failures).
 *
 * The sheet is intentionally dumb: it owns the per-item state and
 * the upload lifecycle, but the parent owns the document list cache
 * (TanStack Query). Parent's `onUploaded` is called once per
 * successful file so the cache is invalidated progressively — the
 * student sees new cards appear in the list as each upload completes,
 * rather than all at once at the end.
 */
export function BulkUploadSheet({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called once per successful file upload. */
  onUploaded: (doc: unknown) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BulkItem[]>([]);
  const [sharedCategory, setSharedCategory] = useState<string>("Other");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Lock body scroll while sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    if (items.length + files.length > MAX_FILES) {
      toast({
        title: "Too many files",
        description: `You can upload at most ${MAX_FILES} files at once. ${MAX_FILES - items.length} more slots available.`,
        variant: "error",
      });
      return;
    }

    const newItems: BulkItem[] = [];
    let rejected = 0;
    for (const f of files) {
      const err = validateFile(f);
      if (err) {
        toast({ title: "Skipped file", description: `${f.name}: ${err}`, variant: "error" });
        rejected++;
        continue;
      }
      const baseName = f.name.replace(/\.[^/.]+$/, "");
      newItems.push({
        id: nextId(),
        file: f,
        name: baseName,
        category: sharedCategory,
        status: "queued",
        progress: 0,
      });
    }
    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      if (rejected === 0) {
        toast({
          title: `Added ${newItems.length} file${newItems.length === 1 ? "" : "s"}`,
          description: "Tap Upload all when you're ready.",
        });
      }
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: string, patch: Partial<BulkItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function applySharedCategoryToAll(category: string) {
    setSharedCategory(category);
    // Apply to all QUEUED items only — don't touch items that are
    // already uploading or done.
    setItems((prev) =>
      prev.map((i) =>
        i.status === "queued" ? { ...i, category } : i,
      ),
    );
  }

  async function uploadOne(item: BulkItem): Promise<void> {
    updateItem(item.id, { status: "uploading", progress: 0, errorMessage: undefined });

    const formData = new FormData();
    formData.append("file", item.file);
    formData.append("name", item.name.trim());
    formData.append("category", item.category);

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          updateItem(item.id, { progress: pct });
        }
      });
      xhr.addEventListener("load", () => {
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && body?.success) {
            updateItem(item.id, { status: "done", progress: 100 });
            onUploaded(body.data.document);
            resolve();
          } else {
            const msg = body?.error?.message ?? "Upload failed";
            const fields = body?.error?.fields as Record<string, string> | undefined;
            const fieldMsg = fields ? ` (${Object.values(fields).join("; ")})` : "";
            updateItem(item.id, { status: "error", errorMessage: `${msg}${fieldMsg}` });
            resolve();
          }
        } catch {
          updateItem(item.id, { status: "error", errorMessage: "Invalid server response" });
          resolve();
        }
      });
      xhr.addEventListener("error", () => {
        updateItem(item.id, { status: "error", errorMessage: "Network error" });
        resolve();
      });
      xhr.addEventListener("abort", () => {
        updateItem(item.id, { status: "queued", progress: 0 });
        resolve();
      });
      xhr.open("POST", "/api/student/documents");
      xhr.send(formData);
    });
  }

  async function handleUploadAll() {
    // Validate names first — surface all problems at once.
    const invalid = items.filter((i) => i.name.trim().length < 1);
    if (invalid.length > 0) {
      toast({
        title: "Name required",
        description: `${invalid.length} file${invalid.length === 1 ? "" : "s"} need a document name.`,
        variant: "error",
      });
      return;
    }

    setUploading(true);
    // Upload sequentially to respect the server's rate-limit. With
    // 20 bursts per IP + 1 token / 3s, a 10-file sequential upload
    // stays comfortably under the limit.
    const queue = items.filter((i) => i.status === "queued" || i.status === "error");
    for (const item of queue) {
      await uploadOne(item);
    }
    setUploading(false);

    // After all done, show summary + auto-close if no failures.
    // Use setTimeout to let React flush the final status updates
    // before checking the result. This avoids stale-closure bugs.
    setTimeout(() => {
      setItems((current) => {
        const succeeded = current.filter((i) => i.status === "done").length;
        const failed = current.filter((i) => i.status === "error").length;
        if (failed === 0 && succeeded > 0) {
          toast({
            title: `Uploaded ${succeeded} file${succeeded === 1 ? "" : "s"}`,
            description: "Your counselor has been notified to review them.",
            variant: "success",
          });
          onOpenChange(false);
          // Clear items after close animation starts.
          setTimeout(() => setItems([]), 200);
        } else if (failed > 0 && succeeded > 0) {
          toast({
            title: `${succeeded} uploaded, ${failed} failed`,
            description: "Tap Retry failed to re-upload the failed files.",
            variant: "error",
          });
        } else if (failed > 0 && succeeded === 0) {
          toast({
            title: "All uploads failed",
            description: "Check your connection and tap Retry failed.",
            variant: "error",
          });
        }
        return current;
      });
    }, 50);
  }

  function handleRetryFailed() {
    // Reset failed items back to queued so handleUploadAll picks them up.
    setItems((prev) =>
      prev.map((i) =>
        i.status === "error" ? { ...i, status: "queued", progress: 0, errorMessage: undefined } : i,
      ),
    );
    // Use setTimeout so the state update flushes before we start uploading.
    setTimeout(() => handleUploadAll(), 0);
  }

  const queuedCount = items.filter((i) => i.status === "queued").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const totalCount = items.length;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col bg-card shadow-xl outline-none",
            "inset-x-0 bottom-0 top-auto max-h-[92dvh] rounded-t-2xl border-t border-border",
            "md:inset-y-0 md:left-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[520px] md:rounded-none md:border-l md:border-t-0",
          )}
        >
          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-3 border-b border-border p-4 pb-3">
            <div className="min-w-0">
              <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted md:hidden" />
              <DialogPrimitive.Title className="truncate text-base font-semibold">
                Upload multiple documents
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                Up to {MAX_FILES} files at once. PDF, JPG, PNG, WebP · max 10MB each.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {/* Drag-drop zone */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 text-center transition-colors focus-visible:outline-2 focus-visible:outline-amber-500",
                dragOver ? "border-amber-500 bg-amber-500/5" : "border-border bg-muted/30 hover:bg-muted/60",
              )}
            >
              <Upload className="h-7 w-7 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Tap to select files</p>
              <p className="text-xs text-muted-foreground">or drag and drop multiple files here</p>
            </div>

            {/* Shared category — applies to all queued items */}
            {totalCount > 0 && (
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="shared-category">Category (applies to all)</Label>
                <Select
                  id="shared-category"
                  value={sharedCategory}
                  onChange={(e) => applySharedCategoryToAll(e.target.value)}
                  disabled={uploading}
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* File list */}
            {totalCount > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="tabular-nums">{totalCount} file{totalCount === 1 ? "" : "s"}</span>
                  <span className="tabular-nums">
                    {doneCount > 0 && <span className="text-emerald-600">{doneCount} done</span>}
                    {doneCount > 0 && errorCount > 0 && " · "}
                    {errorCount > 0 && <span className="text-red-600">{errorCount} failed</span>}
                    {queuedCount > 0 && (doneCount > 0 || errorCount > 0) && " · "}
                    {queuedCount > 0 && <span>{queuedCount} queued</span>}
                  </span>
                </div>

                {items.map((item) => (
                  <FileRow
                    key={item.id}
                    item={item}
                    onRemove={() => removeItem(item.id)}
                    onNameChange={(name) => updateItem(item.id, { name })}
                    onCategoryChange={(category) => updateItem(item.id, { category })}
                    disabled={uploading || item.status === "uploading" || item.status === "done"}
                  />
                ))}
              </div>
            )}

            {/* Inline empty-state hint */}
            {totalCount === 0 && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                No files added yet. Pick a few files above to start.
              </p>
            )}
          </div>

          {/* ── Sticky footer ── */}
          <div className="flex items-center gap-2 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
              className="flex-1"
              type="button"
            >
              Cancel
            </Button>
            {errorCount > 0 && queuedCount === 0 ? (
              <Button
                onClick={handleRetryFailed}
                disabled={uploading}
                className="flex-1"
                type="button"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Retry {errorCount} failed
              </Button>
            ) : (
              <Button
                onClick={handleUploadAll}
                disabled={uploading || queuedCount === 0}
                className="flex-1"
                type="button"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" aria-hidden />
                    Upload all{queuedCount > 0 ? ` (${queuedCount})` : ""}
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Hidden file input — allows multi-select */}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── File row ─────────────────────────────────────────────────────

function FileRow({
  item,
  onRemove,
  onNameChange,
  onCategoryChange,
  disabled,
}: {
  item: BulkItem;
  onRemove: () => void;
  onNameChange: (name: string) => void;
  onCategoryChange: (category: string) => void;
  disabled: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        item.status === "done" && "border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/10",
        item.status === "error" && "border-red-300/60 bg-red-50/40 dark:bg-red-950/10",
        item.status === "uploading" && "border-blue-300/60 bg-blue-50/40 dark:bg-blue-950/10",
        item.status === "queued" && "border-border bg-card",
      )}
    >
      {/* Top row: icon + name input + status pill + remove */}
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-md",
            item.status === "done" && "bg-emerald-500/15 text-emerald-600",
            item.status === "error" && "bg-red-500/15 text-red-600",
            item.status === "uploading" && "bg-blue-500/15 text-blue-600",
            item.status === "queued" && "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {item.status === "done" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : item.status === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : item.status === "uploading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <Input
            value={item.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Document name"
            maxLength={200}
            disabled={disabled}
            className="h-8 text-sm"
          />
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate tabular-nums">{item.file.name} · {(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
            <span className="shrink-0 tabular-nums">
              {item.status === "queued" && "Queued"}
              {item.status === "uploading" && `${item.progress}%`}
              {item.status === "done" && "Uploaded"}
              {item.status === "error" && (item.errorMessage ?? "Failed")}
            </span>
          </div>
        </div>

        {/* Remove button — only show when not uploading */}
        {item.status !== "uploading" && item.status !== "done" && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove file"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Per-file category dropdown */}
      {item.status !== "done" && (
        <Select
          value={item.category}
          onChange={(e) => onCategoryChange(e.target.value)}
          disabled={disabled}
          className="mt-2 h-7 text-xs"
        >
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      )}

      {/* Progress bar */}
      {item.status === "uploading" && (
        <div
          role="progressbar"
          aria-valuenow={item.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Uploading ${item.name}`}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-blue-500 transition-[width] motion-reduce:transition-none"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
