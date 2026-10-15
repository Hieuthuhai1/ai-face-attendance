"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DemoBanner } from "@/components/ui/demo-banner";
import { Icon, type IconName } from "@/components/ui/icon";
import { CameraCapture } from "@/features/face-enrollment/camera-capture";
import { CONSENT_SECTIONS, CONSENT_VERSION } from "@/features/face-enrollment/consent";
import { revokeMyEnrollment, submitEnrollment } from "@/features/face-enrollment/actions";
import type { FaceFixture } from "@/server/face/types";

export type EnrollmentState = "none" | "pending" | "active" | "rejected" | "revoked";

const STATE_META: Record<EnrollmentState, { label: string; icon: IconName; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  none: { label: "Chưa đăng ký", icon: "info", tone: "neutral" },
  pending: { label: "Chờ HR xác minh", icon: "clock", tone: "warning" },
  active: { label: "Đang hoạt động", icon: "check", tone: "success" },
  rejected: { label: "Bị từ chối", icon: "x", tone: "danger" },
  revoked: { label: "Đã thu hồi", icon: "x", tone: "neutral" },
};

export function EnrollmentFlow(props: { initialState: EnrollmentState; providerDemo: boolean }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [fixture, setFixture] = useState<FaceFixture>("good");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function onCapture(frameDataUrl: string) {
    setSubmitting(true);
    setError(null);
    const res = await submitEnrollment({
      frameDataUrl,
      consentAccepted: consent,
      consentVersion: CONSENT_VERSION,
      fixture: props.providerDemo ? fixture : undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(`${res.code}: ${res.message}`);
      return;
    }
    setDone(true);
    router.refresh();
  }

  async function onRevoke() {
    setConfirmingRevoke(false);
    setRevoking(true);
    setError(null);
    const res = await revokeMyEnrollment();
    setRevoking(false);
    if (!res.ok) {
      setError(`${res.code}: ${res.message}`);
      return;
    }
    router.refresh();
  }

  const meta = STATE_META[done ? "pending" : props.initialState];

  return (
    <div className="flex flex-col gap-4">
      <DemoBanner />
      <Card>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Trạng thái đăng ký</CardTitle>
          <Badge tone={meta.tone}><Icon name={meta.icon} size={14} /> {meta.label}</Badge>
        </div>
        <CardDescription>
          {props.initialState === "active"
            ? "Mẫu khuôn mặt đã được HR xác minh. Bạn có thể dùng để chấm công (Phase 5)."
            : props.initialState === "pending" || done
              ? "Đăng ký đang chờ HR xác minh danh tính và kích hoạt."
              : "Đọc thông báo, đồng ý, bật camera và chụp ảnh theo hướng dẫn."}
        </CardDescription>
      </Card>

      {(props.initialState === "none" || props.initialState === "rejected" || props.initialState === "revoked") && !done ? (
        <>
          <Card>
            <CardTitle>Thông báo xử lý dữ liệu khuôn mặt (bản {CONSENT_VERSION})</CardTitle>
            <div className="mt-2 flex flex-col gap-2">
              {CONSENT_SECTIONS.map((s) => (
                <div key={s.title}>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-sm text-slate-600">{s.body}</p>
                </div>
              ))}
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4"
                aria-label="Tôi đã đọc và đồng ý"
              />
              Tôi đã đọc thông báo trên và đồng ý đăng ký khuôn mặt cho mục đích chấm công.
            </label>
          </Card>

          {props.providerDemo ? (
            <Card>
              <CardTitle>Kịch bản DEMO (chỉ local/test)</CardTitle>
              <CardDescription>Mock provider không đọc ảnh thật — kết quả theo kịch bản chọn sẵn.</CardDescription>
              <select
                value={fixture}
                onChange={(e) => setFixture(e.target.value as FaceFixture)}
                aria-label="Kịch bản mock"
                className="mt-2 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="good">good — liveness pass, enroll thành công</option>
                <option value="blurry">blurry — chất lượng kém, yêu cầu chụp lại</option>
                <option value="liveness-fail">liveness-fail — chống giả mạo thất bại</option>
                <option value="no-match">no-match — không khớp (dùng ở verify)</option>
              </select>
            </Card>
          ) : null}

          <Card>
            <CardTitle>Chụp ảnh đăng ký</CardTitle>
            <div className="mt-3">
              <CameraCapture onCapture={onCapture} disabled={!consent || submitting} />
            </div>
            {!consent ? (
              <p className="mt-2 text-sm text-slate-500">Tick đồng ý ở trên để bật nút chụp.</p>
            ) : null}
            {submitting ? (
              <p role="status" className="mt-2 flex items-center gap-2 text-sm">
                <span className="animate-spin text-[var(--info)]"><Icon name="refresh" size={16} /></span> Đang gửi đăng ký…
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mt-2 flex items-center gap-1 text-sm text-red-600"><Icon name="x" size={14} /> {error}</p>
            ) : null}
          </Card>
        </>
      ) : null}

      {props.initialState === "active" ? (
        <Card>
          <CardTitle>Thu hồi</CardTitle>
          <CardDescription>Rút đồng ý — mẫu khuôn mặt bị xóa ở cả provider trong 72h.</CardDescription>
          <div className="mt-3">
            <Button variant="danger" size="sm" onClick={() => setConfirmingRevoke(true)} loading={revoking}>
              Thu hồi mẫu khuôn mặt
            </Button>
          </div>
          {error ? <p role="alert" className="mt-2 flex items-center gap-1 text-sm text-red-600"><Icon name="x" size={14} /> {error}</p> : null}
          <ConfirmDialog
            open={confirmingRevoke}
            title="Thu hồi mẫu khuôn mặt"
            message="Bạn sẽ phải đăng ký lại để chấm công bằng khuôn mặt. Tiếp tục thu hồi?"
            confirmLabel="Thu hồi"
            danger
            loading={revoking}
            onConfirm={onRevoke}
            onCancel={() => setConfirmingRevoke(false)}
          />
        </Card>
      ) : null}
    </div>
  );
}
