import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-5xl font-bold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        Go home
      </Link>
    </div>
  );
}
