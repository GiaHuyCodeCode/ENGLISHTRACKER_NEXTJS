import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { MainLayout } from "@/components/layout/MainLayout";
import { DictionaryPopup } from "@/components/ui/DictionaryPopup";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EnglishTracker – Nền Tảng Học Tiếng Anh",
  description: "Hệ thống theo dõi và luyện tập tiếng Anh thông minh",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// No-flash theme script — runs before paint to avoid white flash
const themeScript = `(function(){try{var t=localStorage.getItem('et_theme')||'dark';var h=document.documentElement;h.classList.remove('dark','light');h.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${jakarta.variable} dark antialiased`}>
      <head>
        {/* No-flash: inject theme class before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans flex relative overflow-x-hidden">

        {/* Subtle noise texture */}
        <div className="botanical-noise" aria-hidden="true" />

        {/* ── DARK MODE ambient backgrounds ──────────────────────── */}
        <div className="dark-only" aria-hidden="true">
          <div style={{
            position: "fixed", top: 0, right: 0,
            width: "50vw", height: "50vh", zIndex: -1, pointerEvents: "none",
            background: "radial-gradient(ellipse 70% 60% at 100% 0%, hsl(340 60% 58% / 0.15) 0%, transparent 70%)",
          }} />
          <div style={{
            position: "fixed", bottom: 0, left: 0,
            width: "45vw", height: "45vh", zIndex: -1, pointerEvents: "none",
            background: "radial-gradient(ellipse 70% 60% at 0% 100%, hsl(150 30% 10% / 0.6) 0%, transparent 70%)",
          }} />
          <div style={{
            position: "fixed", top: 0, right: 0,
            width: "100vw", height: "100vh", zIndex: -2, pointerEvents: "none",
            backgroundImage: "url(/flower-hero-premium.png)",
            backgroundSize: "cover", backgroundPosition: "top right",
            opacity: 0.15, mixBlendMode: "lighten",
            maskImage: "radial-gradient(circle at 100% 0%, black 5%, transparent 60%)",
            WebkitMaskImage: "radial-gradient(circle at 100% 0%, black 5%, transparent 60%)",
          }} />
        </div>

        {/* ── LIGHT MODE floral art backgrounds ──────────────────── */}
        <div className="light-only" aria-hidden="true">
          {/* Premium botanical illustration */}
          <div style={{
            position: "fixed", inset: 0, zIndex: -2, pointerEvents: "none",
            backgroundImage: "url(/flower-light-premium.png)",
            backgroundSize: "cover", backgroundPosition: "bottom left",
            transform: "scaleX(-1)",
            opacity: 0.25, mixBlendMode: "multiply",
            maskImage: "radial-gradient(circle at 0% 100%, black 15%, transparent 60%)",
            WebkitMaskImage: "radial-gradient(circle at 0% 100%, black 15%, transparent 60%)",
          }} />
          {/* Peony pink top-right glow */}
          <div style={{
            position: "fixed", top: 0, right: 0,
            width: "55vw", height: "55vh", zIndex: -1, pointerEvents: "none",
            background: "radial-gradient(ellipse 70% 70% at 100% 0%, hsl(340 70% 80% / 0.15) 0%, transparent 70%)",
          }} />
          {/* Golden meadow bottom-left glow */}
          <div style={{
            position: "fixed", bottom: 0, left: 0,
            width: "50vw", height: "50vh", zIndex: -1, pointerEvents: "none",
            background: "radial-gradient(ellipse 70% 60% at 0% 100%, hsl(47 80% 70% / 0.10) 0%, transparent 70%)",
          }} />
        </div>

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
