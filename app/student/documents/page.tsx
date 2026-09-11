import type { Metadata } from "next";
import { DocumentsView } from "@/components/student/documents/documents-view";

export const metadata: Metadata = {
  title: "My Documents",
  description:
    "Upload, preview, and track your visa application documents. Files are stored privately and only accessible to you and your assigned counselor.",
};

export const dynamic = "force-dynamic";

/**
 * Module 06 — Student Document Management (/student/documents)
 *
 * Server component renders the client-side DocumentsView. Identity
 * and ownership are enforced at the layout level (StudentLayout →
 * requireStudentProfile) and at the API level (studentApiGuard in
 * every /api/student/documents* route).
 *
 * All document files are stored under PRIVATE_UPLOAD_DIR (NOT
 * /public/) — they are NEVER directly accessible via a URL. The only
 * way to retrieve a file is through /api/student/documents/[id]/download,
 * which verifies ownership server-side and streams the file with
 * Content-Disposition: attachment.
 */
export default function DocumentsPage() {
  return <DocumentsView />;
}
