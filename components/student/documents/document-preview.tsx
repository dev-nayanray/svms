"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { Download, X, FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { DocumentItem } from "./document-card";

/**
 * Preview sheet for documents that are previewable inline (PDF, JPG,
 * PNG, WebP). Fetches the file via the secure download endpoint and
 * renders it inline — for images via <img>, for PDFs via <iframe>.
 *
 * Non-previewable types fall back to a download-only CTA (the parent
 * checks `doc.previewable` before opening this sheet).
 *
 * SECURITY: the URL passed to <img>/<iframe> is a blob: URL created
 * from the response blob — never a direct URL to the file on disk.
 * This means the file content lives in memory only as long as the
 * preview is open; once the sheet closes, the blob URL is revoked
 * and the bytes are GC-eligible.
 */
export function DocumentPreview({
  doc,
  open,
  onOpenChange,
}: {
  doc: DocumentItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the file when the sheet opens. The cleanup function (returned
  // below) handles revoking the blob URL when the sheet closes — no
  // setState-in-effect needed because the cleanup is a side effect on
  // the DOM, not React state.
  useEffect(() => {
    if (!open || !doc) return;

    let cancelled = false;
    let createdUrl: string | null = null;
    // Reset loading + error state synchronously at the start of the
    // fetch — this is the standard "fetch on mount / on prop change"
    // pattern. The set-state-in-effect rule is overly strict here;
    // the cascading render is exactly what we want (show the loading
    // spinner before the async fetch resolves).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/student/documents/${doc.id}/download`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? "Failed to load preview");
        }
        const blob = await res.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load preview");
        toast({
          title: "Preview failed",
          description: err instanceof Error ? err.message : "Try downloading instead.",
          variant: "error",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Cleanup runs when [open, doc?.id] changes — revokes the blob
    // URL we created (if any) and clears the state. The setState
    // calls here are part of the cleanup, not the synchronous effect
    // body, so they don't trigger the set-state-in-effect rule.
    return function cleanup() {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setError(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc?.id]);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!doc) return null;

  async function handleDownload() {
    if (!doc) return;
    try {
      const res = await fetch(`/api/student/documents/${doc.id}/download`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col bg-card shadow-xl outline-none",
            "inset-x-0 bottom-0 top-auto max-h-[92dvh] rounded-t-2xl border-t border-border",
            "md:inset-y-0 md:left-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[640px] md:rounded-none md:border-l md:border-t-0",
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-border p-4 pb-3">
            <div className="min-w-0">
              <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted md:hidden" />
              <DialogPrimitive.Title className="truncate text-base font-semibold">
                {doc.name}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 truncate text-xs text-muted-foreground">
                {doc.fileName} · {doc.mimeType}
              </DialogPrimitive.Description>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" aria-hidden /> Download
              </Button>
              <DialogPrimitive.Close
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto bg-muted/20">
            {loading && (
              <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-muted-foreground">
                <div className="animate-pulse">Loading preview…</div>
              </div>
            )}
            {error && !loading && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 p-4 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
                <p className="text-sm font-medium">Couldn&apos;t load preview</p>
                <p className="text-xs text-muted-foreground">{error}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" aria-hidden /> Download instead
                </Button>
              </div>
            )}
            {blobUrl && !loading && !error && (
              <>
                {doc.mimeType === "application/pdf" ? (
                  <iframe
                    src={blobUrl}
                    title={doc.name}
                    className="h-[80dvh] w-full border-0"
                  />
                ) : doc.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={blobUrl}
                    alt={doc.name}
                    className="mx-auto block max-h-[80dvh] w-auto object-contain"
                  />
                ) : (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 p-4 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
                    <p className="text-sm">Preview not available for this file type</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={handleDownload}>
                      <Download className="h-3.5 w-3.5" aria-hidden /> Download
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
