import type { ReactNode } from "react";
import { Suspense } from "react";
import { ShellHost } from "@/components/app/shell-host";

/**
 * Layout nhóm route bảo vệ. ShellHost (async, đọc session) chạy trong Suspense
 * để không chặn prerender tĩnh — pattern đã verify build xanh.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <ShellHost>{children}</ShellHost>
    </Suspense>
  );
}
