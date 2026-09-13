import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider } from "@/components/shared/session-provider";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants/app";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: `${APP_NAME} — Study in Europe. Start Your Future.`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [
    "study in Europe",
    "European universities",
    "study abroad Europe",
    "study in Germany",
    "study in France",
    "study in Italy",
    "student visa Europe",
    "European university applications",
    "study abroad consultancy",
    "student visa management system",
  ],
  authors: [{ name: APP_NAME }],
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — Study in Europe. Start Your Future.`,
    description: APP_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Study in Europe. Start Your Future.`,
    description: APP_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
