import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

import { AuthGuard } from "@/components/layout/AuthGuard";
import { MainLayout } from "@/components/layout/MainLayout";
import { DictionaryPopup } from "@/components/ui/DictionaryPopup";

export const metadata: Metadata = {
  title: "EnglishTracker – Nền Tảng Học Tiếng Anh",
  description: "Hệ thống theo dõi và luyện tập tiếng Anh thông minh",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} ${outfit.variable} dark antialiased`}>
      <body className="min-h-screen bg-background text-foreground font-sans flex relative overflow-x-hidden">
        {/* Background Dot Pattern */}
        <div className="fixed inset-0 z-[-1] bg-dot-pattern pointer-events-none opacity-50" />
        {/* Ambient Gradient glow */}
        <div className="fixed inset-0 z-[-1] pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

        <AuthGuard>
          <MainLayout>
            {children}
          </MainLayout>
          <DictionaryPopup />
        </AuthGuard>
      </body>
    </html>
  );
}
