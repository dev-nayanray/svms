import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-5xl font-bold text-muted-foreground">403</p>
      <h1 className="text-xl font-semibold">You do not have access to this page</h1>
      <p className="text-sm text-muted-foreground">
        Your role does not permit this action. Contact an administrator if you believe this is a
        mistake.
      </p>
      <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        Go home
      </Link>
    </div>
  );
}
