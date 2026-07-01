import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="es" className="dark h-full">
      <body className="flex min-h-full flex-col bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
