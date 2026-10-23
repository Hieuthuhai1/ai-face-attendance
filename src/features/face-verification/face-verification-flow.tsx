"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DemoBanner } from "@/components/ui/demo-banner";
import { Icon } from "@/components/ui/icon";
import { verifyCheck, fallbackCheck, type CheckResult, type AttendanceError } from "@/features/attendance/actions";
import type { FaceFixture } from "@/server/face/types";

// CameraCapture uses browser APIs (navigator.mediaDevices) that can't run during static prerendering
const CameraCapture = dynamic(() => import("@/features/face-enrollment/camera-capture").then((mod) => mod.CameraCapture), {
  ssr: false,
  loading: () => <div className="h-64 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500">Đang tải camera…</div>,
});

// AttendanceReceipt and DetailedProgressIndicator are from face-attendance which transitively imports face-api
const AttendanceReceipt = dynamic(() => import("@/components/face-attendance").then((mod) => mod.AttendanceReceipt), {
  ssr: false,
  loading: () => <div className="h-64 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500">Đang tải…</div>,
});

const DetailedProgressIndicator = dynamic(() => import("@/components/face-attendance/CameraProgressIndicator").then((mod) => mod.DetailedProgressIndicator), {
  ssr: false,
  loading: () => <div className="h-64 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500">Đang tải…</div>,
});

export interface FaceVerificationFlowProps {
  /** Loại xác minh: check_in hoặc check_out */
  direction: "check_in" | "check_out";
  /** Thông tin ca làm */
  shift?: { name: string; start_time: string; end_time: string; overnight: boolean } | null;
  /** Demo mode */
  providerDemo?: boolean;
  /** Callback khi verification thành công */
  onSuccess?: (result: { direction: "check_in" | "check_out"; occurred_at: string }) => void;
  /** Callback khi verification thất bại */
  onError?: (error: { code: string; message: string }) => void;
  /** Callback khi hoàn tất (success hoặc error đã xử lý) */
  onComplete?: () => void;
  /** Trạng thái hôm nay từ server */
  status: Awaited<ReturnType<typeof getTodayStatus>>;
}

type UiState =
  | { kind: "idle" }
  | { kind: "verifying"; step: "liveness" | "matching" | "saving" }
  | { kind: "result"; res: Extract<CheckResult, { ok: true }> }
  | { kind: "failed"; error: AttendanceError };

const STEPS = ["1. Chuẩn bị", "2. Quét & xác minh", "3. Kết quả"] as const;

