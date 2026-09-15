import { describe, it, expect } from "vitest";
import { buildRobotsTxt } from "@/lib/system/seo";

describe("SEO robots.txt builder", () => {
  describe("buildRobotsTxt", () => {
    it("always blocks /admin and /admin/*", () => {
      const out = buildRobotsTxt("https://example.com", false);
      expect(out).toContain("Disallow: /admin");
      expect(out).toContain("Disallow: /admin/*");
    });

    it("always blocks /employee and /employee/*", () => {
      const out = buildRobotsTxt("https://example.com", false);
      expect(out).toContain("Disallow: /employee");
      expect(out).toContain("Disallow: /employee/*");
    });

    it("always blocks /student and /student/*", () => {
      const out = buildRobotsTxt("https://example.com", false);
      expect(out).toContain("Disallow: /student");
      expect(out).toContain("Disallow: /student/*");
    });

    it("always blocks /api and /api/*", () => {
      const out = buildRobotsTxt("https://example.com", false);
      expect(out).toContain("Disallow: /api");
      expect(out).toContain("Disallow: /api/*");
    });

    it("blocks /login and /register when indexPrivateRoutes is false (default)", () => {
      const out = buildRobotsTxt("https://example.com", false);
      expect(out).toContain("Disallow: /login");
      expect(out).toContain("Disallow: /register");
    });

    it("does NOT block /login and /register when indexPrivateRoutes is true", () => {
      const out = buildRobotsTxt("https://example.com", true);
      expect(out).not.toContain("Disallow: /login");
      expect(out).not.toContain("Disallow: /register");
    });

    it("includes the sitemap URL", () => {
      const out = buildRobotsTxt("https://example.com", false);
      expect(out).toContain("Sitemap: https://example.com/sitemap.xml");
    });

    it("includes the host directive without scheme", () => {
      const out = buildRobotsTxt("https://example.com", false);
      expect(out).toContain("Host: example.com");
    });

    it("allows the root path", () => {
      const out = buildRobotsTxt("https://example.com", false);
      expect(out).toContain("Allow: /");
    });

    it("uses wildcard user-agent", () => {
      const out = buildRobotsTxt("https://example.com", false);
      expect(out).toContain("User-agent: *");
    });
  });
});
