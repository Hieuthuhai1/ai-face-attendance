"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Stepper } from "@/components/ui/stepper";
import { CameraCapture } from "@/features/face-enrollment/camera-capture";
import { CONSENT_SECTIONS, CONSENT_VERSION } from "@/features/face-enrollment/consent";
import { submitEnrollment, revokeMyEnrollment } from "@/features/face-enrollment/actions";
import { LoadingState } from "@/components/ui/states";
import { Suspense } from "react";

export type EnrollmentState = "none" | "pending" | "active" | "rejected" | "revoked";

const ENROLLMENT_STEPS = [
  { key: "select", label: "Chọn nhân viên", description: "Chọn nhân viên cần đăng ký" },
  { key: "notice", label: "Thông báo & Consent", description: "Đọc thông báo và đồng ý" },
  { key: "camera", label: "Kiểm tra Camera", description: "Kiểm tra camera và ánh sáng" },
  { key: "capture", label: "Chụp ảnh", description: "Chụp ảnh khuôn mặt" },
  { key: "verify", label: "Xác minh & Lưu", description: "Xác minh và lưu đăng ký" },
] as const;

export type EnrollmentWizardStep = typeof ENROLLMENT_STEPS[number]["key"];

interface EnrollmentWizardProps {
  employeeId?: string;
  initialState?: "none" | "pending" | "active" | "rejected" | "revoked";
  providerDemo?: boolean;
}

