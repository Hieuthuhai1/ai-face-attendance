"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon, type IconName } from "@/components/ui/icon";
import { CameraCapture } from "@/features/face-enrollment/camera-capture";
import { CONSENT_SECTIONS, CONSENT_VERSION } from "@/features/face-enrollment/consent";
import { submitEnrollment, revokeMyEnrollment, getMyEnrollment } from "@/features/face-enrollment/actions";
import { getProviderHealth } from "@/server/face";
import type { FaceFixture } from "@/server/face/types";
import { LoadingState } from "@/components/ui/states";

export type EnrollmentWorkflowState =
  | "idle"
  | "consent"
  | "camera_check"
  | "capturing"
  | "submitting"
  | "success"
  | "error"
  | "revoke_confirm"
  | "revoking";

const WORKFLOW_STEPS = [
  { key: "consent", label: "Thông báo & Consent", description: "Đọc thông báo và đồng ý" },
  { key: "camera_check", label: "Kiểm tra Camera", description: "Kiểm tra camera, ánh sáng, góc khuôn mặt" },
  { key: "capturing", label: "Chụp ảnh", description: "Chụp ảnh khuôn mặt đạt chất lượng" },
  { key: "submitting", label: "Xác minh & Lưu", description: "Liveness, enroll, lưu đăng ký" },
] as const;

type WorkflowStepKey = typeof WORKFLOW_STEPS[number]["key"];

const STEP_META: Record<WorkflowStepKey, { icon: IconName; label: string }> = {
  consent: { icon: "file-text", label: "Consent" },
  camera_check: { icon: "camera", label: "Camera" },
  capturing: { icon: "camera", label: "Chụp ảnh" },
  submitting: { icon: "shield", label: "Xác minh" },
};

interface EnrollmentWorkflowProps {
  /** Trạng thái enrollment ban đầu của employee */
  initialState: "none" | "pending" | "active" | "rejected" | "revoked" | "failed" | "needs_review";
  /** Employee ID (cho HR đăng ký hộ) */
  employeeId?: string;
  /** Provider demo mode */
  providerDemo?: boolean;
  /** Callback khi enrollment thành công */
  onSuccess?: () => void;
  /** Callback khi enrollment thất bại */
  onError?: (error: string) => void;
  /** Callback khi hoàn tất (success hoặc error đã xử lý) */
  onComplete?: () => void;
}

