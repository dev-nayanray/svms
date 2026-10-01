import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/constants/app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/home",
    "/study-in-europe",
    "/universities",
    "/courses",
    "/features",
    "/how-it-works",
    "/about",
    "/resources",
    "/contact",
    "/login",
  ];

  return routes.map((route) => ({
    url: `${APP_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/home" ? "weekly" : "monthly",
    priority: route === "/home" ? 1 : route === "/contact" ? 0.9 : 0.7,
  }));
}
