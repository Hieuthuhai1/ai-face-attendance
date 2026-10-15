"use client";

import { Icon } from "@/components/ui/icon";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body>
        <main style={{ padding: 32, fontFamily: "sans-serif" }}>
          <div role="alert">
            <p style={{ fontSize: 18, fontWeight: 600 }}>
              <span aria-hidden="true" style={{ verticalAlign: "-2px" }}><Icon name="x" size={18} /></span> Lỗi nghiêm trọng
            </p>
            <p>Vui lòng tải lại trang.</p>
            <button onClick={reset} type="button">
              Tải lại
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
