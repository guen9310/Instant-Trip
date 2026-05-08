import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/client/providers/QueryProvider";

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
    >
      <body className="h-full flex justify-center bg-background text-text-primary md:bg-muted">
        <div className="flex flex-col h-full w-full max-w-[430px] bg-background overflow-hidden md:shadow-[0_0_40px_rgba(0,0,0,0.08)]">
          <QueryProvider>{children}</QueryProvider>
        </div>
      </body>
    </html>
  );
}
