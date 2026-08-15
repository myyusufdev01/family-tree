import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Nav from "@/components/nav";
import { AppProviders } from "@/components/providers";
import AuthButtons from "@/components/auth/auth-buttons";
import RequireAuth from "@/components/auth/require-auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Family Tree",
  description: "Aplikasi Silsilah Keluarga",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-background">
        <AppProviders>
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-14 items-center gap-4 px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                🌳 Family Tree
              </Link>
              <Nav />
              <AuthButtons />
            </div>
          </header>
          <main className="container mx-auto px-4 py-6">
            <RequireAuth>{children}</RequireAuth>
          </main>
        </AppProviders>
      </body>
    </html>
  );
}