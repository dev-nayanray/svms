# Performance Documentation

## Dashboard Performance

The admin dashboard API is the most queried endpoint. It has been optimized to minimize database round-trips:

### Query Strategy
- **25 Prisma queries** executed in **2 `Promise.all` batches**
- Only **2 database round-trips** (all queries in each batch run in parallel)
- All queries use indexed fields for filtering
- All `findMany` queries have `take` limits (6-8 records for recent items)

### KPI Aggregations
- Uses `prisma.model.count()` and `prisma.model.aggregate()` — never `findMany().length`
- Date-range filtering applied server-side via `resolveRange()`
- No client-side data processing

### Chart Data
- `groupBy` aggregations for charts (byCountry, byStage, byIntake)
- Monthly aggregations computed server-side
- Employee performance uses server-side grouping

## Table Performance

### Server-Side Pagination
- Default page size: 20 records
- Maximum page size: 50 records (enforced server-side)
- No client-side pagination of large datasets

### Server-Side Search
- Search queries use Prisma `contains` with `mode: "insensitive"`
- Debounced on the client (250ms) to avoid per-keystroke requests
- TanStack Query `staleTime` prevents duplicate requests

### Server-Side Sorting
- Sort fields validated against an allow-list (`sortFrom()`)
- No arbitrary database field sorting — prevents injection

### Server-Side Filtering
- Filter values validated via Zod schemas
- Only allow-listed filter keys accepted

## Caching Strategy

### Client-Side (TanStack Query)
- Dashboard data: `placeholderData: keepPreviousData` — no flash on refetch
- List data: `staleTime: 15-30s` — prevents excessive refetching
- Metadata (countries, employees): `staleTime: 5min` — rarely changes
- Brand settings: `staleTime: 5min` — rarely changes

### Server-Side
- No server-side caching implemented (data is always fresh)
- For future: consider Redis for dashboard statistics with 30s TTL

## Bundle Optimization

- Route groups (`admin`, `employee`, `student`) are separate — no cross-panel bloat
- Client components used only where interaction requires them
- Server Components for data-heavy pages (no client JS for rendering)
- Dynamic imports for heavy components (charts, rich text editors)
- `poweredByHeader: false` — no server fingerprinting

## Database Indexes

80 indexes across the schema covering:
- All foreign keys (studentId, employeeId, countryId, etc.)
- Status fields (for filtered queries)
- Date fields (for date-range queries)
- Composite indexes on common query patterns
- Unique constraints on business identifiers

## Optimization Principles

1. **Never load entire collections** — always paginate
2. **Never trust client totals** — calculate server-side
3. **Never expose Prisma errors** — production-safe messages only
4. **Never allow arbitrary sorting** — use allow-lists
5. **Parallelize independent queries** — use `Promise.all`
6. **Use `count`/`aggregate`** — not `findMany().length`
7. **Use `select`** — don't over-fetch relations
8. **Debounce search** — 250ms client-side debounce
