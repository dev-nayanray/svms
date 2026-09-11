"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { Upload, FileText, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, Select, Label } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { DOCUMENT_CATEGORIES } from "@/lib/constants/documents";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";
const MAX_SIZE = 10 * 1024 * 1024;

/**
 * Bottom-sheet (mobile) / right-drawer (desktop) upload flow for
 * Module 06. Handles both new uploads and replacements — the only
 * difference is the `replaceId` prop (set when replacing an existing
 * document). The sheet is intentionally dumb: it owns form state and
 * the upload lifecycle, but the parent owns the document list cache
 * (TanStack Query).
 *
 * Upload lifecycle states:
 *  - idle       — form is editable, no upload in flight
 *  - uploading   — POST in flight; the progress bar animates
 *  - success     — brief "Uploaded" state, then the sheet closes
 *  - error       — error toast + sheet stays open so the student can retry
 *
 * Client-side validation mirrors the server-side validation. The
 * server is the source of truth — even if a malicious client bypasses
 * these checks, the server rejects the upload with 422.
 */
export function UploadSheet({
  open,
  onOpenChange,
  replaceId,
  replaceName,
  defaultCategory,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When set, the sheet is in "replace" mode — uploads a new version. */
  replaceId?: string;
  /** The name of the document being replaced (for the header copy). */
  replaceName?: string;
  /** Default category to pre-select (used when replacing). */
  defaultCategory?: string;
  /** Called with the new document view after a successful upload. */
  onUploaded: (doc: unknown) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState(replaceName ?? "");
  const [category, setCategory] = useState<string>(defaultCategory ?? "Personal");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // The parent passes a `key` that changes each time the sheet opens,
  // so React remounts this component and all useState initializers run
  // fresh. This avoids the "setState synchronously in an effect" pattern
  // that the lint rule flags — we don't need to sync `open` to internal
  // state because the remount already gives us fresh state.

  // Lock body scroll while the sheet is open. This is a side effect on
  // the DOM (not React state), so it doesn't trigger the
  // set-state-in-effect rule.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function validateFile(file: File): string | null {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return `Unsupported file type: ${file.type || "unknown"}. Use PDF, JPG, PNG, or WebP.`;
    }
    if (file.size === 0) return "File is empty.";
    if (file.size > MAX_SIZE) {
      return `File exceeds the 10MB limit (received ${(file.size / 1024 / 1024).toFixed(1)} MB).`;
    }
    return null;
  }

  function handleFileSelected(file: File) {
    const err = validateFile(file);
    if (err) {
      toast({ title: "Invalid file", description: err, variant: "error" });
      return;
    }
    setSelectedFile(file);
    // Auto-fill the name field if it's empty.
    if (!name) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setName(baseName);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      toast({ title: "Select a file first", variant: "error" });
      return;
    }
    if (!name.trim()) {
      toast({ title: "Document name is required", variant: "error" });
      return;
    }

    setUploading(true);
    setProgress(0);

    // Use XHR so we can track upload progress. The fetch() API doesn't
    // support upload progress events yet.
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("name", name.trim());
    formData.append("category", category);

    const url = replaceId
      ? `/api/student/documents/${replaceId}/replace`
      : "/api/student/documents";

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      xhr.addEventListener("load", () => {
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && body?.success) {
            toast({
              title: replaceId ? "Document replaced" : "Document uploaded",
              description: "Your counselor has been notified to review it.",
              variant: "success",
            });
            onUploaded(body.data.document);
            onOpenChange(false);
            resolve();
          } else {
            const msg = body?.error?.message ?? "Upload failed";
            const fields = body?.error?.fields as Record<string, string> | undefined;
            const fieldMsg = fields ? ` (${Object.values(fields).join("; ")})` : "";
            toast({
              title: "Upload failed",
              description: `${msg}${fieldMsg}`,
              variant: "error",
            });
            resolve();
          }
        } catch {
          toast({ title: "Upload failed", description: "Invalid server response", variant: "error" });
          resolve();
        }
      });
      xhr.addEventListener("error", () => {
        toast({ title: "Upload failed", description: "Network error", variant: "error" });
        resolve();
      });
      xhr.addEventListener("abort", () => {
        toast({ title: "Upload cancelled" });
        resolve();
      });
      xhr.open("POST", url);
      xhr.send(formData);
    });

    setUploading(false);
  }

  const isReplace = !!replaceId;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col bg-card shadow-xl outline-none",
            "inset-x-0 bottom-0 top-auto max-h-[92dvh] rounded-t-2xl border-t border-border",
            "md:inset-y-0 md:left-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[480px] md:rounded-none md:border-l md:border-t-0",
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-border p-4 pb-3">
            <div className="min-w-0">
              <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted md:hidden" />
              <DialogPrimitive.Title className="truncate text-base font-semibold">
                {isReplace ? "Replace Document" : "Upload Document"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                {isReplace
                  ? `Replace "${replaceName ?? ""}" — the old version is preserved in history.`
                  : "Upload a new document. PDF, JPG, PNG, or WebP. Max 10MB."}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {/* File drop zone */}
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
                const f = e.dataTransfer.files?.[0];
                if (f) handleFileSelected(f);
              }}
              className={cn(
                "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:bg-muted/60",
              )}
            >
              {selectedFile ? (
                <>
                  <FileText className="h-8 w-8 text-primary" aria-hidden />
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {selectedFile.type}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                    className="mt-1 text-xs text-destructive hover:underline"
                  >
                    Remove file
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-medium">Tap to select a file</p>
                  <p className="text-xs text-muted-foreground">or drag and drop here</p>
                  <p className="text-[11px] text-muted-foreground/70">PDF, JPG, PNG, WebP · max 10MB</p>
                </>
              )}
            </div>

            {/* Document name */}
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="doc-name">Document name</Label>
              <Input
                id="doc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Passport bio page"
                maxLength={200}
                disabled={uploading}
              />
            </div>

            {/* Category */}
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="doc-category">Category</Label>
              <Select
                id="doc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={uploading}
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            {/* Upload progress */}
            {uploading && (
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Uploading…</span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Upload progress"
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Replace-mode hint */}
            {isReplace && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-2.5 text-xs text-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
                <p>
                  The current version will be preserved in the document&apos;s history.
                  The new upload starts as <strong>UPLOADED</strong> and needs review again.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
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
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !name.trim()}
              className="flex-1"
              type="button"
            >
              {uploading ? "Uploading…" : isReplace ? "Replace" : "Upload"}
            </Button>
          </div>

          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
              e.target.value = "";
            }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Small inline success state — used after a replace to confirm. */
export function UploadSuccessInline({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2 py-1 text-xs text-success">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Uploaded
    </div>
  );
}
