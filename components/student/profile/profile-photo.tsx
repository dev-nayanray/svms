"use client";

import { useRef, useState } from "react";
import { Camera, Trash2, Upload, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

/**
 * Profile photo component for Module 03 (My Profile).
 *
 * Supports upload, preview, replace, and remove — all four actions
 * go through `/api/student/profile/photo` which atomically validates,
 * writes the file to disk, and commits the URL to the student record.
 *
 * On the client, the upload is two-stage:
 *   1. The user selects a file via the hidden <input type=file>.
 *   2. We immediately preview it locally with URL.createObjectURL so
 *      the user sees the new photo before the network round-trip
 *      completes; the network call happens in the background.
 *
 * If the upload fails (validation, network, server error), the local
 * preview is reverted to the previously-committed URL.
 */
export function ProfilePhoto({
  photoUrl,
  firstName,
  onChange,
}: {
  photoUrl: string | null | undefined;
  firstName: string;
  /** Called with the new profile view object after a successful upload/remove. */
  onChange: (view: unknown) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const initials = firstName?.charAt(0)?.toUpperCase() ?? "S";

  const displayedUrl = localPreview ?? photoUrl;

  async function handleFileSelected(file: File) {
    // Client-side validation mirroring the server — fast feedback.
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({
        title: "Unsupported file",
        description: "Use JPG, PNG, or WEBP.",
        variant: "error",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Photo too large",
        description: "Max file size is 5MB.",
        variant: "error",
      });
      return;
    }
    if (file.size === 0) {
      toast({ title: "Empty file", variant: "error" });
      return;
    }

    // Optimistic local preview.
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/student/profile/photo", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        throw new Error(body?.error?.message ?? "Upload failed");
      }
      onChange(body.data);
      toast({ title: "Photo updated", variant: "success" });
    } catch (err) {
      // Revert the local preview on failure.
      setLocalPreview(null);
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setUploading(false);
      // Revoke the object URL to release memory.
      URL.revokeObjectURL(previewUrl);
      if (localPreview !== previewUrl) setLocalPreview(null);
    }
  }

  async function handleRemove() {
    if (!photoUrl) return;
    if (!confirm("Remove your profile photo?")) return;
    setRemoving(true);
    try {
      const view = await apiFetch<unknown>("/api/student/profile/photo", { method: "DELETE" });
      onChange(view);
      toast({ title: "Photo removed", variant: "success" });
    } catch (err) {
      toast({
        title: "Could not remove photo",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <div
        className={cn(
          "relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted",
          uploading && "opacity-70"
        )}
      >
        {displayedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayedUrl} alt="Profile photo" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-primary/10 text-2xl font-bold text-primary">
            {initials}
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-black/30 text-xs font-medium text-white">
            Uploading…
          </span>
        )}
        {/* Click anywhere on the avatar to open the file picker (replace) */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || removing}
          aria-label={photoUrl ? "Replace profile photo" : "Upload profile photo"}
          className="absolute inset-0 grid place-items-center bg-black/0 transition-colors hover:bg-black/40 hover:text-white"
        >
          <Camera className="h-5 w-5 opacity-0 transition-opacity hover:opacity-100" aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:mt-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || removing}
          >
            <Upload className="h-4 w-4" aria-hidden />
            {photoUrl ? "Replace" : "Upload"}
          </Button>
          {photoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={uploading || removing}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG, or WEBP. Max 5MB.</p>
      </div>

      {/* Hidden file input — accepting only the safe image types. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileSelected(f);
          // Reset so selecting the same file twice fires onChange.
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Compact avatar used in the profile header (read-only). */
export function ProfileAvatar({
  photoUrl,
  name,
  size = "md",
}: {
  photoUrl: string | null | undefined;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-9 w-9 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-lg",
  } as const;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={name} loading="lazy" className={cn("rounded-full object-cover", sizes[size])} />;
  }
  return (
    <span
      className={cn(
        "grid place-items-center rounded-full bg-primary/10 font-semibold text-primary",
        sizes[size]
      )}
    >
      {initials || <UserRound className="h-1/2 w-1/2" aria-hidden />}
    </span>
  );
}
