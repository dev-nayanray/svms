import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/constants/app";
import { getSeoConfig } from "@/lib/system/config";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seoConfig = await getSeoConfig().catch(() => null);
  const canonicalBase = seoConfig?.canonicalBase ?? APP_URL;
  const indexPrivateRoutes = seoConfig?.indexPrivateRoutes ?? false;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Always block authenticated panels — they're behind login and
        // contain private student data.
        disallow: [
          "/admin",
          "/admin/*",
          "/employee",
          "/employee/*",
          "/student",
          "/student/*",
          "/api",
          "/api/*",
          // Only block /login and /register if the admin has not opted
          // into indexing them (default: blocked).
          ...(indexPrivateRoutes ? [] : ["/login", "/register"]),
        ],
      },
    ],
    sitemap: `${canonicalBase}/sitemap.xml`,
    host: canonicalBase,
  };
}
