import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Student data isolation guard (lib/student/guard)
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockFindFirst = vi.fn();
const redirect = vi.fn();

// The real next/navigation redirect() throws; mirror that so guards halt.
function mockRedirect(url: string): never {
  redirect(url);
  throw new Error(`REDIRECT:${url}`);
}

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (args: unknown) => mockFindFirst(args) },
  },
}));

import { studentApiGuard, requireStudentProfile } from "@/lib/student/guard";

const studentRecord = { id: "stu-1", userId: "user-1", firstName: "Karim", lastName: "Ahmed", deletedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("studentApiGuard (server-side data isolation)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const result = await studentApiGuard();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403 even when authenticated", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const result = await studentApiGuard();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(403);
  });

  it("derives the student profile from the session user — never from client input", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockFindFirst.mockResolvedValue(studentRecord);
    const result = await studentApiGuard();
    expect(result.ok).toBe(true);
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", deletedAt: null } })
    );
    // No client-supplied studentId is ever accepted by the guard.
    const call = JSON.stringify(mockFindFirst.mock.calls[0][0]);
    expect(call).not.toContain("studentId");
  });

  it("rejects STUDENT users without a linked profile", async () => {
    mockAuthResolved({ id: "user-9", role: "STUDENT" });
    mockFindFirst.mockResolvedValue(null);
    const result = await studentApiGuard();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(403);
  });
});

describe("requireStudentProfile (server components)", () => {
  it("redirects unauthenticated users to /login", async () => {
    mockAuthResolved({ id: null });
    await expect(requireStudentProfile()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects ADMIN and EMPLOYEE away from student pages", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    await expect(requireStudentProfile()).rejects.toThrow("REDIRECT:/403");
    mockAuthResolved({ id: "user-1", role: "EMPLOYEE" });
    await expect(requireStudentProfile()).rejects.toThrow("REDIRECT:/403");
  });

  it("returns the owning student profile for STUDENT users", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT", name: "Karim" });
    mockFindFirst.mockResolvedValue(studentRecord);
    const ctx = await requireStudentProfile();
    expect(ctx.student.id).toBe("stu-1");
    expect(ctx.userId).toBe("user-1");
    expect(redirect).not.toHaveBeenCalled();
  });
});

function mockAuthResolved(user: { id: string | null; role?: string; name?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

// ─────────────────────────────────────────────
// Role routing (proxy roleHome)
// ─────────────────────────────────────────────

import { roleHome } from "@/proxy";

describe("roleHome routing", () => {
  it("keeps each role inside its own panel prefix", () => {
    expect(roleHome("ADMIN")).toBe("/admin");
    expect(roleHome("EMPLOYEE")).toBe("/employee");
    expect(roleHome("STUDENT")).toBe("/student");
    expect(roleHome(undefined)).toBe("/student");
  });
});

// ─────────────────────────────────────────────
// Student navigation config
// ─────────────────────────────────────────────

import { STUDENT_TABS, STUDENT_MORE, isActivePath } from "@/config/student-nav";

describe("student navigation", () => {
  it("has the four primary tabs plus Home first", () => {
    expect(STUDENT_TABS.map((t) => t.label)).toEqual(["Home", "Application", "Documents", "Messages"]);
  });

  it("includes all More-section destinations", () => {
    const hrefs = STUDENT_MORE.map((m) => m.href);
    for (const required of [
      "/student/profile",
      "/student/universities",
      "/student/courses",
      "/student/visa",
      "/student/tasks",
      "/student/payments",
      "/student/invoices",
      "/student/appointments",
      "/student/notifications",
      "/student/support",
      "/student/settings",
    ]) {
      expect(hrefs).toContain(required);
    }
  });

  it("has unique hrefs across tabs and more", () => {
    const all = [...STUDENT_TABS, ...STUDENT_MORE].map((i) => i.href);
    expect(new Set(all).size).toBe(all.length);
  });

  it("marks active state correctly, including sub-paths", () => {
    expect(isActivePath("/student", "/student")).toBe(true);
    expect(isActivePath("/student/dashboard", "/student")).toBe(true);
    expect(isActivePath("/student/documents/123", "/student/documents")).toBe(true);
    expect(isActivePath("/student/documents", "/student/applications")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// PWA manifest + install detection
// ─────────────────────────────────────────────

import manifest from "@/app/manifest";
import {
  shouldShowInstallCta,
  detectPlatform,
  isStandaloneMode,
  DISMISS_COOLDOWN_MS,
} from "@/lib/pwa/install";

describe("PWA manifest", () => {
  it("is standalone, student-scoped, and fully iconned", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/student");
    expect(m.theme_color).toMatch(/^#/);
    expect(m.icons?.length).toBeGreaterThanOrEqual(3);
    const maskable = m.icons?.find((i) => "purpose" in i && i.purpose === "maskable");
    expect(maskable).toBeDefined();
  });
});

describe("install detection", () => {
  it("never shows the CTA in standalone mode (already installed)", () => {
    expect(
      shouldShowInstallCta({ standalone: true, dismissedAtMs: null, nowMs: 0, canInstallOrIsIos: true })
    ).toBe(false);
  });

  it("honors the dismissal cooldown", () => {
    const nowMs = 10_000_000_000;
    expect(
      shouldShowInstallCta({
        standalone: false,
        dismissedAtMs: nowMs - 1000,
        nowMs,
        canInstallOrIsIos: true,
      })
    ).toBe(false);
    expect(
      shouldShowInstallCta({
        standalone: false,
        dismissedAtMs: nowMs - DISMISS_COOLDOWN_MS - 1,
        nowMs,
        canInstallOrIsIos: true,
      })
    ).toBe(true);
  });

  it("does not show the CTA when installation is unsupported", () => {
    expect(
      shouldShowInstallCta({ standalone: false, dismissedAtMs: null, nowMs: 0, canInstallOrIsIos: false })
    ).toBe(false);
  });

  it("detects iOS Safari vs Android Chrome vs other", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1")).toBe("ios-safari");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe("android-chrome");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0) Firefox/121.0")).toBe("other");
  });

  it("treats iOS navigator.standalone as installed", () => {
    expect(isStandaloneMode(false, true)).toBe(true);
    expect(isStandaloneMode(true, undefined)).toBe(true);
    expect(isStandaloneMode(false, false)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Service worker offline-safety contract
// ─────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("service worker security contract", () => {
  const sw = readFileSync(resolve(__dirname, "../public/sw.js"), "utf8");

  it("never intercepts API or auth traffic", () => {
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain('url.pathname.startsWith("/login")');
  });

  it("only caches GET requests", () => {
    expect(sw).toContain('request.method !== "GET"');
  });

  it("serves an offline fallback page for navigations", () => {
    expect(sw).toContain('"/offline"');
  });
});
