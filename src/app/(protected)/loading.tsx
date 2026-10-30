import { PageSkeleton } from "@/components/ui/loading-screen";

/** Chuyển trang trong khu vực đã đăng nhập: skeleton giữ cấu trúc, tránh nháy trắng. */
export default function Loading() {
  return <PageSkeleton />;
}
