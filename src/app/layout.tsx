import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Quicksand } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Control Centre",
  description: "Personal Control Centre",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Control Centre",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${quicksand.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col">
        <Script id="display-mode-class" strategy="beforeInteractive">
          {`(() => {
            const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
            const ua = window.navigator.userAgent;
            const safari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Vivaldi/.test(ua);
            if (standalone) document.documentElement.classList.add('pwa-standalone');
            if (standalone && safari) document.documentElement.classList.add('safari-standalone');
          })();`}
        </Script>
        <AuthProvider>{children}</AuthProvider>
        <Script id="sw-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
          }`}
        </Script>
      </body>
    </html>
  );
}