const FAILED_META: Record<string, { title: string; hint: string; category?: "retryable" | "permanent" | "configuration" | "requires_fallback"; showFallback?: boolean }> = {
  LIVENESS_FAILED: {
    title: "Không xác định được người thật",
    hint: "Thử lại đủ sáng, nhìn thẳng. Mock hiện tại không có liveness thật.",
    category: "retryable",
    showFallback: true,
  },
  NO_MATCH: {
    title: "Khuôn mặt không khớp",
    hint: "Thử lại hoặc dùng phương thức thay thế. Hệ thống không kết luận gian lận.",
    category: "retryable",
    showFallback: true,
  },
  LOW_CONFIDENCE: {
    title: "Độ khớp thấp",
    hint: "Đã ghi nhận và chuyển HR rà soát. Không coi là gian lận.",
    category: "retryable",
    showFallback: true,
  },
  POOR_IMAGE_QUALITY: {
    title: "Ảnh không đạt chất lượng",
    hint: "Hãy chụp lại rõ hơn, đủ sáng, nhìn thẳng camera.",
    category: "retryable",
    showFallback: false,
  },
  ENROLLMENT_MISSING: {
    title: "Chưa có mẫu khuôn mặt",
    hint: "Đăng ký và chờ HR duyệt trước.",
    category: "permanent",
    showFallback: true,
  },
  PROVIDER_UNAVAILABLE: {
    title: "Dịch vụ nhận diện bận",
    hint: "Giữ nguyên trang, bấm Thử lại (cùng mã, không tạo trùng).",
    category: "retryable",
    showFallback: true,
  },
  PROVIDER_TIMEOUT: {
    title: "Dịch vụ nhận diện quá lâu",
    hint: "Giữ nguyên trang, bấm Thử lại (cùng mã, không tạo trùng).",
    category: "retryable",
    showFallback: true,
  },
  NETWORK_ERROR: {
    title: "Mất kết nối",
    hint: "Kiểm tra mạng rồi bấm Thử lại (cùng mã).",
    category: "retryable",
    showFallback: true,
  },
  NO_SHIFT: { title: "Không có ca làm", hint: "Liên hệ HR nếu cần bổ sung phân ca.", category: "permanent", showFallback: false },
  NO_ENROLLMENT: { title: "Chưa có mẫu khuôn mặt", hint: "Đăng ký và chờ HR duyệt trước.", category: "permanent", showFallback: true },
  OUT_WITHOUT_IN: { title: "Chưa có lượt vào", hint: "Nếu quên check-in, gửi yêu cầu chỉnh công.", category: "permanent", showFallback: true },
  ALREADY_CHECKED_IN: { title: "Đã check-in rồi", hint: "Hãy check-out khi ra về.", category: "permanent", showFallback: false },
  RATE_LIMITED: { title: "Thao tác quá nhanh", hint: "Nghỉ ít phút rồi thử lại.", category: "retryable", showFallback: false },
  INVALID_IMAGE: { title: "Ảnh không hợp lệ", hint: "Ảnh quá lớn hoặc sai định dạng.", category: "retryable", showFallback: false },
  NOT_ELIGIBLE: { title: "Không đủ điều kiện", hint: "Tài khoản chưa phải nhân viên đang làm việc.", category: "permanent", showFallback: false },
  INVALID_KEY: { title: "Idempotency key không hợp lệ", hint: "Lỗi hệ thống, vui lòng tải lại trang.", category: "permanent", showFallback: false },
  RECORD_FAILED: { title: "Không ghi được chấm công", hint: "Thử lại, hệ thống sẽ không tạo trùng nhờ idempotency key.", category: "retryable", showFallback: true },
  PROVIDER_NOT_CONFIGURED: { title: "Provider chưa được cấu hình", hint: "Chỉ dùng được DEMO trên development. Production cần cấu hình AWS Rekognition.", category: "configuration", showFallback: false },
  UNAUTHORIZED: { title: "Provider credentials không hợp lệ", hint: "Liên hệ quản trị viên cấu hình provider.", category: "configuration", showFallback: false },
  REASON_REQUIRED: { title: "Lý do bắt buộc", hint: "Vui lòng nhập lý do dùng phương thức thay thế.", category: "permanent", showFallback: false },
  DUPLICATE: { title: "Đã ghi nhận trước đó", hint: "Không cần gửi lại.", category: "retryable", showFallback: false },
};

