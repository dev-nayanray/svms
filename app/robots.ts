import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/constants/app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Disallow authenticated panels — they're behind login and
        // contain private student data.
        disallow: ["/admin", "/employee", "/student", "/api"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
