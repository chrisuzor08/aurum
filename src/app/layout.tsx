import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ClientProviders } from "@/components/common/Providers";
import { getCurrentUser } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: { default: "AURUM — Luxury Music Streaming", template: "%s · AURUM" },
  description: "AURUM is a luxury music streaming platform: stream, watch, discover and own your sound.",
  manifest: undefined,
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const ent = getEntitlements(user);
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@500;600;700&display=swap"
        />
      </head>
      <body className="bg-background font-sans text-white antialiased selection:bg-gold/30 selection:text-white">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-black">
          Skip to content
        </a>
        <ClientProviders isPremium={ent.isPremium} skipLimitPerHour={ent.skipLimitPerHour}>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
