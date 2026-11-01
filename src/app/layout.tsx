import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/components/app/language-provider";
import { Toaster } from "@/components/ui/toast";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Face Attendance",
  description: "Web chấm công bằng xác minh khuôn mặt 1:1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider initialLocale={DEFAULT_LOCALE}>
          {children}
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
