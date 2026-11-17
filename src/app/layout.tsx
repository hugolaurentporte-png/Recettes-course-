import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/Toast";
import { ServiceWorker } from "@/components/ServiceWorker";
import { StorageBanner } from "@/components/StorageBanner";

export const metadata: Metadata = {
  title: "Qu'est-ce qu'on mange ?",
  description: "Recettes avec ce que vous avez chez vous, et une liste de courses toujours sous la main.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "On mange quoi", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#237a35",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <StoreProvider>
          <ToastProvider>
            <StorageBanner />
            <main className="pb-nav mx-auto min-h-screen max-w-xl">{children}</main>
            <BottomNav />
          </ToastProvider>
        </StoreProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
