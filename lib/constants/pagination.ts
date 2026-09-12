/**
 * Pagination + list-size constants shared by student-facing services.
 *
 * Why these exist
 * ===============
 * The student list endpoints (invoices, payments, messages,
 * appointments, etc.) historically returned ALL rows for a student
 * with no `take` cap. For a long-tenured student this can grow into
 * hundreds of rows per endpoint, blowing up response payloads and
 * peak memory use on every page view.
 *
 * The front-end renders these as infinite-scroll or "show more" lists
 * and gracefully handles arrays of any length, so capping the server
 * response at a generous ceiling (200 rows) is a safe defense against
 * payload blow-up. The pagination cursor pattern is intentionally NOT
 * implemented here — the front-end's existing UX doesn't drive a
 * cursor, and adding one would be a larger refactor than the security
 * benefit warrants at this stage. The cap is the minimal safe fix.
 *
 * If a future student ever exceeds 200 records in one of these
 * categories, the front-end will simply show the 200 most recent and
 * they can filter by status/date to see older rows.
 */
export const STUDENT_LIST_MAX_ROWS = 200;
