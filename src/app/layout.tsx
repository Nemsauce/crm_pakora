import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { BackgroundBlobs } from "@/components/layout/BackgroundBlobs";

import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "CRM Pakora",
  description: "Command Center en construcción",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
    >
      <body className="relative flex min-h-full flex-col overflow-x-hidden bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          <BackgroundBlobs />
          <div className="relative z-10 flex min-h-full flex-col">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
