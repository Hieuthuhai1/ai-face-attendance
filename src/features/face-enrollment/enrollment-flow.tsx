"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DemoBanner } from "@/components/ui/demo-banner";
import { CameraCapture } from "@/features/face-enrollment/camera-capture";
import { CONSENT_SECTIONS, CONSENT_VERSION } from "@/features/face-enrollment/consent";
import { revokeMyEnrollment, submitEnrollment } from "@/features/face-enrollment/actions";
import type { FaceFixture } from "@/server/face/types";

export type EnrollmentState = "none" | "pending" | "active" | "rejected" | "revoked";

const STATE_META: Record<EnrollmentState, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  none: { label: "○ Chưa đăng ký", tone: "neutral" },
  pending: { label: "⏳ Chờ HR xác minh", tone: "warning" },
  active: { label: "✓ Đang hoạt động", tone: "success" },
  rejected: { label: "✕ Bị từ chối", tone: "danger" },
  revoked: { label: "— Đã thu hồi", tone: "neutral" },
};

export function EnrollmentFlow(props: { initialState: EnrollmentState; providerDemo: boolean }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [fixture, setFixture] = useState<FaceFixture>("good");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    if (!confirm("Thu hồi mẫu khuôn mặt? Bạn sẽ phải đăng ký lại để chấm công bằng khuôn mặt.")) return;
    setError(null);
    const res = await revokeMyEnrollment();
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
          <Badge tone={meta.tone}>{meta.label}</Badge>
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
              <p className="mt-2 text-sm text-slate-500">○ Tick đồng ý ở trên để bật nút chụp.</p>
            ) : null}
            {submitting ? <p role="status" className="mt-2 text-sm">◌ Đang gửi đăng ký…</p> : null}
            {error ? (
              <p role="alert" className="mt-2 text-sm text-red-600">✕ {error}</p>
            ) : null}
          </Card>
        </>
      ) : null}

      {props.initialState === "active" ? (
        <Card>
          <CardTitle>Thu hồi</CardTitle>
          <CardDescription>Rút đồng ý — mẫu khuôn mặt bị xóa ở cả provider trong 72h.</CardDescription>
          <div className="mt-3">
            <Button variant="danger" size="sm" onClick={onRevoke}>Thu hồi mẫu khuôn mặt</Button>
          </div>
          {error ? <p role="alert" className="mt-2 text-sm text-red-600">✕ {error}</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
