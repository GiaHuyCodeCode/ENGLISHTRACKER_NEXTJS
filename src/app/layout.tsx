import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

import { AuthGuard } from "@/components/layout/AuthGuard";
import { MainLayout } from "@/components/layout/MainLayout";
import { DictionaryPopup } from "@/components/ui/DictionaryPopup";

export const metadata: Metadata = {
  title: "EnglishTracker – Nền Tảng Học Tiếng Anh",
  description: "Hệ thống theo dõi và luyện tập tiếng Anh thông minh",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${jakarta.variable} dark antialiased`}>
      <body className="min-h-screen bg-background text-foreground font-sans flex relative overflow-x-hidden">

        {/* Subtle noise texture — very low opacity, no blur */}
        <div className="botanical-noise" aria-hidden="true" />

        {/* Petal glow — top right corner only */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "50vw",
            height: "50vh",
            zIndex: -1,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 70% 60% at 100% 0%, hsl(340 60% 58% / 0.07) 0%, transparent 70%)",
          }}
        />
        {/* Forest depth — bottom left */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: "45vw",
            height: "45vh",
            zIndex: -1,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 70% 60% at 0% 100%, hsl(150 30% 10% / 0.4) 0%, transparent 70%)",
          }}
        />
        {/* Botanical hero flower — top right decorative */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: "-5%",
            right: "-8%",
            width: "380px",
            height: "380px",
            zIndex: -1,
            pointerEvents: "none",
            backgroundImage: "url(/flower-hero.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.12,
            borderRadius: "50%",
            filter: "blur(1px)",
            maskImage: "radial-gradient(ellipse 80% 80% at 70% 30%, black 0%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 70% 30%, black 0%, transparent 70%)",
          }}
        />

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
