import { AppLoadingScreen } from "@/components/ui/loading-screen";

/** Hiển thị khi tải lần đầu / chuyển phiên trước khi vào ứng dụng. */
export default function Loading() {
  return <AppLoadingScreen message="Đang kết nối hệ thống chấm công…" />;
}
