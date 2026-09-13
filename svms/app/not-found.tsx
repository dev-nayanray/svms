import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Compass className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link href="/home"><Button>Go home</Button></Link>
          <Link href="/contact"><Button variant="outline">Contact us</Button></Link>
        </div>
      </div>
    </div>
  );
}
