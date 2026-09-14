import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/constants/app";

export default function sitemap(): MetadataRoute.Sitemap {
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

  return staticRoutes.map((path) => ({
    url: `${APP_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1.0 : path === "/contact" ? 0.9 : 0.7,
  }));
}
