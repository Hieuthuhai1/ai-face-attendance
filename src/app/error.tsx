"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { logger } from "@/server/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("route error", { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col px-4 py-16">
      <Card>
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-lg font-semibold">✕ Đã xảy ra lỗi</p>
          <p className="text-sm text-slate-500">
            Vui lòng thử lại. Nếu lỗi tiếp diễn, liên hệ quản trị viên.
          </p>
          <Button variant="secondary" onClick={reset}>
            Thử lại
          </Button>
        </div>
      </Card>
    </main>
  );
}
