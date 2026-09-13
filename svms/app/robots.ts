import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/employee/", "/admin/", "/student/"] },
    sitemap: new URL("/sitemap.xml", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString(),
  };
}