export function EnrollmentWorkflow({
  initialState,
  employeeId: initialEmployeeId,
  providerDemo = false,
  onSuccess,
  onError,
  onComplete,
}: EnrollmentWorkflowProps) {
  const router = useRouter();

  // Workflow state
  const [workflowState, setWorkflowState] = useState<EnrollmentWorkflowState>("idle");
  const [currentStep, setCurrentStep] = useState<WorkflowStepKey>("consent");
  const [employeeId, setEmployeeId] = useState(initialEmployeeId || "");
  const [consent, setConsent] = useState(false);
  const [fixture, setFixture] = useState<FaceFixture>("good");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  // Provider health check
  const [providerHealth, setProviderHealth] = useState<{
    configured: boolean;
    demo: boolean;
    message: string;
  } | null>(null);

  const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.key === currentStep);
  const isLastStep = currentStepIndex === WORKFLOW_STEPS.length - 1;

  // Load provider health on mount
  useEffect(() => {
    async function loadHealth() {
      try {
        const res = await fetch("/api/health/face");
        if (res.ok) {
          const health = await res.json();
          setProviderHealth(health);
        }
      } catch {
        // Ignore health check errors
      }
    }
    loadHealth();
  }, []);

  // Auto-transition from idle to consent if starting fresh
  useEffect(() => {
    if (workflowState === "idle" && (initialState === "none" || initialState === "rejected" || initialState === "revoked")) {
      setWorkflowState("consent");
    } else if (initialState === "active" || initialState === "pending" || initialState === "failed" || initialState === "needs_review") {
      setWorkflowState("success");
    }
  }, [workflowState, initialState]);

  // Camera ready callback
  const onCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  // Capture callback
  const onCapture = useCallback(async (frameDataUrl: string, quality: { ok: boolean; issues: string[] }) => {
    if (!quality.ok) {
      // Quality check failed - camera component will show issues
      return;
    }

    setWorkflowState("submitting");
    setSubmitting(true);
    setError(null);

    const res = await submitEnrollment({
      frameDataUrl,
      consentAccepted: consent,
      consentVersion: CONSENT_VERSION,
      fixture: providerDemo ? fixture : undefined,
    });

    setSubmitting(false);

    if (!res.ok) {
      setError(`${res.code}: ${res.message}`);
      setWorkflowState("error");
      onError?.(`${res.code}: ${res.message}`);
      return;
    }

    setSuccess(true);
    setWorkflowState("success");
    onSuccess?.();
    router.refresh();
  }, [consent, providerDemo, fixture, router, onError, onSuccess]);

  // Revoke callback
  const onRevoke = useCallback(async () => {
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
    onComplete?.();
  }, [router, onComplete]);

  // Navigation
  const goNext = useCallback(() => {
    if (currentStepIndex < WORKFLOW_STEPS.length - 1) {
      const nextStep = WORKFLOW_STEPS[currentStepIndex + 1].key;
      setCurrentStep(nextStep);
      setWorkflowState(nextStep as EnrollmentWorkflowState);
    }
  }, [currentStepIndex]);

  const goPrev = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevStep = WORKFLOW_STEPS[currentStepIndex - 1].key;
      setCurrentStep(prevStep);
      setWorkflowState(prevStep as EnrollmentWorkflowState);
    }
  }, [currentStepIndex]);

  const retryFromError = useCallback(() => {
    setError(null);
    setWorkflowState("capturing");
    setCurrentStep("capturing");
  }, []);

  const retryFromCamera = useCallback(() => {
    setError(null);
    setCameraReady(false);
    setWorkflowState("camera_check");
    setCurrentStep("camera_check");
  }, []);

  const startOver = useCallback(() => {
    setWorkflowState("consent");
    setCurrentStep("consent");
    setConsent(false);
    setError(null);
    setSuccess(false);
    setCameraReady(false);
    setEmployeeId("");
  }, []);

  // Determine current step display
  const isStepCompleted = (index: number) => index < currentStepIndex;
  const isStepActive = (index: number) => index === currentStepIndex;

  // Provider status display
  const providerStatus = providerHealth
    ? providerHealth.configured
      ? (providerHealth.demo ? "DEMO" : "Sẵn sàng")
      : "NOT CONFIGURED"
    : "Kiểm tra...";

  const providerStatusTone = providerHealth
    ? providerHealth.configured
      ? (providerHealth.demo ? "warning" : "success")
      : "danger"
    : "neutral";

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Đăng ký nhận diện khuôn mặt</h1>
        
        {/* Provider status badge */}
        <div className="flex items-center gap-2">
          <Badge tone={providerStatusTone}>
            {providerStatus}
          </Badge>
          {providerDemo && (
            <Badge tone="info">DEMO MODE</Badge>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {WORKFLOW_STEPS.map((step, index) => (
            <div key={step.key} className="flex items-center gap-1">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold text-sm transition-colors ${
                  isStepCompleted(index)
                    ? "bg-[var(--success)] text-white"
                    : isStepActive(index)
                    ? "bg-[var(--brand)] text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {isStepCompleted(index) ? (
                  <Icon name="check" size={14} />
                ) : (
                  <Icon name={STEP_META[step.key].icon} size={14} />
                )}
              </div>
              <span className={isStepActive(index) ? "font-medium text-slate-800 hidden sm:block" : "text-slate-500 hidden sm:block"}>
                {step.label}
              </span>
              {index < WORKFLOW_STEPS.length - 1 && (
                <span className={`h-px flex-1 max-w-20 transition-colors ${isStepCompleted(index) ? "bg-[var(--success)]" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Provider not configured warning */}
      {providerHealth && !providerHealth.configured && (
        <Card className="border-[var(--danger)] bg-[var(--danger-bg)]">
          <div className="flex items-center gap-3 p-4">
            <Icon name="alert-triangle" size={24} className="text-[var(--danger)]" />
            <div>
              <p className="font-medium text-[var(--danger)]">Provider chưa được cấu hình</p>
              <p className="text-sm text-slate-600 mt-1">
                {providerHealth.message}. Chỉ có thể chạy DEMO/mock trên môi trường development.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Consent Step */}
      {currentStep === "consent" && workflowState !== "success" && (
        <Card>
          <CardTitle>Thông báo xử lý dữ liệu khuôn mặt (bản {CONSENT_VERSION})</CardTitle>
          <CardDescription>
            <span className="text-slate-600">Vui lòng đọc kỹ và đồng ý trước khi tiếp tục đăng ký.</span>
          </CardDescription>
          <div className="mt-4 space-y-4">
            {CONSENT_SECTIONS.map((section) => (
              <div key={section.title} className="border-l-2 border-slate-200 pl-4">
                <p className="text-sm font-medium text-slate-800">{section.title}</p>
                <p className="text-sm text-slate-600 mt-1">{section.body}</p>
              </div>
            ))}
          </div>
          <label className="mt-4 flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--brand)] focus:ring-[var(--brand)]"
              aria-label="Tôi đã đọc và đồng ý"
              disabled={workflowState === "submitting"}
            />
            <span className="text-sm text-slate-700 mt-1">
              Tôi đã đọc thông báo trên và đồng ý đăng ký khuôn mặt cho mục đích chấm công.
            </span>
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={startOver} disabled={workflowState === "submitting"}>
              Hủy
            </Button>
            <Button
              onClick={() => { setWorkflowState("camera_check"); setCurrentStep("camera_check"); }}
              disabled={!consent || workflowState === "submitting"}
            >
              Tiếp tục
              <span className="ml-1 inline-flex"><Icon name="chevron-right" size={14} /></span>
            </Button>
          </div>
        </Card>
      )}

      {/* Camera Check Step */}
      {currentStep === "camera_check" && workflowState !== "success" && (
        <Card>
          <CardTitle>Kiểm tra Camera & Ánh sáng</CardTitle>
          <CardDescription>
            <span className="text-slate-600">Hệ thống sẽ kiểm tra camera, ánh sáng và góc khuôn mặt. Hãy đảm bảo bạn ở nơi đủ sáng.</span>
          </CardDescription>
          <div className="mt-4">
            <CameraCapture
              onCapture={onCapture}
              disabled={submitting}
              showGuide
              captureLabel="Kiểm tra camera"
              buttonVariant="secondary"
              showPrivacyNotice
              allowManualCapture={true}
            />
            {/* Camera status indicators */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={cameraReady ? "success" : "neutral"}>
                <span className="mr-1 inline-flex"><Icon name={cameraReady ? "check" : "clock"} size={12} /></span>
                {cameraReady ? "Camera sẵn sàng" : "Đang kiểm tra camera..."}
              </Badge>
              {providerDemo && (
                <Badge tone="info">DEMO: Kết quả theo kịch bản mock</Badge>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => { setWorkflowState("consent"); setCurrentStep("consent"); }}>
              <Icon name="chevron-left" size={14} className="mr-1" /> Quay lại
            </Button>
            <Button
              onClick={() => { setWorkflowState("capturing"); setCurrentStep("capturing"); }}
              disabled={workflowState === "submitting"}
            >
              Tiếp tục chụp ảnh <Icon name="chevron-right" size={14} className="ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Capturing Step */}
      {currentStep === "capturing" && workflowState !== "success" && (
        <Card>
          <CardTitle>Chụp ảnh khuôn mặt</CardTitle>
          <CardDescription>
            <span className="text-slate-600">Đưa khuôn mặt vào khung tròn, nhìn thẳng camera, giữ yên. Hệ thống sẽ tự động chụp khi đạt chất lượng.</span>
          </CardDescription>
          <div className="mt-4">
            <CameraCapture
              onCapture={onCapture}
              disabled={submitting}
              showGuide
              captureLabel="Chụp ảnh"
              showPrivacyNotice
              allowManualCapture={true}
            />
            {/* Progress indicator for capturing */}
            {workflowState === "submitting" && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                  <span className="animate-spin"><Icon name="loader" size={20} /></span>
                </div>
                <p className="text-lg font-medium text-center">Đang xử lý đăng ký...</p>
                <p className="text-sm text-slate-500 text-center">Vui lòng không đóng trang này</p>
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setWorkflowState("camera_check"); setCurrentStep("camera_check"); }}>
              <Icon name="chevron-left" size={14} className="mr-1" /> Quay lại
            </Button>
          </div>
        </Card>
      )}

      {/* Submitting Step (handled inline during capturing) */}
      {workflowState === "submitting" && (
        <Card>
            <CardTitle>Đang xử lý đăng ký</CardTitle>
            <div className="mt-4 flex flex-col items-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                <span className="animate-spin"><Icon name="loader" size={28} /></span>
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">Đang xác minh và lưu đăng ký...</p>
                <p className="text-sm text-slate-500 mt-1">Vui lòng không đóng trang này</p>
              </div>
              <div className="w-64 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[var(--brand)] rounded-full animate-pulse" style={{ width: "75%" }} />
              </div>
            </div>
          </Card>
      )}

      {/* Success State */}
      {workflowState === "success" && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
              <Icon name="check" size={36} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Đăng ký thành công!</h3>
              <p className="text-slate-600 mt-1">
                {initialState === "pending" || initialState === "none"
                  ? "Đăng ký khuôn mặt đã được gửi và đang chờ HR duyệt."
                  : "Đăng ký khuôn mặt đã được cập nhật."}
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button onClick={() => { router.push("/enrollment"); onComplete?.(); }}>
                Quay lại trang đăng ký
              </Button>
              <Button variant="secondary" onClick={startOver}>
                Đăng ký cho nhân viên khác
              </Button>
            </div>
            {error && (
              <p className="mt-4 text-sm text-red-600" role="alert">
                <span className="inline mr-1"><Icon name="alert-triangle" size={14} /></span>
                {error}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Error State */}
      {workflowState === "error" && (
        <Card className="border-[var(--danger)]">
          <CardTitle>
            <span className="text-[var(--danger)]">Đăng ký thất bại</span>
          </CardTitle>
          <div className="mt-4 flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-bg)] text-[var(--danger)]">
              <Icon name="x" size={32} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Không thể hoàn tất đăng ký</h3>
              <p className="text-slate-600 mt-1 max-w-md">{error || "Đã xảy ra lỗi không xác định"}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={retryFromError}>
                <span className="mr-1 inline-flex"><Icon name="refresh" size={14} /></span> Thử lại chụp ảnh
              </Button>
              <Button variant="ghost" onClick={retryFromCamera}>
                Quay lại kiểm tra camera
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Revoke Section for Active/Pending/Needs Review Enrollments */}
      {(initialState === "active" || initialState === "pending" || initialState === "needs_review") && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Thu hồi đăng ký</CardTitle>
              <CardDescription>Rút đồng ý — mẫu khuôn mặt bị xóa ở provider, enrollment chuyển về revoked.</CardDescription>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmingRevoke(true)}
              loading={revoking}
            >
              Thu hồi mẫu khuôn mặt
            </Button>
          </div>
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
      )}

      {/* Provider Demo Fixture Selector */}
      {providerDemo && workflowState !== "success" && workflowState !== "submitting" && (
        <Card>
          <CardTitle>Kịch bản DEMO (chỉ local/test)</CardTitle>
          <CardDescription>Mock provider không đọc ảnh thật — kết quả theo kịch bản chọn sẵn.</CardDescription>
          <select
            value={fixture}
            onChange={(e) => setFixture(e.target.value as FaceFixture)}
            aria-label="Kịch bản mock"
            className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            disabled={workflowState === "submitting" as EnrollmentWorkflowState}
          >
            <option value="good">good — liveness pass, enroll thành công</option>
            <option value="blurry">blurry — chất lượng kém, yêu cầu chụp lại</option>
            <option value="liveness-fail">liveness-fail — chống giả mạo thất bại</option>
            <option value="no-match">no-match — không khớp (dùng ở verify)</option>
          </select>
        </Card>
      )}
    </div>
  );
}

export default function EnrollmentPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Đăng ký khuôn mặt</h1>
      <div className="flex h-32 items-center justify-center">Đang tải trạng thái…</div>
    </main>
  );
}