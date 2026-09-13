import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";

export default function ForbiddenPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          You don&apos;t have permission to access this page. If you believe this is an error,
          please contact your administrator.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link href="/"><Button variant="outline">Go home</Button></Link>
          <Link href="/login"><Button>Switch account</Button></Link>
        </div>
      </div>
    </div>
  );
}
