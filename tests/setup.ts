/**
 * Vitest setup — mocks server-only modules so tests can import
 * server-side code without triggering the "client component" error.
 *
 * This file is referenced from vitest.config.ts (setupFiles).
 */

// `server-only` is a Next.js package that throws when imported from
// a client component. In tests, we just want it to be a no-op.
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
