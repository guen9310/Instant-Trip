import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { QueryProvider } from "@/client/providers/QueryProvider";
import { DarkModeSync } from "@/components/layout/DarkModeSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "지금어때",
  description: "즉흥 여행 코스 생성 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      translate="no"
      className={`notranslate ${geistSans.variable} ${geistMono.variable} h-dvh antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full flex justify-center bg-background text-text-primary md:bg-muted">
        {/* FOUC 방지: 첫 paint 전 localStorage/시스템 설정으로 dark 클래스 적용 */}
        <Script
          id="dark-mode-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var raw=localStorage.getItem('theme');var t=raw?JSON.parse(raw).state?.theme:'system';var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <Script
          id="kakao-map-sdk"
          strategy="beforeInteractive"
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_KEY}&autoload=false`}
        />
        <DarkModeSync />
        <div className="flex flex-col h-full w-full max-w-107.5 bg-background overflow-hidden md:shadow-[0_0_40px_rgba(0,0,0,0.08)]">
          <QueryProvider>{children}</QueryProvider>
        </div>
      </body>
    </html>
  );
}
