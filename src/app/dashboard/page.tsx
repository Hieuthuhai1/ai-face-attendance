import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { UI_STATUS } from "@/lib/status";
import { hasRole } from "@/lib/roles";
import { requireUser } from "@/server/auth";
import { signOut } from "@/features/auth/actions";
import { LoadingState } from "@/components/ui/states";

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ forbidden?: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Bảng điều khiển</h1>
      <Suspense fallback={<LoadingState message="Đang tải thông tin tài khoản…" />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ forbidden?: string }>;
}) {
  const { profile } = await requireUser();
  const params = await searchParams;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">Xin chào, {profile.display_name || profile.email}</p>
          <p className="mt-1 text-sm text-slate-500">
            {UI_STATUS.pending.icon} Vai trò: {profile.role}
          </p>
        </div>
        <form action={signOut}>
          <Button variant="secondary" size="sm" type="submit">
            Đăng xuất
          </Button>
        </form>
      </div>

      {params.forbidden ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          ✕ Bạn không có quyền truy cập trang vừa rồi.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Đăng ký khuôn mặt</CardTitle>
          <CardDescription>Đồng ý thông báo, chụp ảnh, chờ HR xác minh.</CardDescription>
          <div className="mt-3">
            <Link href="/enrollment">
              <Button size="sm">Đăng ký khuôn mặt</Button>
            </Link>
          </div>
        </Card>
        <Card>
          <CardTitle>Chấm công</CardTitle>
          <CardDescription>Check-in/out bằng khuôn mặt đã xác minh.</CardDescription>
          <div className="mt-3">
            <Link href="/check-in">
              <Button size="sm">Chấm công ngay</Button>
            </Link>
          </div>
        </Card>
        {hasRole(profile.role, ["hr_admin", "system_admin"]) ? (
          <>
            <Card>
              <CardTitle>Nhân viên & phòng ban</CardTitle>
              <CardDescription>CRUD nhân viên, mã duy nhất, vô hiệu hóa.</CardDescription>
              <div className="mt-3">
                <Link href="/admin/employees">
                  <Button size="sm">Quản lý nhân viên</Button>
                </Link>
              </div>
            </Card>
            <Card>
              <CardTitle>Ca làm & phân ca</CardTitle>
              <CardDescription>Ca ngày/đêm, grace period, phân ca.</CardDescription>
              <div className="mt-3">
                <Link href="/admin/shifts">
                  <Button size="sm">Quản lý ca làm</Button>
                </Link>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
