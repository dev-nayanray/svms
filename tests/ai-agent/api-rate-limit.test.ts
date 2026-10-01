import { describe, it, expect, beforeEach } from "vitest";
import {
  checkApiRateLimit,
  _resetApiRateLimitForTests,
} from "@/lib/ai/api-rate-limit";

describe("AI API Rate Limiter", () => {
  beforeEach(() => {
    _resetApiRateLimitForTests();
  });

  it("allows the first 5 messages in a minute (burst limit)", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkApiRateLimit("stu-1");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks the 6th message in the same minute", () => {
    for (let i = 0; i < 5; i++) {
      checkApiRateLimit("stu-1");
    }
    const result = checkApiRateLimit("stu-1");
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("does NOT rate-limit a different student", () => {
    // stu-1 exhausts their burst budget
    for (let i = 0; i < 5; i++) {
      checkApiRateLimit("stu-1");
    }
    // stu-2 should still be allowed
    const result = checkApiRateLimit("stu-2");
    expect(result.allowed).toBe(true);
  });

  it("returns a retry-after hint when rate limited", () => {
    for (let i = 0; i < 5; i++) {
      checkApiRateLimit("stu-1");
    }
    const result = checkApiRateLimit("stu-1");
    if (result.allowed) throw new Error("Should be rate limited");
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
  });
});
