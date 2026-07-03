import type { Metadata, Viewport } from "next";
import { themeInitializationScript } from "@/lib/theme";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "CodeShift AI — Review-first code migrations",
    template: "%s · CodeShift AI",
  },
  description:
    "Analyze legacy JavaScript repositories and ship controlled, reviewable TypeScript migrations.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#080B10" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
