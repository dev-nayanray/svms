"use client";

/** Fetch helper for the API envelope: unwraps `data` and throws readable errors. */
export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    const fields = body?.error?.fields as Record<string, string> | undefined;
    const fieldMsg = fields ? ` (${Object.values(fields).join("; ")})` : "";
    throw new Error(`${body?.error?.message ?? `Request failed (${res.status})`}${fieldMsg}`);
  }
  return body.data as T;
}

export type Paged<T> = {
  data: T[];
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
};
