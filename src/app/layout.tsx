import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://studyflow.studio"),
  title: "StudyFlow - 学習管理アプリ",
  description:
    "教科ごとの学習時間を計測し、美しいグラフで可視化する学習管理ダッシュボード",
  alternates: {
    canonical: "https://studyflow.studio",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StudyFlow",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const analyticsEnabled = process.env.NEXT_PUBLIC_SIMPLE_ANALYTICS_ENABLED === "true";
  const analyticsDomain = process.env.NEXT_PUBLIC_SIMPLE_ANALYTICS_DOMAIN || "studyflow.studio";
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Google Analytics */}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}

        {/* Simple Analytics */}
        {analyticsEnabled && (
          <Script
            src="https://scripts.simpleanalyticscdn.com/latest.js"
            strategy="afterInteractive"
            data-collect-dnt="true"
            {...(analyticsDomain ? { "data-hostname": analyticsDomain } : {})}
          />
        )}

        <AppShell>{children}</AppShell>
        
        {/* Vercel Analytics */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