export function FaceVerificationFlow(props: FaceVerificationFlowProps) {
  const router = useRouter();
  const { direction, shift, providerDemo = false, onSuccess, onError, onComplete, status } = props;

  const [fixture, setFixture] = useState<FaceFixture>("good");
  const keyRef = useRef("");
  const [ui, setUi] = useState<UiState>({ kind: "idle" });
  const [showFallback, setShowFallback] = useState(false);
  const [reason, setReason] = useState("");

  function newClientKey(): string {
    return `evt_${crypto.randomUUID()}`;
  }

  function ensureKey(): string {
    if (!keyRef.current) keyRef.current = newClientKey();
    return keyRef.current;
  }

  function newAttempt() {
    keyRef.current = "";
  }

  // Check eligibility early - return failed state if not eligible
  if (!status.eligible) {
    return (
      <Card>
        <CardTitle>Không đủ điều kiện</CardTitle>
        <CardDescription>Tài khoản chưa đủ điều kiện chấm công. Liên hệ HR.</CardDescription>
      </Card>
    );
  }

  if (!status.hasEnrollment) {
    return (
      <Card>
        <CardTitle>Chưa có mẫu khuôn mặt</CardTitle>
        <CardDescription>Bạn chưa đăng ký khuôn mặt. Vui lòng đăng ký trước khi chấm công.</CardDescription>
        <div className="mt-3 flex flex-col gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push("/enrollment")}>
            Đăng ký khuôn mặt
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowFallback(true)}>
            Dùng phương thức thay thế (nhập lý do)
          </Button>
        </div>
      </Card>
    );
  }

  const step = ui.kind === "idle" ? 0 : ui.kind === "verifying" ? 1 : 2;
  const failed = ui.kind === "failed" ? (FAILED_META[ui.error.code] ?? { title: `Lỗi (${ui.error.code})`, hint: ui.error.message }) : null;

  async function onCapture(frameDataUrl: string) {
    setUi({ kind: "verifying", step: "liveness" });
    let res: CheckResult;
    try {
      res = await verifyCheck({
        direction,
        frameDataUrl,
        fixture: providerDemo ? fixture : undefined,
        idempotencyKey: ensureKey(),
      });
    } catch {
      setUi({ kind: "failed", error: { code: "NETWORK_ERROR", message: "Mất mạng khi gửi. Bấm Thử lại (dùng cùng mã, không tạo trùng).", category: "retryable", hint: "Kiểm tra mạng rồi bấm Thử lại (cùng mã).", showFallback: true } });
      return;
    }
    if (!res.ok) {
      setUi({ kind: "failed", error: res.error });
      onError?.({ code: res.error.code, message: res.error.message });
      return;
    }
    setUi({ kind: "result", res });
    onSuccess?.({ direction, occurred_at: res.occurred_at });
    router.refresh();
  }

  function retry() {
    setUi({ kind: "idle" });
  }

  function newCapture() {
    newAttempt();
    setUi({ kind: "idle" });
  }

  async function onFallbackHandler(e: React.FormEvent) {
    e.preventDefault();
    setUi({ kind: "verifying", step: "saving" });
    const res = await fallbackCheck({ direction, reason, idempotencyKey: ensureKey() });
    if (!res.ok) {
      setUi({ kind: "failed", error: res.error });
      onError?.({ code: res.error.code, message: res.error.message });
      return;
    }
    setUi({ kind: "result", res });
    onSuccess?.({ direction, occurred_at: res.occurred_at });
    setShowFallback(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <DemoBanner />

      {/* Header with current time and date */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-[var(--brand-soft)] border border-[var(--brand)]/20">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
            <Icon name="camera" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Xác minh khuôn mặt</h1>
            <p className="text-sm text-slate-500" id="current-time">Đang tải thời gian...</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="hidden sm:block px-3 py-1 text-xs font-medium bg-white rounded-full text-slate-600" id="current-date"></span>
        </div>
      </div>

      {/* Stepper */}
      <ol aria-label="Tiến trình xác minh" className="flex items-center gap-1 text-xs">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-1" aria-current={current ? "step" : undefined}>
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-semibold ${
                  done ? "bg-[var(--success-bg)] text-[var(--success)]" : current ? "bg-[var(--brand)] text-white" : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span className={current ? "font-medium text-slate-800" : "text-slate-500"}>{label}</span>
              {i < STEPS.length - 1 ? <span aria-hidden="true" className="mx-1 h-px flex-1 bg-slate-200" /> : null}
            </li>
          );
        })}
      </ol>

      <Card>
        <CardTitle>
          {shift ? `Ca: ${shift.name} (${shift.start_time}–${shift.end_time}${shift.overnight ? ", qua đêm" : ""})` : "Hôm nay không có ca làm"}
        </CardTitle>
        <CardDescription>
          Xác minh khuôn mặt để {direction === "check_in" ? "chấm công vào" : "chấm công ra"} ca làm việc.
        </CardDescription>
      </Card>

      {ui.kind === "result" ? (
        <AttendanceReceipt
          employeeName="Nhân viên"
          employeeCode="NV001"
          action={direction}
          occurredAt={ui.res.occurred_at}
          shiftName={shift?.name || "Ca làm"}
          shiftTime={`${shift?.start_time || "--:--"}–${shift?.end_time || "--:--"}${shift?.overnight ? " (qua đêm)" : ""}`}
          status={ui.res.status}
          lateMinutes={ui.res.late_min}
          earlyMinutes={ui.res.early_leave_min}
          method={ui.res.status === "fallback" ? "pin_fallback" : "face"}
          confidence={ui.res.confidence}
          livenessStatus={ui.res.liveness}
          verificationRef={ui.res.verification_ref}
          onContinue={() => {
            setUi({ kind: "idle" });
            onComplete?.();
          }}
          onFallback={() => { newAttempt(); setShowFallback(true); }}
        />
      ) : ui.kind === "failed" && failed ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="text-[var(--danger)]"><Icon name="x" size={36} /></span>
            <p role="alert" className="text-lg font-semibold">{failed.title}</p>
            <p className="text-sm text-slate-600">{failed.hint}</p>
            <p className="text-xs text-slate-400">Mã lỗi: {ui.error.code} (để đối chiếu với HR/kỹ thuật)</p>
            {failed.category === "configuration" && (
              <p className="text-xs text-amber-600">Cần cấu hình từ quản trị viên.</p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {failed.category === "retryable" && (
              <>
                <Button size="sm" variant="secondary" onClick={retry}>Thử lại (cùng mã)</Button>
                <Button size="sm" variant="secondary" onClick={newCapture}>Chụp lại (mã mới)</Button>
              </>
            )}
            {failed.showFallback && (
              <Button size="sm" variant="ghost" onClick={() => { newAttempt(); setShowFallback(true); }}>
                Dùng phương thức thay thế
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <CardTitle>Xác minh khuôn mặt — {direction === "check_in" ? "vào" : "ra"}</CardTitle>
          {providerDemo ? (
            <select value={fixture} onChange={(e) => setFixture(e.target.value as FaceFixture)} aria-label="Kịch bản mock" className="mt-2 h-10 rounded-lg border border-slate-300 px-3 text-sm">
              <option value="good">good — pass (confidence cao)</option>
              <option value="blurry">blurry — confidence thấp → HR rà soát</option>
              <option value="liveness-fail">liveness-fail — thất bại</option>
              <option value="no-match">no-match — không khớp</option>
            </select>
          ) : null}
          <div className="mt-3">
            {ui.kind === "verifying" ? (
              <DetailedProgressIndicator
                step={ui.step}
                message={
                  ui.step === "liveness" ? "Đang kiểm tra liveness..." :
                  ui.step === "matching" ? "Đang đối chiếu khuôn mặt..." :
                  "Đang lưu bản ghi..."
                }
              />
            ) : (
              <CameraCapture
                onCapture={onCapture}
                showGuide
                isCheckIn
                captureLabel={direction === "check_in" ? "Chấm công vào" : "Chấm công ra"}
                buttonVariant="primary"
                showPrivacyNotice
                allowManualCapture={true}
              />
            )}
          </div>
          <div className="mt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowFallback((v) => !v)}>
              Không dùng được camera? Phương thức thay thế
            </Button>
          </div>
        </Card>
      )}

      {showFallback && ui.kind !== "result" ? (
        <Card>
          <CardTitle>Phương thức thay thế</CardTitle>
          <CardDescription>Ghi nhận kèm lý do, chờ HR xác nhận. Không tự ý dùng khi camera vẫn tốt.</CardDescription>
          <form onSubmit={onFallbackHandler} className="mt-2 flex flex-col gap-2">
            <label className="text-sm font-medium">Lý do <span className="text-red-500">*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              className="h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="VD: camera hỏng, mất mạng, nhận diện lỗi liên tục..."
            />
            <div className="flex justify-end">
              <Button type="submit" loading={ui.kind === "verifying"} disabled={!reason.trim()}>
                Gửi ghi nhận thay thế
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

export default function FaceVerificationPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Xác minh khuôn mặt</h1>
      <div className="flex h-32 items-center justify-center">Đang tải trạng thái…</div>
    </main>
  );
}