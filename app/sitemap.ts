import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/constants/app";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = [
    "",
    "/study-in-europe",
    "/universities",
    "/courses",
    "/features",
    "/how-it-works",
    "/about",
    "/resources",
    "/contact",
    "/login",
    "/register",
  ];

  const staticEntries = staticRoutes.map((path) => ({
    url: `${APP_URL}${path}`,
    lastModified: now,
    changeFrequency: (path === "" ? "daily" : "weekly") as "daily" | "weekly",
    priority: path === "" ? 1.0 : path === "/contact" ? 0.9 : 0.7,
  }));

  // Dynamic university pages
  let universityEntries: MetadataRoute.Sitemap = [];
  try {
    const universities = await prisma.university.findMany({
      where: { deletedAt: null },
      select: { slug: true, updatedAt: true },
    });
    universityEntries = universities.map((u) => ({
      url: `${APP_URL}/universities/${u.slug}`,
      lastModified: u.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB not available — skip dynamic entries
  }

  return [...staticEntries, ...universityEntries];
}
