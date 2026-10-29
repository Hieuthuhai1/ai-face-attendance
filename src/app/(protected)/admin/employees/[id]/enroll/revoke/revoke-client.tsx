"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { revokeEmployeeEnrollment } from "@/features/face-enrollment/actions";

export function RevokeEnrollmentClient({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRevoke() {
    setConfirming(false);
    setRevoking(true);
    setError(null);
    const res = await revokeEmployeeEnrollment(employeeId);
    setRevoking(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    router.push(`/admin/employees/${employeeId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle>Thu hồi mẫu khuôn mặt của nhân viên</CardTitle>
        <CardDescription>
          Mẫu tham chiếu bị xóa ở provider và nhân viên phải đăng ký lại. Hành động được ghi audit log.
        </CardDescription>
        <div className="mt-6">
          <Button
            variant="danger"
            size="lg"
            className="w-full"
            onClick={() => setConfirming(true)}
            loading={revoking}
          >
            <Icon name="refresh" size={18} /> Thu hồi mẫu khuôn mặt
          </Button>
          {error ? (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Thu hồi mẫu khuôn mặt"
        message="Nhân viên sẽ phải đăng ký lại để chấm công bằng khuôn mặt. Tiếp tục thu hồi?"
        confirmLabel="Thu hồi"
        danger
        loading={revoking}
        onConfirm={onRevoke}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
