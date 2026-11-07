import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/components/app/language-provider";
import { Toaster } from "@/components/ui/toast";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import "./globals.css";

/**
 * Be Vietnam Pro: font chính cho UI tiếng Việt (đủ dấu, dễ đọc ở cỡ nhỏ).
 * Geist Mono chỉ dùng cho mã/số liệu kỹ thuật.
 */
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Face Attendance",
  description: "Web chấm công bằng xác minh khuôn mặt 1:1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${beVietnam.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LanguageProvider initialLocale={DEFAULT_LOCALE}>
          {children}
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
