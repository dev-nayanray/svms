# Security Documentation

## Security Architecture Overview

Euroscope SVMS implements defense-in-depth security with multiple layers:

### Layer 1: Edge Proxy (proxy.ts)
- Fast role-based route gate at the edge
- Unauthenticated users redirected to `/login`
- Users kept inside their own role's prefix (`/admin`, `/employee`, `/student`)

### Layer 2: Layout Guards (RoleLayout)
- Server-side role verification in each layout
- `allowedRoles` check before any page renders
- Redirect to `/403` if role not allowed

### Layer 3: API Guards (guard())
- Permission-based access control on every API route
- `guard("permission.key")` checks role against PERMISSIONS map
- Returns 401 (unauthenticated) or 403 (forbidden) errors

### Layer 4: Service-Level Ownership
- Student APIs use `studentApiGuard()` — studentId from session, never from client
- IDOR protection: foreign record access returns 404 (not 403, to avoid confirming existence)
- Financial operations require admin/employee role

### Layer 5: Input Validation
- Zod schema validation on all API request bodies
- Query parameter validation with allow-lists
- Sort field allow-lists (no arbitrary database field sorting)
- Pagination limits (max 50 per page)

## Authentication

- **Provider**: NextAuth.js (Auth.js) with Credentials provider
- **Strategy**: JWT (8-hour session, forces re-validation)
- **Password hashing**: bcryptjs
- **Cookie security**: HttpOnly, SameSite=Lax, Secure in production
- **Brute-force protection**: Rate limiting on login (5 attempts, +1/min)

## File Security

- **Student documents**: Stored in private directory (NOT `/public/`)
- **Download**: Authenticated endpoint verifies ownership before serving
- **Upload validation**: MIME allow-list (PDF, JPEG, PNG, WebP), 10MB limit
- **Filename**: SHA-256 hash + timestamp (no user-supplied filenames on disk)
- **Rate limiting**: Upload and download endpoints rate-limited

## Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline'; ...` | Prevents XSS, data injection |
| X-Content-Type-Options | `nosniff` | Prevents MIME type sniffing |
| X-Frame-Options | `DENY` | Prevents clickjacking |
| Referrer-Policy | `strict-origin-when-cross-origin` | Controls referrer information |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | Disables unnecessary browser APIs |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS |

## Audit Logging

All critical actions are logged:
- User authentication (login, logout)
- User/employee creation, deletion, role changes
- Student creation, updates, archival
- Application stage changes
- Document approval/rejection
- Payment creation, refund
- Invoice issuance, cancellation
- Settings changes
- Visa status changes

**Audit logs are immutable** — they cannot be modified or deleted.

## Error Handling

- Production mode: Generic error messages, no stack traces
- Development mode: Detailed errors for debugging
- All errors logged server-side via `console.error`
- Client receives: `{ success: false, error: { code, message, fields } }`
