"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { revokeMyEnrollment } from "@/features/face-enrollment/actions";
import { LoadingState } from "@/components/ui/states";
import { Suspense } from "react";

export default function RevokeEnrollmentPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Thu hồi đăng ký khuôn mặt</h1>
      <RevokeForm />
    </main>
  );
}

function RevokeForm() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRevoke() {
    setConfirming(false);
    setRevoking(true);
    setError(null);
    const res = await revokeMyEnrollment();
    setRevoking(false);
    if (!res.ok) {
      setError(`${res.code}: ${res.message}`);
      return;
    }
    router.push("/enrollment");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle>Thu hồi đăng ký khuôn mặt</CardTitle>
        <CardDescription>Rút đồng ý — mẫu khuôn mặt bị xóa ở cả provider trong 72h.</CardDescription>
        <div className="mt-6">
          <Button variant="danger" size="lg" className="w-full" onClick={() => setConfirming(true)} loading={revoking}>
            <Icon name="rotate-ccw" size={18} /> Thu hồi mẫu khuôn mặt
          </Button>
          {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Thu hồi mẫu khuôn mặt"
        message="Bạn sẽ phải đăng ký lại để chấm công bằng khuôn mặt. Tiếp tục thu hồi?"
        confirmLabel="Thu hồi"
        danger
        loading={revoking}
        onConfirm={async () => {
          setConfirming(false);
          const res = await revokeMyEnrollment();
          if (!res.ok) {
            setError(`${res.code}: ${res.message}`);
          } else {
            router.push("/enrollment");
          }
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}