export function EnrollmentWizard({ employeeId: initialEmployeeId, initialState, providerDemo }: EnrollmentWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState("select");
  const [employeeId, setEmployeeId] = useState(initialEmployeeId || "");
  const [consent, setConsent] = useState(false);
  const [fixture, setFixture] = useState<"good" | "blurry" | "liveness-fail" | "no-match">("good");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const currentStepIndex = ENROLLMENT_STEPS.findIndex(s => s.key === step);

  function nextStep() {
    if (currentStepIndex < ENROLLMENT_STEPS.length - 1) {
      setStep(ENROLLMENT_STEPS[currentStepIndex + 1].key);
    }
  }

  function prevStep() {
    if (currentStepIndex > 0) {
      setStep(ENROLLMENT_STEPS[currentStepIndex - 1].key);
    }
  }

  async function onCapture(frameDataUrl: string) {
    setSubmitting(true);
    setError(null);
    const res = await submitEnrollment({
      frameDataUrl,
      consentAccepted: consent,
      consentVersion: CONSENT_VERSION,
      fixture: fixture,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(`${res.code}: ${res.message}`);
      return;
    }
    setDone(true);
    setStep("verify");
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
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Đăng ký nhận diện khuôn mặt</h1>
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-[var(--brand-soft)] text-[var(--brand-strong)]">
            {ENROLLMENT_STEPS[currentStepIndex].label} ({currentStepIndex + 1}/{ENROLLMENT_STEPS.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {ENROLLMENT_STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-semibold ${i < ENROLLMENT_STEPS.findIndex(s => s.key === step) ? "bg-[var(--success)] text-white" : i === currentStepIndex ? "bg-[var(--brand)] text-white" : "bg-slate-100 text-slate-400"}`}>
                {i < ENROLLMENT_STEPS.findIndex(s => s.key === step) ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : i + 1}
              </span>
              <span className={i === currentStepIndex ? "font-medium text-slate-800" : "text-slate-500"}>{s.label}</span>
              {i < ENROLLMENT_STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-slate-200" />}
            </div>
          ))}
        </div>
      </div>

      {step === "select" && (
        <Card>
          <CardTitle>Chọn nhân viên</CardTitle>
          <CardDescription>Chọn nhân viên cần đăng ký nhận diện khuôn mặt</CardDescription>
          <div className="mt-4">
            <input
              type="text"
              placeholder="Nhập mã nhân viên hoặc email..."
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
              onChange={(e) => setEmployeeId(e.target.value)}
              value={employeeId}
            />
            {employeeId && (
              <Button className="mt-3 w-full" onClick={() => setStep("notice")}>
                Tiếp tục
              </Button>
            )}
          </div>
        </Card>
      )}

      {step === "notice" && (
        <Card>
          <CardTitle>Thông báo xử lý dữ liệu khuôn mặt (bản {CONSENT_VERSION})</CardTitle>
          <div className="mt-4 space-y-4">
            {CONSENT_SECTIONS.map((s) => (
              <div key={s.title}>
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span className="text-sm">Tôi đã đọc thông báo trên và đồng ý đăng ký khuôn mặt cho mục đích chấm công.</span>
            </label>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setStep("select")}>Quay lại</Button>
              <Button className="ml-2" onClick={() => setStep("camera")} disabled={!consent}>
                Tiếp tục
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === "camera" && (
        <Card>
          <CardTitle>Kiểm tra Camera</CardTitle>
          <CardDescription>Kiểm tra camera hoạt động bình thường trước khi chụp</CardDescription>
          <div className="mt-4">
            <CameraCapture
              onCapture={() => {}}
              disabled={false}
              showGuide
              captureLabel="Kiểm tra camera"
            />
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setStep("notice")}>Quay lại</Button>
              <Button className="ml-2" onClick={() => setStep("capture")}>Tiếp tục</Button>
            </div>
          </div>
        </Card>
      )}

      {step === "capture" && (
        <Card>
          <CardTitle>Chụp ảnh khuôn mặt</CardTitle>
          <CardDescription>Đưa khuôn mặt vào khung, nhìn thẳng camera và giữ yên</CardDescription>
          <div className="mt-4">
            <CameraCapture
              onCapture={onCapture}
              disabled={submitting}
              showGuide
              captureLabel="Chụp ảnh"
            />
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setStep("camera")}>Quay lại</Button>
            </div>
          </div>
        </Card>
      )}

      {step === "verify" && (
        <Card>
          <CardTitle>Xác minh và Hoàn tất</CardTitle>
          <div className="mt-4">
            {submitting ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="animate-spin text-[var(--brand)]">
                  <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" strokeWidth={3} />
                  </svg>
                </div>
                <p className="text-lg font-medium">Đang xử lý đăng ký...</p>
                <p className="text-sm text-slate-500">Vui lòng không đóng trang này</p>
              </div>
            ) : done ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-900">Đăng ký thành công!</h3>
                <p className="text-slate-600">Đăng ký khuôn mặt đã được gửi và đang chờ HR duyệt.</p>
                <div className="flex gap-3">
                  <Button onClick={() => window.location.href = "/enrollment"}>Quay lại trang đăng ký</Button>
                  <Button variant="secondary" onClick={() => { setDone(false); setStep("select"); }}>Đăng ký thêm</Button>
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-bg)] text-[var(--danger)]">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l2 2m-2 2l2 2m-2 2l2 2m-2 2l2 2m-2 2l-2 2m-2 2l-2 2m-2 2l-2 2m-2 2l-2 2"/></svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-900">Đăng ký thất bại</h3>
                <p className="text-slate-600 max-w-md">{error}</p>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => { setError(null); setStep("capture"); }}>Thử lại</Button>
                  <Button variant="ghost" onClick={() => { setError(null); setStep("camera"); }}>Quay lại kiểm tra camera</Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-600 mb-4">Sẵn sàng gửi đăng ký? Hệ thống sẽ thực hiện:</p>
                <ul className="text-left max-w-md mx-auto space-y-2 text-sm text-slate-600">
                  <li>• Kiểm tra liveness (phát hiện người thật)</li>
                  <li>• Xác minh khuôn mặt 1:1 với mẫu đã đăng ký</li>
                  <li>• Gửi đăng ký lên server và chờ HR duyệt</li>
                </ul>
                <div className="mt-6 flex justify-center gap-3">
                  <Button variant="secondary" onClick={() => setStep("capture")}>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7"/></svg>
                    Quay lại
                  </Button>
                  <Button onClick={() => setStep("verify")} loading={submitting}>
                    Gửi đăng ký
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l9 2m0 0l-9-9m9 9l-9 9"/></svg>
                  </Button>
                </div>
                {error && (
                  <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Revoke section for active enrollments */}
      {initialState === "active" && (
        <Card>
          <CardTitle>Thu hồi đăng ký</CardTitle>
          <CardDescription>Rút đồng ý — mẫu khuôn mặt bị xóa ở cả provider trong 72h.</CardDescription>
          <div className="mt-4">
            <Button variant="danger" size="sm" onClick={() => setConfirmingRevoke(true)} loading={revoking}>
              Thu hồi mẫu khuôn mặt
            </Button>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="hidden">
              <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/40" onClick={() => setConfirmingRevoke(false)} />
                <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-5">
                  <h2 className="text-base font-semibold">Thu hồi mẫu khuôn mặt</h2>
                  <p className="mt-2 text-sm text-slate-600">Bạn sẽ phải đăng ký lại để chấm công bằng khuôn mặt. Tiếp tục thu hồi?</p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={() => setConfirmingRevoke(false)} className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Hủy</button>
                    <button type="button" onClick={onRevoke} disabled={revoking} className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">{revoking ? "Đang thu hồi..." : "Thu hồi"}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function EnrollmentPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Đăng ký khuôn mặt</h1>
      <div className="flex h-32 items-center justify-center">Đang tải trạng thái…</div>
    </main>
  );
}