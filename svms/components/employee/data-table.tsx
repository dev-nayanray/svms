import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui";
import { Skeleton } from "@/components/ui/overlays";

/**
 * Generic server-side data table shell. The page supplies the headers,
 * row mapper, and the rendered rows. This component handles the surrounding
 * chrome: card, overflow scroll, sticky header, empty/loading states.
 *
 * Not a feature-complete DataTable — just enough shared structure that the
 * students list and future employee list pages look consistent.
 */
export function DataTable({
  headers,
  children,
  empty,
  loading,
}: {
  headers: React.ReactNode;
  children: React.ReactNode;
  empty?: React.ReactNode;
  loading?: boolean;
  density?: "comfortable" | "compact";
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-8 w-full" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">{headers}</thead>
            <tbody className="divide-y divide-border">
              {children}
            </tbody>
          </table>
        </div>
        {empty && <div className="p-8 text-center text-sm text-muted-foreground">{empty}</div>}
      </CardContent>
    </Card>
  );
}

export function Th({
  children,
  className,
  sortKey,
  activeSort,
  onSort,
}: {
  children: React.ReactNode;
  className?: string;
  sortKey?: string;
  activeSort?: { key: string; dir: "asc" | "desc" };
  onSort?: (key: string) => void;
}) {
  const isSortable = !!sortKey && !!onSort;
  const isActive = activeSort?.key === sortKey;
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left font-medium text-muted-foreground",
        isSortable && "cursor-pointer hover:text-foreground",
        className,
      )}
      onClick={isSortable ? () => onSort?.(sortKey!) : undefined}
      aria-sort={isActive && activeSort ? (activeSort.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isSortable && (
          <span aria-hidden className={cn("text-[10px]", isActive ? "text-primary" : "text-muted-foreground/50")}>
            {isActive ? (activeSort!.dir === "asc" ? "↑" : "↓") : "↕"}
          </span>
        )}
      </span>
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
