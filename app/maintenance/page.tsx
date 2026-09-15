import { getActiveMaintenance } from "@/lib/system/maintenance";
import { APP_NAME } from "@/lib/constants/app";

export const dynamic = "force-dynamic";

/**
 * Public maintenance page — rendered when an active MaintenanceWindow
 * exists. Used by server components that detect maintenance.
 */
export default async function MaintenancePage() {
  const status = await getActiveMaintenance();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-warning"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 3.5L2 19a2 2 0 002 2h16a2 2 0 002-2L13 3.5a2 2 0 00-2 0z M12 9v4 M12 17h.01"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">{APP_NAME} is under maintenance</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {status.message}
        </p>
        {status.expectedEndAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            Expected to be back by{" "}
            <strong>
              {new Date(status.expectedEndAt).toLocaleString("en-GB")}
            </strong>
            .
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Thank you for your patience. We&apos;ll be back shortly.
        </p>
      </div>
    </div>
  );
}
