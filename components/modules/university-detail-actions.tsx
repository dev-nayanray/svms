"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { apiFetch } from "@/lib/api-client";
import { Heart, MessageCircle, ExternalLink, Check } from "lucide-react";

/**
 * Client-side action bar for the student university detail page. Renders
 * three actions:
 *  - Favorite toggle (heart) — optimistic local update via queryClient
 *  - Request counseling — opens a small dialog with a free-text message
 *  - Visit website — external link
 *
 * `isFavorite`, `counselingRequested` and `counselingRequestStatus` come
 * from the server-rendered detail payload so the initial paint is correct
 * without an extra round-trip.
 */
export function UniversityDetailActions({
  universityId,
  universityName,
  website,
  isFavorite: initialFavorite,
  counselingRequested: initialRequested,
  counselingRequestStatus,
}: {
  universityId: string;
  universityName: string;
  website: string | null;
  isFavorite: boolean;
  counselingRequested: boolean;
  counselingRequestStatus: string | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [counselingOpen, setCounselingOpen] = useState(false);
  const [counselingMessage, setCounselingMessage] = useState("");
  const [counselingBusy, setCounselingBusy] = useState(false);
  const [counselingRequested, setCounselingRequested] = useState(initialRequested);

  const toggleFavorite = async () => {
    setFavoriteBusy(true);
    const prev = isFavorite;
    setIsFavorite(!prev);
    try {
      await apiFetch<{ isFavorite: boolean }>("/api/student/favorites", {
        method: "POST",
        json: { universityId },
      });
      qc.invalidateQueries({ queryKey: ["/api/student/universities"] });
    } catch (err) {
      setIsFavorite(prev); // roll back
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setFavoriteBusy(false);
    }
  };

  const submitCounseling = async (e: React.FormEvent) => {
    e.preventDefault();
    setCounselingBusy(true);
    try {
      await apiFetch("/api/student/counseling-requests", {
        method: "POST",
        json: {
          universityId,
          message: counselingMessage.trim() || undefined,
        },
      });
      setCounselingRequested(true);
      toast({
        title: "Request sent",
        description: `Your counselor will reach out about ${universityName}.`,
        variant: "success",
      });
      setCounselingOpen(false);
      setCounselingMessage("");
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setCounselingBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={isFavorite ? "default" : "outline"}
        size="sm"
        onClick={toggleFavorite}
        disabled={favoriteBusy}
        aria-pressed={isFavorite}
      >
        <Heart
          className={isFavorite ? "h-4 w-4 fill-current" : "h-4 w-4"}
          aria-hidden
        />
        {isFavorite ? "Saved" : "Save"}
      </Button>

      {counselingRequested ? (
        <Button variant="outline" size="sm" disabled>
          <Check className="h-4 w-4" aria-hidden />
          {counselingRequestStatus === "PENDING"
            ? "Request pending"
            : counselingRequestStatus === "CONTACTED"
              ? "Counselor contacted you"
              : counselingRequestStatus === "RESOLVED"
                ? "Resolved"
                : "Request sent"}
        </Button>
      ) : (
        <Button size="sm" onClick={() => setCounselingOpen(true)}>
          <MessageCircle className="h-4 w-4" aria-hidden />
          Request counseling
        </Button>
      )}

      {website && (
        <a href={website} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4" aria-hidden />
            Visit website
          </Button>
        </a>
      )}

      <Dialog open={counselingOpen} onOpenChange={setCounselingOpen}>
        <DialogContent title={`Request counseling — ${universityName}`} className="max-w-md">
          <form onSubmit={submitCounseling} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tell your counselor what you&apos;d like to discuss. They&apos;ll see the
              university and your student profile.
            </p>
            <textarea
              autoFocus
              value={counselingMessage}
              onChange={(e) => setCounselingMessage(e.target.value)}
              placeholder="I'm interested in this university — can we discuss entry requirements and tuition?"
              className="min-h-[100px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              aria-label="Message to counselor"
              maxLength={2000}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCounselingOpen(false)}
                disabled={counselingBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={counselingBusy}>
                {counselingBusy ? "Sending…" : "Send request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
