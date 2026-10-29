"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon, type IconName } from "@/components/ui/icon";
import { CameraCapture } from "@/features/face-enrollment/camera-capture";
import { CONSENT_SECTIONS, CONSENT_VERSION } from "@/features/face-enrollment/consent";
import {
  submitEnrollment,
  revokeMyEnrollment,
  revokeEmployeeEnrollment,
  type EnrollmentStatus,
} from "@/features/face-enrollment/actions";
import type { FaceFixture } from "@/server/face/types";

type LocalState = "none" | EnrollmentStatus;
type View = "status" | "consent" | "capture" | "submitting" | "success" | "error";

const NEEDS_FORM: LocalState[] = ["none", "rejected", "revoked", "failed"];

const STEPS = ["Thông báo & đồng ý", "Chụp ảnh", "Hoàn tất"] as const;

interface EnrollmentWorkflowProps {
  /** Trạng thái enrollment ban đầu của employee */
  initialState: LocalState;
  /** Lý do thất bại/từ chối (nếu có) */
  statusReason?: string | null;
  /** HR đăng ký hộ nhân viên */
  employeeId?: string;
  /** Provider demo mode */
  providerDemo?: boolean;
  /** Callback khi enrollment thành công */
  onSuccess?: () => void;
  /** Callback khi enrollment thất bại */
  onError?: (error: string) => void;
  /** Callback khi hoàn tất */
  onComplete?: () => void;
}

interface ProviderHealth {
  configured: boolean;
  demo: boolean;
  message: string;
}

const STATUS_META: Record<
  EnrollmentStatus,
  { tone: "success" | "warning" | "danger" | "neutral" | "info"; icon: IconName; title: string; description: string }
> = {
  active: {
    tone: "success",
    icon: "check",
    title: "Khuôn mặt đã được kích hoạt",
    description: "Bạn có thể chấm công vào/ra bằng khuôn mặt ngay bây giờ.",
  },
  pending: {
    tone: "warning",
    icon: "clock",
    title: "Đăng ký đang chờ duyệt",
    description:
      "HR cần duyệt đăng ký trước khi bạn chấm công bằng khuôn mặt. Trong lúc chờ, bạn vẫn có thể dùng phương thức thay thế ở trang chấm công.",
  },
  needs_review: {
    tone: "warning",
    icon: "alert",
    title: "Đăng ký cần HR rà soát",
    description: "Ảnh đăng ký chưa đủ chắc chắn. HR sẽ kiểm tra và phản hồi, hoặc bạn có thể đăng ký lại.",
  },
  failed: {
    tone: "danger",
    icon: "x",
    title: "Đăng ký trước đó không thành công",
    description: "Bạn có thể thử đăng ký lại. Hãy chú ý ánh sáng và giữ khuôn mặt trong khung.",
  },
  rejected: {
    tone: "danger",
    icon: "x",
    title: "Đăng ký bị từ chối",
    description: "HR đã từ chối đăng ký trước đó. Bạn có thể đăng ký lại sau khi khắc phục lý do bên dưới.",
  },
  revoked: {
    tone: "neutral",
    icon: "info",
    title: "Mẫu khuôn mặt đã được thu hồi",
    description: "Mẫu tham chiếu đã bị xóa. Bạn có thể đăng ký lại bất cứ lúc nào.",
  },
};

