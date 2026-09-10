import { describe, it, expect } from "vitest";
import { sortFrom } from "@/lib/api";

const sp = (params: Record<string, string>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) u.set(k, v);
  return u;
};

describe("sortFrom (list API sorting allow-list)", () => {
  it("maps allowed sortBy + asc order", () => {
    expect(sortFrom(sp({ sortBy: "name", sortOrder: "asc" }), ["name", "createdAt"])).toEqual({
      name: "asc",
    });
  });

  it("defaults sortOrder to desc when invalid", () => {
    expect(sortFrom(sp({ sortBy: "name", sortOrder: "sideways" }), ["name"])).toEqual({
      name: "desc",
    });
  });

  it("rejects columns outside the allow-list", () => {
    expect(sortFrom(sp({ sortBy: "passwordHash" }), ["name", "createdAt"])).toEqual({
      createdAt: "desc",
    });
  });

  it("returns the fallback when no sort is requested", () => {
    expect(sortFrom(sp({}), ["name"], { name: "asc" })).toEqual({ name: "asc" });
    expect(sortFrom(sp({}), ["name"])).toEqual({ createdAt: "desc" });
  });
});
