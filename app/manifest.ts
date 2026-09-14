import type { MetadataRoute } from "next";
import { APP_NAME, APP_SHORT_NAME, APP_THEME_COLOR, APP_BACKGROUND_COLOR } from "@/lib/constants/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description:
      "Euroscope — your complete journey to studying in Europe. Manage university applications, documents, visas and travel preparation in one place.",
    start_url: "/student",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en",
    dir: "ltr",
    background_color: APP_BACKGROUND_COLOR,
    theme_color: APP_THEME_COLOR,
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", short_name: "Home", url: "/student" },
      { name: "Messages", short_name: "Chat", url: "/student/messages" },
      { name: "Documents", short_name: "Docs", url: "/student/documents" },
      { name: "Tasks", short_name: "Tasks", url: "/student/tasks" },
    ],
  };
}
