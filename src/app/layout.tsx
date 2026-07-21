import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { BackgroundBlobs } from "@/components/layout/BackgroundBlobs";

import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "CRM Pakora",
  description:
    "Torre de control COD de Pakora para gestionar pedidos, tareas, finanzas, métricas e investigación de productos en Colombia y México.",
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
