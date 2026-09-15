import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="relative h-10 w-10 overflow-hidden rounded-lg">
            <Image
              src="/euroscope-mark.png"
              alt="Euroscope"
              fill
              sizes="40px"
              className="object-contain"
              priority
            />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-xl font-bold tracking-tight">Euroscope</span>
            <span className="text-xs text-muted-foreground">
              Your journey to studying in Europe
            </span>
          </span>
        </Link>
        <Card>
          <CardContent className="p-6">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
