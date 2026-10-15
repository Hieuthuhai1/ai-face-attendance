import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ShellHost } from "@/components/app/shell-host";

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

/** Đọc session nhẹ, KHÔNG redirect — route guard vẫn do proxy + requireRole. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={children}>
          <ShellHost>{children}</ShellHost>
        </Suspense>
      </body>
    </html>
  );
}
