import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui";

export const metadata: Metadata = { title: "You are offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Card className="max-w-sm text-center">
        <CardContent className="space-y-3 p-6">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-warning/15 text-warning">
            <WifiOff className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold">You are offline</h1>
          <p className="text-sm text-muted-foreground">
            This page needs an internet connection. Your data is safe — reconnect and try again.
          </p>
          <a
            href="/student"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Try again
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
