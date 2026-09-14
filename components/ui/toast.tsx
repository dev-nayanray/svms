"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type Toast = { title: string; description?: string; variant?: "success" | "error" };

const ToastCtx = createContext<{ toast: (t: Toast) => void }>({ toast: () => {} });

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<(Toast & { id: number })[]>([]);

  const toast = useCallback((t: Toast) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            className={cn(
              "rounded-md border p-4 shadow-lg bg-card text-card-foreground",
              t.variant === "error" ? "border-destructive/50" : "border-border"
            )}
          >
            <ToastPrimitive.Title className="text-sm font-semibold">
              {t.variant === "error" ? "⚠ " : t.variant === "success" ? "✓ " : ""}
              {t.title}
            </ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                {t.description}
              </ToastPrimitive.Description>
            )}
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastCtx.Provider>
  );
}
