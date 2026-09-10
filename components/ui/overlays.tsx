"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg focus:outline-none",
          className
        )}
        {...props}
      >
        <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
        )}
        <div className="mt-4">{children}</div>
        <DialogPrimitive.Close
          aria-label="Close dialog"
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          ✕
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <DialogPrimitive.Content className="fixed right-0 top-0 z-50 flex h-full w-[95vw] max-w-xl flex-col border-l border-border bg-card shadow-lg focus:outline-none">
          <div className="flex items-center justify-between border-b border-border p-4">
            <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Close" className="text-muted-foreground hover:text-foreground">
              ✕
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        className={cn(
          "z-50 min-w-48 rounded-md border border-border bg-card p-1 shadow-md",
          className
        )}
        sideOffset={4}
        {...props}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-muted",
        className
      )}
      {...props}
    />
  );
}

export function Tabs({
  tabs,
  children,
  defaultValue,
}: {
  tabs: { value: string; label: string }[];
  children: React.ReactNode;
  defaultValue?: string;
}) {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue ?? tabs[0]?.value}>
      <TabsPrimitive.List className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <TabsPrimitive.Trigger
            key={t.value}
            value={t.value}
            className="relative rounded-t-md border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
          >
            {t.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

export const TabsContent = TabsPrimitive.Content;

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} style={style} />;
}
