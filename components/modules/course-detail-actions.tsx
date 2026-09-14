"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { apiFetch } from "@/lib/api-client";
import { MessageCircle, Check, ExternalLink } from "lucide-react";

/**
 * Client-side action bar for the student course detail page.
 *
 * Renders two primary actions:
 *  - Request Counseling — opens a dialog with a free-text message; the
 *    POST hits the existing `/api/student/counseling-requests` endpoint
 *    with both `universityId` and `courseId` so the counselor sees exactly
 *    which course the student is interested in.
 *  - Visit University — link to the parent university's detail page.
 *
 * `counselingRequested` and `counselingRequestStatus` come from the
 * server-rendered detail payload so the initial paint is correct without
 * an extra round-trip.
 */
export function CourseDetailActions({
  universityId,
  courseId,
  courseName,
  universityName,
  counselingRequested: initialRequested,
  counselingRequestStatus,
}: {
  universityId: string;
  courseId: string;
  courseName: string;
  universityName: string;
  counselingRequested: boolean;
  counselingRequestStatus: string | null;
}) {
  const { toast } = useToast();
  const [counselingOpen, setCounselingOpen] = useState(false);
  const [counselingMessage, setCounselingMessage] = useState("");
  const [counselingBusy, setCounselingBusy] = useState(false);
  const [counselingRequested, setCounselingRequested] = useState(initialRequested);

  const submitCounseling = async (e: React.FormEvent) => {
    e.preventDefault();
    setCounselingBusy(true);
    try {
      await apiFetch("/api/student/counseling-requests", {
        method: "POST",
        json: {
          universityId,
          courseId,
          message: counselingMessage.trim() || undefined,
        },
      });
      setCounselingRequested(true);
      toast({
        title: "Request sent",
        description: `Your counselor will reach out about ${courseName}.`,
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

      <a href={`/student/universities/${universityId}`}>
        <Button variant="ghost" size="sm">
          <ExternalLink className="h-4 w-4" aria-hidden />
          View university
        </Button>
      </a>

      <Dialog open={counselingOpen} onOpenChange={setCounselingOpen}>
        <DialogContent
          title={`Request counseling — ${courseName}`}
          description={`At ${universityName}`}
          className="max-w-md"
        >
          <form onSubmit={submitCounseling} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tell your counselor what you&apos;d like to discuss about this course. They&apos;ll
              see the course and your student profile.
            </p>
            <textarea
              autoFocus
              value={counselingMessage}
              onChange={(e) => setCounselingMessage(e.target.value)}
              placeholder="I'm interested in this course — can we discuss entry requirements and tuition?"
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
