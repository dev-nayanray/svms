import { NextResponse } from "next/server";
import { ZodError } from "zod";

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
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...extra } },
    { status },
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
  if (err instanceof HttpError) {
    return fail(err.code, err.message, err.status);
  }
  // Log the full error server-side (always — not gated on NODE_ENV so
  // production deployments can still see errors in their logs).
  console.error("[api]", err);
  // Decide whether to expose the detailed message to the client.
  // Gate on an explicit DEBUG_API_ERRORS env var (NOT NODE_ENV) so a
  // misconfigured staging environment where NODE_ENV is unset doesn't
  // accidentally leak Prisma internals (table names, column names,
  // query fragments) to the response body.
  const exposeDetail = process.env.DEBUG_API_ERRORS === "true";
  const message = exposeDetail
    ? err instanceof Error
      ? err.message
      : "Unknown error"
    : "An unexpected error occurred";
  return fail("INTERNAL_ERROR", message, 500);
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") =>
  new HttpError(404, "NOT_FOUND", `${what} not found`);
