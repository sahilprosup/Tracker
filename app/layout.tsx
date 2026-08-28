import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProLine ITP Tracker",
  description: "Site ITP photo tracker, Visibuild sync and Slack reporting for ProLine",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ITP Tracker",
  },
};

export const viewport: Viewport = {
  themeColor: "#ec3013",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
