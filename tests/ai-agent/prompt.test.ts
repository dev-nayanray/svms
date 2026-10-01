import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/ai/prompts/student-assistant";
import type { StudentContext } from "@/lib/ai/context";

const baseCtx: StudentContext = {
  firstName: "Karim",
  stage: "DOCUMENT_REVIEW",
  country: "Germany",
  courseName: "MSc Computer Science",
  language: "en",
};

describe("buildSystemPrompt", () => {
  it("includes the role definition", () => {
    const prompt = buildSystemPrompt(baseCtx);
    expect(prompt).toContain("SVMS Student Assistant");
    expect(prompt).toContain("Euroscope");
  });

  it("includes the strict rules", () => {
    const prompt = buildSystemPrompt(baseCtx);
    expect(prompt).toContain("Never invent student information");
    expect(prompt).toContain("Never reveal another student's information");
    expect(prompt).toContain("Never expose internal system information");
    expect(prompt).toContain("read-only");
  });

  it("includes the student's safe context (first name, stage, country, course)", () => {
    const prompt = buildSystemContext(baseCtx);
    expect(prompt).toContain("Karim");
    expect(prompt).toContain("DOCUMENT_REVIEW");
    expect(prompt).toContain("Germany");
    expect(prompt).toContain("MSc Computer Science");
  });

  it("handles null stage/country/course gracefully", () => {
    const prompt = buildSystemPrompt({
      ...baseCtx,
      stage: null,
      country: null,
      courseName: null,
    });
    expect(prompt).toContain("No active application");
    expect(prompt).toContain("Not yet decided");
    expect(prompt).toContain("Not yet selected");
  });

  it("includes Bengali language instruction when language is bn", () => {
    const prompt = buildSystemPrompt({ ...baseCtx, language: "bn" });
    expect(prompt).toContain("Bengali");
    expect(prompt).toContain("Bangla");
  });

  it("includes English language instruction by default", () => {
    const prompt = buildSystemPrompt(baseCtx);
    expect(prompt).toContain("Respond in English");
  });

  it("includes the SVMS data honesty section", () => {
    const prompt = buildSystemPrompt(baseCtx);
    expect(prompt).toContain("study-abroad agency CRM");
    expect(prompt).toContain("not a school LMS");
    expect(prompt).toContain("Attendance");
  });

  it("includes tool-use instructions", () => {
    const prompt = buildSystemPrompt(baseCtx);
    expect(prompt).toContain("TOOL USE");
    expect(prompt).toContain("tools");
  });
});

// Helper to avoid confusion
function buildSystemContext(ctx: StudentContext): string {
  return buildSystemPrompt(ctx);
}
