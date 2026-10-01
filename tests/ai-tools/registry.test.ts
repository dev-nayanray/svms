import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStudentFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (...a: unknown[]) => mockStudentFindFirst(...a) },
  },
}));

import { ToolRegistry } from "@/lib/ai/tools/registry";
import { _resetToolRateLimitForTests } from "@/lib/ai/tools/rate-limit";
import { getStudentProfile } from "@/lib/ai/tools/student-profile";
import type { AiTool, ToolResult } from "@/lib/ai/tools/types";
import { makeStudentCtx, fixtureStudent, asOkData } from "./_helpers";

// ── A simple test tool for registry-level tests ──────────────────

function makeTestTool(overrides: Partial<AiTool> = {}): AiTool {
  return {
    name: "testTool",
    description: "A test tool",
    parameters: z.object({}).strict(),
    async execute(_args, _ctx): Promise<ToolResult> {
      return { ok: true, data: { hello: "world" } };
    },
    ...overrides,
  };
}

import { z } from "zod";

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetToolRateLimitForTests();
    registry = new ToolRegistry();
  });

  // ── Registration ───────────────────────────────────────────────

  it("registers and lists tools", () => {
    const tool = makeTestTool();
    registry.register(tool);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0].name).toBe("testTool");
  });

  it("throws when registering a duplicate tool name", () => {
    const tool = makeTestTool();
    registry.register(tool);
    expect(() => registry.register(tool)).toThrow("already registered");
  });

  // ── studentId stripping (CRITICAL SECURITY) ────────────────────

  it("STRIPS studentId from LLM-provided args before calling the tool", async () => {
    let capturedArgs: unknown = null;
    const tool: AiTool = {
      name: "testStrip",
      description: "test",
      // Schema allows any object — but registry should still strip studentId
      parameters: z.object({ studentId: z.string().optional(), foo: z.string().optional() }),
      async execute(args, _ctx) {
        capturedArgs = args;
        return { ok: true, data: {} };
      },
    };
    registry.register(tool);

    // The LLM tries to inject a different studentId
    await registry.dispatch(
      "testStrip",
      { studentId: "stu-hijacked", foo: "bar" },
      makeStudentCtx({ studentId: "stu-real" }),
    );

    // The tool must NOT see the injected studentId
    expect(capturedArgs).toEqual({ foo: "bar" });
    expect(capturedArgs).not.toHaveProperty("studentId");
  });

  it("strips userId, role, requestId, ctx, context from args", async () => {
    let capturedArgs: unknown = null;
    const tool: AiTool = {
      name: "testStrip2",
      description: "test",
      parameters: z.object({}).passthrough(),
      async execute(args, _ctx) {
        capturedArgs = args;
        return { ok: true, data: {} };
      },
    };
    registry.register(tool);

    await registry.dispatch(
      "testStrip2",
      { userId: "hijack", role: "ADMIN", requestId: "fake", ctx: {}, context: {}, legit: "yes" },
      makeStudentCtx(),
    );

    expect(capturedArgs).toEqual({ legit: "yes" });
  });

  // ── Unknown tool ───────────────────────────────────────────────

  it("returns NOT_FOUND for an unknown tool name", async () => {
    const result = await registry.dispatch("nonexistentTool", {}, makeStudentCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain("Unknown tool");
  });

  // ── Input validation ───────────────────────────────────────────

  it("returns VALIDATION error when args don't match the schema", async () => {
    const tool: AiTool = {
      name: "testValidation",
      description: "test",
      parameters: z.object({ count: z.number() }),
      async execute() {
        return { ok: true, data: {} };
      },
    };
    registry.register(tool);

    // Wrong type — string instead of number
    const result = await registry.dispatch(
      "testValidation",
      { count: "not a number" },
      makeStudentCtx(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(result.error.message).toContain("count");
  });

  it("rejects extra args when schema uses .strict()", async () => {
    const tool: AiTool = {
      name: "testStrict",
      description: "test",
      parameters: z.object({}).strict(),
      async execute() {
        return { ok: true, data: {} };
      },
    };
    registry.register(tool);

    const result = await registry.dispatch(
      "testStrict",
      { unexpected: "field" },
      makeStudentCtx(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
  });

  // ── Timeout enforcement ────────────────────────────────────────

  it("returns TIMEOUT when a tool exceeds the timeout", async () => {
    const tool: AiTool = {
      name: "testTimeout",
      description: "test",
      parameters: z.object({}).strict(),
      async execute() {
        // Simulate a slow tool
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return { ok: true, data: {} };
      },
    };
    registry.register(tool);

    const result = await registry.dispatch(
      "testTimeout",
      {},
      makeStudentCtx({ timeoutMs: 100 }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("TIMEOUT");
    expect(result.error.retryable).toBe(true);
  });

  // ── Error wrapping ─────────────────────────────────────────────

  it("wraps thrown errors in INTERNAL", async () => {
    const tool: AiTool = {
      name: "testError",
      description: "test",
      parameters: z.object({}).strict(),
      async execute() {
        throw new Error("Something broke");
      },
    };
    registry.register(tool);

    const result = await registry.dispatch("testError", {}, makeStudentCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
    // Error message must NOT include the raw exception text (security)
    expect(result.error.message).toContain("testError");
    expect(result.error.message).not.toContain("Something broke");
  });

  it("passes through tool-returned errors without wrapping", async () => {
    const tool: AiTool = {
      name: "testReturnedError",
      description: "test",
      parameters: z.object({}).strict(),
      async execute() {
        return {
          ok: false,
          error: { code: "NOT_FOUND", message: "Custom not found", retryable: false },
        };
      },
    };
    registry.register(tool);

    const result = await registry.dispatch("testReturnedError", {}, makeStudentCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toBe("Custom not found");
  });

  // ── Result sanitization ────────────────────────────────────────

  it("strips forbidden fields (passwordHash, _id, etc.) from tool results", async () => {
    const tool: AiTool = {
      name: "testSanitize",
      description: "test",
      parameters: z.object({}).strict(),
      async execute() {
        return {
          ok: true,
          data: {
            name: "Karim",
            passwordHash: "$2a$10$secret",
            _id: "internal-id",
            userId: "internal-user-id",
            passportNumber: "BP1234567",
            deletedAt: null,
            certificateUrl: "https://example.com/cert.pdf",
          },
        };
      },
    };
    registry.register(tool);

    const result = await registry.dispatch("testSanitize", {}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).name).toBe("Karim"); // safe field kept
    expect(asOkData(result).passwordHash).toBeUndefined(); // stripped
    expect(asOkData(result)._id).toBeUndefined();
    expect(asOkData(result).userId).toBeUndefined();
    expect(asOkData(result).passportNumber).toBeUndefined();
    expect(asOkData(result).deletedAt).toBeUndefined();
    expect(asOkData(result).certificateUrl).toBeUndefined();
  });

  // ── Rate limiting ──────────────────────────────────────────────

  it("rate-limits excessive tool calls from the same student", async () => {
    const tool: AiTool = {
      name: "testRateLimit",
      description: "test",
      parameters: z.object({}).strict(),
      async execute() {
        return { ok: true, data: { n: Math.random() } };
      },
    };
    registry.register(tool);

    const ctx = makeStudentCtx();
    const results: ToolResult[] = [];

    // Call the tool 35 times rapidly (default capacity is 30/min)
    for (let i = 0; i < 35; i++) {
      results.push(await registry.dispatch("testRateLimit", {}, ctx));
    }

    const successCount = results.filter((r) => r.ok).length;
    const rateLimitedCount = results.filter((r) => !r.ok && r.error.code === "TIMEOUT").length;

    expect(successCount).toBe(30); // first 30 succeed
    expect(rateLimitedCount).toBe(5); // remaining 5 are rate-limited
  });

  it("does NOT rate-limit a different student", async () => {
    const tool: AiTool = {
      name: "testRateLimit2",
      description: "test",
      parameters: z.object({}).strict(),
      async execute() {
        return { ok: true, data: {} };
      },
    };
    registry.register(tool);

    // Student A exhausts their budget
    const ctxA = makeStudentCtx({ studentId: "stu-A" });
    for (let i = 0; i < 30; i++) {
      await registry.dispatch("testRateLimit2", {}, ctxA);
    }

    // Student B should still be able to call the tool
    const ctxB = makeStudentCtx({ studentId: "stu-B" });
    const result = await registry.dispatch("testRateLimit2", {}, ctxB);

    expect(result.ok).toBe(true);
  });

  // ── Integration with a real tool ───────────────────────────────

  it("correctly dispatches getStudentProfile end-to-end", async () => {
    registry.register(getStudentProfile);
    mockStudentFindFirst.mockResolvedValue({
      ...fixtureStudent,
      user: { email: "k@x.com", name: "Karim" },
      employee: null,
      branch: null,
    });

    const result = await registry.dispatch("getStudentProfile", {}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).firstName).toBe("Karim");
    // Verify the query used ctx.studentId
    expect(mockStudentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "stu-001" }),
      }),
    );
  });
});
