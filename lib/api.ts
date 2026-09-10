import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PermissionError } from "@/lib/permissions";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(
  code: ApiErrorCode,
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...extra } },
    { status }
  );
}

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return fail("VALIDATION_ERROR", "Invalid request", 422, { fields });
  }
  if (err instanceof PermissionError) {
    return fail("FORBIDDEN", err.message, 403);
  }
  if (err instanceof HttpError) {
    return fail(err.code, err.message, err.status);
  }
  // Log the full error server-side for debugging, but never expose
  // stack traces or internal details to the client in production.
  if (process.env.NODE_ENV !== "production") {
    console.error("[api]", err);
  }
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err instanceof Error
        ? err.message
        : "Unknown error";
  return fail("INTERNAL_ERROR", message, 500);
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") =>
  new HttpError(404, "NOT_FOUND", `${what} not found`);

/** Build a Prisma orderBy from ?sortBy=&sortOrder= against an allow-list of columns. */
export function sortFrom(
  sp: URLSearchParams,
  allowed: readonly string[],
  fallback: Record<string, string> = { createdAt: "desc" }
): Record<string, string> {
  const sortBy = sp.get("sortBy");
  const sortOrder = sp.get("sortOrder") === "asc" ? "asc" : "desc";
  if (sortBy && allowed.includes(sortBy)) return { [sortBy]: sortOrder };
  return fallback;
}
