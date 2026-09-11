import { describe, it, expect } from "vitest";
import {
  STAGE_DESCRIPTIONS,
  NEXT_STAGE_DESCRIPTIONS,
  getStageDescription,
  getNextStageDescription,
  titleCaseStage,
  CANONICAL_PIPELINE,
} from "@/lib/utils/application-pipeline";

describe("STAGE_DESCRIPTIONS + NEXT_STAGE_DESCRIPTIONS", () => {
  it("covers every stage in the canonical pipeline", () => {
    for (const stage of CANONICAL_PIPELINE) {
      expect(STAGE_DESCRIPTIONS[stage.key]).toBeDefined();
      expect(NEXT_STAGE_DESCRIPTIONS[stage.key]).toBeDefined();
    }
  });

  it("has student-facing copy (no internal terms, no IDs, no employee names)", () => {
    for (const [key, text] of Object.entries(STAGE_DESCRIPTIONS)) {
      expect(text.length).toBeGreaterThan(10);
      // No raw stage keys in the description (e.g. no "VISA_DECISION")
      expect(text).not.toContain(key);
      // No internal terms
      expect(text.toLowerCase()).not.toContain("audit");
      expect(text.toLowerCase()).not.toContain("ip address");
      expect(text.toLowerCase()).not.toContain("objectid");
      // No angle-bracketed placeholders
      expect(text).not.toContain("<");
      expect(text).not.toContain(">");
    }
  });

  it("has next-step copy written from the student's perspective", () => {
    for (const [key, text] of Object.entries(NEXT_STAGE_DESCRIPTIONS)) {
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain(key);
      // The next-step copy should give actionable / informative text,
      // not internal process detail.
      expect(text.toLowerCase()).not.toContain("audit");
      expect(text.toLowerCase()).not.toContain("changedbyid");
    }
  });

  it("COMPLETED's next-step copy acknowledges the journey is over", () => {
    expect(NEXT_STAGE_DESCRIPTIONS.COMPLETED.toLowerCase()).toContain("complete");
  });
});

describe("getStageDescription", () => {
  it("returns the canonical description for known stage keys", () => {
    expect(getStageDescription("LEAD")).toBe(STAGE_DESCRIPTIONS.LEAD);
    expect(getStageDescription("VISA_DECISION")).toBe(STAGE_DESCRIPTIONS.VISA_DECISION);
    expect(getStageDescription("COMPLETED")).toBe(STAGE_DESCRIPTIONS.COMPLETED);
  });

  it("falls back to titleCaseStage for unknown keys (no internal fallback leak)", () => {
    expect(getStageDescription("UNKNOWN_STAGE")).toBe("Unknown Stage");
  });

  it("returns a fallback string for null/undefined (no crash, no leak)", () => {
    expect(getStageDescription(null)).toBe("Stage details unavailable.");
    expect(getStageDescription(undefined)).toBe("Stage details unavailable.");
    expect(getStageDescription("")).toBe("Stage details unavailable.");
  });
});

describe("getNextStageDescription", () => {
  it("returns the canonical next-step copy for known stage keys", () => {
    expect(getNextStageDescription("LEAD")).toBe(NEXT_STAGE_DESCRIPTIONS.LEAD);
    expect(getNextStageDescription("VISA_PREPARATION")).toBe(
      NEXT_STAGE_DESCRIPTIONS.VISA_PREPARATION,
    );
    expect(getNextStageDescription("COMPLETED")).toBe(NEXT_STAGE_DESCRIPTIONS.COMPLETED);
  });

  it("falls back to a generic copy for unknown keys (no leak)", () => {
    expect(getNextStageDescription("UNKNOWN_STAGE")).toBe(
      "We're moving your application forward.",
    );
  });

  it("returns a fallback string for null/undefined", () => {
    expect(getNextStageDescription(null)).toBe("Your application is being processed.");
    expect(getNextStageDescription(undefined)).toBe("Your application is being processed.");
    expect(getNextStageDescription("")).toBe("Your application is being processed.");
  });
});

describe("titleCaseStage integration with descriptions", () => {
  it("the fallback for unknown stages uses titleCaseStage (consistent copy)", () => {
    expect(getStageDescription("RANDOM_KEY")).toBe(titleCaseStage("RANDOM_KEY"));
    expect(getStageDescription("VISA_DECISION_NEW")).toBe("Visa Decision New");
  });
});
