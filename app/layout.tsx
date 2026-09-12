import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shared/providers";
import { APP_NAME, APP_THEME_COLOR, APP_TAGLINE, APP_DESCRIPTION, APP_URL } from "@/lib/constants/app";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sora",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  applicationName: APP_NAME,
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  keywords: [
    "study in europe",
    "study abroad europe",
    "european universities",
    "study in germany",
    "study in france",
    "study in italy",
    "student visa europe",
    "european university applications",
    "study abroad consultancy",
    "student application management",
    "student visa management system",
    "euroscope",
  ],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  publisher: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
  },
  formatDetection: { telephone: false },
  alternates: {
    canonical: APP_URL,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // allow zoom for accessibility; block only auto-zoom
  viewportFit: "cover", // iOS notch / home-indicator support
  themeColor: APP_THEME_COLOR,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pre-serialize the JSON-LD so we don't reconstruct it on every render
  // (avoids potential hydration mismatches from object key ordering).
  const orgJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: APP_NAME,
    url: APP_URL,
    description: APP_DESCRIPTION,
    slogan: APP_TAGLINE,
    knowsAbout: [
      "European university admissions",
      "Student visa preparation",
      "Study abroad Europe",
      "Application management",
      "Document management",
    ],
  });

  return (
    <html
      lang="en"
      className={`${inter.variable} ${sora.variable} h-full antialiased`}
      // suppressHydrationWarning — browser extensions (Bitdefender,
      // Grammarly, password managers) inject `bis_*`, `data-*`, `class`
      // attributes into <html> and <body> AFTER server render but BEFORE
      // React hydrates. This causes harmless but noisy hydration
      // mismatch warnings in dev. The attribute tells React to skip
      // attribute-diff checking on this element only (not children).
      // This is the official React-recommended workaround:
      // https://react.dev/reference/react-dom/components/common#suppressing-unavoidable-hydration-mismatch-warnings
      suppressHydrationWarning
    >
      <head>
        {/* Theme bootstrap — runs before paint to avoid FOUC. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('svms-theme');if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        {/* Structured data — Organization. Helps search engines
            understand that Euroscope is an educational organization.
            suppressHydrationWarning because some browser extensions
            (Bitdefender) replace JSON-LD scripts with their own. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: orgJsonLd }}
          suppressHydrationWarning
        />
      </head>
      {/* suppressHydrationWarning on body — same reason as html.
          Extensions add bis_register, __processed_* attributes here. */}
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