export function EnrollmentWorkflow({
  initialState,
  statusReason = null,
  employeeId,
  providerDemo = false,
  onSuccess,
  onError,
  onComplete,
}: EnrollmentWorkflowProps) {
  const router = useRouter();
  const isAdminFlow = Boolean(employeeId);

  const [localState, setLocalState] = useState<LocalState>(initialState);
  const [view, setView] = useState<View>(() =>
    NEEDS_FORM.includes(initialState) ? "consent" : "status",
  );
  const [consent, setConsent] = useState(false);
  const [fixture, setFixture] = useState<FaceFixture>("good");
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [resultStatus, setResultStatus] = useState<"pending" | "active">("pending");
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);

  // Trạng thái provider (chỉ để hiển thị — quyết định thật nằm ở server).
  useEffect(() => {
    let alive = true;
    fetch("/api/health/face", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProviderHealth | null) => {
        if (alive && data) setHealth(data);
      })
      .catch(() => {
        // Không chặn luồng đăng ký nếu health check lỗi.
      });
    return () => {
      alive = false;
    };
  }, []);

  const onCapture = useCallback(
    async (frameDataUrl: string) => {
      if (!consent) {
        setError({ code: "CONSENT_REQUIRED", message: "Bạn cần đồng ý thông báo xử lý dữ liệu trước khi chụp." });
        setView("error");
        return;
      }
      setError(null);
      setView("submitting");
      try {
        const res = await submitEnrollment({
          frameDataUrl,
          consentAccepted: consent,
          consentVersion: CONSENT_VERSION,
          employeeId,
          fixture: providerDemo ? fixture : undefined,
        });
        if (!res.ok) {
          setError({ code: res.code, message: res.message });
          setView("error");
          onError?.(`${res.code}: ${res.message}`);
          return;
        }
        setResultStatus(res.status ?? "pending");
        setLocalState(res.status ?? "pending");
        setView("success");
        onSuccess?.();
        router.refresh();
      } catch {
        setError({
          code: "NETWORK_ERROR",
          message: "Không gửi được đăng ký (mất mạng hoặc máy chủ không phản hồi). Vui lòng thử lại.",
        });
        setView("error");
      }
    },
    [consent, employeeId, fixture, providerDemo, router, onError, onSuccess],
  );

  const onRevoke = useCallback(async () => {
    setConfirmingRevoke(false);
    setRevoking(true);
    setError(null);
    try {
      const res = isAdminFlow && employeeId
        ? await revokeEmployeeEnrollment(employeeId)
        : await revokeMyEnrollment();
      if (!res.ok) {
        setError({ code: res.code, message: res.message });
        setView("error");
        return;
      }
      setLocalState("revoked");
      setConsent(false);
      setView("consent");
      router.refresh();
      onComplete?.();
    } catch {
      setError({ code: "NETWORK_ERROR", message: "Không thu hồi được (mất mạng). Vui lòng thử lại." });
      setView("error");
    } finally {
      setRevoking(false);
    }
  }, [router, onComplete, isAdminFlow, employeeId]);

  const stepIndex = view === "consent" || view === "error" ? 0 : view === "capture" ? 1 : 2;
  const statusMeta = localState === "none" ? null : STATUS_META[localState];
  const providerBlocked = health !== null && !health.configured;

  return (
    <div className="flex flex-col gap-4">
      {/* Provider status */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={health === null ? "neutral" : health.configured ? (health.demo ? "warning" : "success") : "danger"}>
          {health === null
            ? "Đang kiểm tra dịch vụ…"
            : health.configured
              ? health.demo
                ? "DEMO — không dùng chấm công thật"
                : "Dịch vụ nhận diện sẵn sàng"
              : "Dịch vụ nhận diện chưa cấu hình"}
        </Badge>
        {providerDemo ? <Badge tone="info">DEMO MODE</Badge> : null}
      </div>

      {providerBlocked ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Chưa thể đăng ký khuôn mặt</p>
            <p>{health.message}</p>
            <p className="mt-1 text-xs">
              Liên hệ quản trị viên để cấu hình dịch vụ nhận diện. Trong lúc chờ, bạn vẫn có thể chấm công bằng phương thức thay thế.
            </p>
          </div>
        </div>
      ) : null}

      {/* Stepper */}
      {view !== "status" && view !== "success" ? (
        <ol aria-label="Tiến trình đăng ký" className="flex items-center gap-1 text-xs">
          {STEPS.map((label, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li key={label} className="flex flex-1 items-center gap-1" aria-current={current ? "step" : undefined}>
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-semibold ${
                    done
                      ? "bg-[var(--success-bg)] text-[var(--success)]"
                      : current
                        ? "bg-[var(--brand)] text-white"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? <Icon name="check" size={14} /> : index + 1}
                </span>
                <span className={current ? "font-medium text-slate-800" : "text-slate-500"}>{label}</span>
                {index < STEPS.length - 1 ? <span aria-hidden="true" className="mx-1 h-px flex-1 bg-slate-200" /> : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {/* Trạng thái hiện tại */}
      {view === "status" && statusMeta ? (
        <Card>
          <div className="flex items-start gap-3">
            <span className="mt-0.5">
              <Badge tone={statusMeta.tone}>
                <Icon name={statusMeta.icon} size={14} />
              </Badge>
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle>{statusMeta.title}</CardTitle>
              <CardDescription>{statusMeta.description}</CardDescription>
              {statusReason && (localState === "needs_review" || localState === "rejected" || localState === "failed") ? (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-medium">Ghi chú: </span>
                  {statusReason}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {localState === "active" && !isAdminFlow ? (
              <Button onClick={() => router.push("/check-in")}>
                <Icon name="camera" size={16} /> Chấm công ngay
              </Button>
            ) : null}
            {localState === "pending" ? (
              <Button variant="secondary" onClick={() => router.refresh()}>
                <Icon name="refresh" size={16} /> Tải lại trạng thái
              </Button>
            ) : null}
            {localState === "needs_review" ? (
              <Button
                onClick={() => {
                  setConsent(false);
                  setView("consent");
                }}
              >
                <Icon name="refresh" size={16} /> Đăng ký lại
              </Button>
            ) : null}
            {localState === "pending" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setConsent(false);
                  setView("consent");
                }}
              >
                <Icon name="refresh" size={16} /> Đăng ký lại
              </Button>
            ) : null}
            {localState === "pending" || localState === "active" || localState === "needs_review" ? (
              <Button variant="ghost" onClick={() => setConfirmingRevoke(true)} loading={revoking}>
                Thu hồi mẫu khuôn mặt
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Consent */}
      {view === "consent" ? (
        <Card>
          {statusMeta && localState !== "none" ? (
            <div
              role="status"
              className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                statusMeta.tone === "danger"
                  ? "border border-red-200 bg-red-50 text-red-700"
                  : "border border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <p className="font-medium">{statusMeta.title}</p>
              {statusReason ? <p className="mt-1">{statusReason}</p> : <p className="mt-1">{statusMeta.description}</p>}
            </div>
          ) : null}

          <CardTitle>Thông báo xử lý dữ liệu khuôn mặt (bản {CONSENT_VERSION})</CardTitle>
          <CardDescription>Vui lòng đọc kỹ và đồng ý trước khi tiếp tục.</CardDescription>

          <div className="mt-4 space-y-3">
            {CONSENT_SECTIONS.map((section) => (
              <div key={section.title} className="border-l-2 border-slate-200 pl-4">
                <p className="text-sm font-medium text-slate-800">{section.title}</p>
                <p className="mt-1 text-sm text-slate-600">{section.body}</p>
              </div>
            ))}
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--brand)] focus:ring-[var(--brand)]"
              aria-label="Tôi đã đọc và đồng ý"
            />
            <span className="mt-0.5 text-sm text-slate-700">
              {isAdminFlow
                ? "Tôi xác nhận nhân viên đã đọc thông báo trên và đồng ý đăng ký khuôn mặt cho mục đích chấm công."
                : "Tôi đã đọc thông báo trên và đồng ý đăng ký khuôn mặt cho mục đích chấm công."}
            </span>
          </label>

          <div className="mt-6 flex justify-end gap-2">
            {localState !== "none" ? (
              <Button variant="ghost" onClick={() => setView("status")}>
                Quay lại
              </Button>
            ) : null}
            <Button onClick={() => setView("capture")} disabled={!consent || providerBlocked}>
              Tiếp tục
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Camera */}
      {view === "capture" ? (
        <Card>
          <CardTitle>Chụp ảnh khuôn mặt</CardTitle>
          <CardDescription>
            Đưa khuôn mặt vào giữa khung, nhìn thẳng camera, giữ yên và đảm bảo đủ sáng. Hệ thống chỉ kiểm tra chất lượng ảnh, không lưu ảnh thô.
          </CardDescription>

          <ul className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-3">
            <li className="flex items-center gap-1"><Icon name="check" size={14} /> Đủ sáng, không ngược sáng</li>
            <li className="flex items-center gap-1"><Icon name="check" size={14} /> Nhìn thẳng, không che mặt</li>
            <li className="flex items-center gap-1"><Icon name="check" size={14} /> Chỉ một người trong khung</li>
          </ul>

          <div className="mt-4">
            <CameraCapture onCapture={onCapture} captureLabel="Chụp & đăng ký" showGuide showPrivacyNotice />
          </div>

          {providerDemo ? (
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Kịch bản DEMO (chỉ local/test)</span>
              <select
                value={fixture}
                onChange={(e) => setFixture(e.target.value as FaceFixture)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="good">good — liveness pass, đăng ký thành công</option>
                <option value="blurry">blurry — chất lượng kém, yêu cầu chụp lại</option>
                <option value="liveness-fail">liveness-fail — chống giả mạo thất bại</option>
              </select>
            </label>
          ) : null}

          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setView("consent")}>
              Quay lại
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Đang gửi */}
      {view === "submitting" ? (
        <Card>
          <CardTitle>Đang xử lý đăng ký</CardTitle>
          <div className="mt-4 flex flex-col items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand)] text-white">
              <span className="animate-spin"><Icon name="refresh" size={28} /></span>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">Đang xác minh và lưu đăng ký…</p>
              <p className="mt-1 text-sm text-slate-500">Vui lòng không đóng trang này.</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Thành công */}
      {view === "success" ? (
        <Card>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
              <Icon name="check" size={36} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                {resultStatus === "active" ? "Đăng ký thành công!" : "Đã gửi đăng ký!"}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-slate-600">
                {resultStatus === "active"
                  ? isAdminFlow
                    ? "Khuôn mặt của nhân viên đã được kích hoạt và có thể dùng để chấm công."
                    : "Khuôn mặt đã được kích hoạt. Bạn có thể chấm công bằng khuôn mặt ngay bây giờ."
                  : "Đăng ký đã được ghi nhận và đang chờ HR duyệt. Bạn sẽ chấm công bằng khuôn mặt được sau khi HR duyệt."}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {resultStatus === "active" && !isAdminFlow ? (
                <Button onClick={() => router.push("/check-in")}>
                  <Icon name="camera" size={16} /> Chấm công ngay
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => router.push(isAdminFlow ? "/admin/enrollments" : "/dashboard")}>
                {isAdminFlow ? "Về hàng đợi duyệt" : "Về trang chủ"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Lỗi */}
      {view === "error" ? (
        <Card className="border-[var(--danger)]">
          <CardTitle>
            <span className="text-[var(--danger)]">Đăng ký chưa hoàn tất</span>
          </CardTitle>
          <div className="mt-4 flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-bg)] text-[var(--danger)]">
              <Icon name="x" size={32} />
            </div>
            <div>
              <p role="alert" className="max-w-md text-slate-700">
                {error?.message ?? "Đã xảy ra lỗi không xác định."}
              </p>
              {error?.code ? <p className="mt-1 text-xs text-slate-400">Mã lỗi: {error.code}</p> : null}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => { setError(null); setView("capture"); }}>
                <Icon name="refresh" size={16} /> Chụp lại
              </Button>
              <Button variant="ghost" onClick={() => { setError(null); setView("consent"); }}>
                Quay lại
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmingRevoke}
        title="Thu hồi mẫu khuôn mặt"
        message="Mẫu tham chiếu sẽ bị xóa và bạn phải đăng ký lại để chấm công bằng khuôn mặt. Tiếp tục thu hồi?"
        confirmLabel="Thu hồi"
        danger
        loading={revoking}
        onConfirm={onRevoke}
        onCancel={() => setConfirmingRevoke(false)}
      />
    </div>
  );
}
