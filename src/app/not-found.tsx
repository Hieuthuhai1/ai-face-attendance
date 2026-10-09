import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col px-4 py-16">
      <Card>
        <p className="text-lg font-semibold">○ Không tìm thấy trang</p>
        <p className="mt-1 text-sm text-slate-500">Địa chỉ bạn truy cập không tồn tại.</p>
        <div className="mt-3">
          <Link href="/">
            <Button variant="secondary">Về trang chủ</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
