"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/modal";
import { Icon, type IconName } from "@/components/ui/icon";
import {
  submitEnrollment,
  revokeMyEnrollment,
  revokeEmployeeEnrollment,
  type EnrollmentStatus,
} from "@/features/face-enrollment/actions";
import type { FaceFixture } from "@/server/face/types";
import { CONSENT_SECTIONS, CONSENT_VERSION } from "@/features/face-enrollment/consent";
import { FaceScanCamera } from "@/features/face-verification/face-verification-redesigned";

type LocalState = "none" | EnrollmentStatus;
type View = "status" | "consent" | "capture" | "submitting" | "success" | "error";

interface EnrollmentRedesignedProps {
  initialState: LocalState;
  statusReason?: string | null;
  employeeId?: string;
  providerDemo?: boolean;
  showDevControls?: boolean;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

interface ProviderHealth {
  configured: boolean;
  demo: boolean;
  message: string;
}

const NEEDS_FORM: LocalState[] = ["none", "rejected", "revoked", "failed"];

const STEPS = ["Thông báo & đồng ý", "Chụp ảnh", "Hoàn tất"] as const;

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

export function EnrollmentRedesigned({
  initialState,
  statusReason = null,
  employeeId,
  providerDemo = false,
  showDevControls = false,
  onSuccess,
  onError,
  onComplete,
}: EnrollmentRedesignedProps) {
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

  // Trạng thái provider (chỉ để hiển thị).
  useEffect(() => {
    let alive = true;
    fetch("/api/health/face", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProviderHealth | null) => {
        if (alive && data) setHealth(data);
      })
      .catch(() => {});
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
    setRevoking(true);
    setError(null);
    try {
      const res = isAdminFlow && employeeId
        ? await revokeEmployeeEnrollment(employeeId)
        : await revokeMyEnrollment();
      if (!res.ok) {
        setConfirmingRevoke(false);
        setError({ code: res.code, message: res.message });
        setView("error");
        return;
      }
      setConfirmingRevoke(false);
      setLocalState("revoked");
      setConsent(false);
      setView("consent");
      router.refresh();
      onComplete?.();
    } catch {
      setConfirmingRevoke(false);
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
    <div className="flex flex-col gap-5">
      {/* Trạng thái dịch vụ */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-xs)]">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-[var(--radius-icon)] ring-1 ring-inset ${
              health === null
                ? "bg-[var(--surface-muted)] text-[var(--text-3)] ring-[var(--border)]"
                : health.configured
                  ? "bg-[var(--success-bg)] text-[var(--success)] ring-[var(--success-border)]"
                  : "bg-[var(--danger-bg)] text-[var(--danger)] ring-[var(--danger-border)]"
            }`}
          >
            <Icon name="shield" size={17} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-[var(--navy-800)]">
              {health === null
                ? "Đang kiểm tra dịch vụ nhận diện…"
                : health.configured
                  ? "Dịch vụ nhận diện sẵn sàng"
                  : "Dịch vụ nhận diện chưa cấu hình"}
            </p>
            <p className="text-[11.5px] text-[var(--text-3)]">
              Xác minh 1:1 · không lưu ảnh thô hoặc template sinh trắc
            </p>
          </div>
        </div>
        <Badge tone={health === null ? "neutral" : health.configured ? "success" : "danger"}>
          {health === null ? "Đang kết nối" : health.configured ? "Sẵn sàng" : "Cần cấu hình"}
        </Badge>
      </div>

      {providerBlocked ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-[13px] text-[var(--danger-strong)]">
          <Icon name="alert" size={17} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Chưa thể đăng ký khuôn mặt</p>
            <p className="mt-0.5">{health.message}</p>
            <p className="mt-1 text-[12px]">
              Liên hệ quản trị viên để cấu hình dịch vụ nhận diện. Trong lúc chờ, bạn vẫn có thể chấm công bằng phương thức thay thế.
            </p>
          </div>
        </div>
      ) : null}

      {/* Stepper */}
      {view !== "status" && view !== "success" ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-xs)]">
          <ol aria-label="Tiến trình đăng ký" className="flex items-center gap-1.5">
            {STEPS.map((label, index) => {
              const done = index < stepIndex;
              const current = index === stepIndex;
              return (
                <li key={label} className="flex flex-1 items-center gap-1.5" aria-current={current ? "step" : undefined}>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      done
                        ? "bg-[var(--success-bg)] text-[var(--success)] ring-1 ring-inset ring-[var(--success-border)]"
                        : current
                          ? "bg-[var(--brand)] text-white shadow-[0_6px_14px_-8px_rgba(37,99,235,0.9)]"
                          : "bg-[var(--surface-muted)] text-[var(--text-3)] ring-1 ring-inset ring-[var(--border)]"
                    }`}
                  >
                    {done ? <Icon name="check" size={13} /> : index + 1}
                  </span>
                  <span className={`hidden text-[12px] sm:inline ${current ? "font-semibold text-[var(--navy-800)]" : "text-[var(--text-2)]"}`}>
                    {label}
                  </span>
                  {index < STEPS.length - 1 ? <span aria-hidden="true" className="mx-1 h-px flex-1 bg-[var(--border)]" /> : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {/* Trạng thái hiện tại */}
      {view === "status" && statusMeta ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-icon)] ring-1 ring-inset ${
                statusMeta.tone === "success"
                  ? "bg-[var(--success-bg)] text-[var(--success)] ring-[var(--success-border)]"
                  : statusMeta.tone === "danger"
                    ? "bg-[var(--danger-bg)] text-[var(--danger)] ring-[var(--danger-border)]"
                    : statusMeta.tone === "warning"
                      ? "bg-[var(--warning-bg)] text-[var(--warning)] ring-[var(--warning-border)]"
                      : "bg-[var(--brand-soft)] text-[var(--brand)] ring-blue-100"
              }`}
            >
              <Icon name={statusMeta.icon} size={26} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{statusMeta.title}</CardTitle>
                <Badge tone={statusMeta.tone}>
                  <Icon name={statusMeta.icon} size={12} />
                  {localState === "active" ? "Đã kích hoạt" : localState === "pending" ? "Chờ duyệt" : localState === "needs_review" ? "Cần rà soát" : "Cần xử lý"}
                </Badge>
              </div>
              <CardDescription>{statusMeta.description}</CardDescription>
              {statusReason && (localState === "needs_review" || localState === "rejected" || localState === "failed") ? (
                <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[13px] text-[var(--text-2)]">
                  <span className="font-semibold text-[var(--navy-800)]">Ghi chú: </span>
                  {statusReason}
                </p>
              ) : null}
              <ul className="mt-3 grid gap-1.5 text-[12.5px] text-[var(--text-2)] sm:grid-cols-2">
                <li className="flex items-center gap-1.5"><Icon name="check" size={13} className="text-[var(--success)]" /> Chỉ dùng để xác minh chấm công</li>
                <li className="flex items-center gap-1.5"><Icon name="check" size={13} className="text-[var(--success)]" /> Không lưu ảnh thô / embedding</li>
                <li className="flex items-center gap-1.5"><Icon name="check" size={13} className="text-[var(--success)]" /> Có thể thu hồi bất cứ lúc nào</li>
                <li className="flex items-center gap-1.5"><Icon name="check" size={13} className="text-[var(--success)]" /> Luôn có phương thức thay thế</li>
              </ul>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            {localState === "active" && !isAdminFlow ? (
              <Button onClick={() => router.push("/check-in")}>
                <Icon name="camera" size={16} /> Chấm công ngay
              </Button>
            ) : null}
            {(localState === "pending" || localState === "needs_review") && (
              <Button
                onClick={() => {
                  setConsent(false);
                  setView("consent");
                }}
              >
                <Icon name="refresh" size={16} /> Đăng ký lại
              </Button>
            )}
            {localState === "rejected" || localState === "failed" || localState === "revoked" ? (
              <Button
                onClick={() => {
                  setConsent(false);
                  setView("consent");
                }}
              >
                <Icon name="scan-face" size={16} /> Đăng ký khuôn mặt
              </Button>
            ) : null}
            {(localState === "pending" || localState === "active" || localState === "needs_review") && (
              <Button variant="ghost" onClick={() => setConfirmingRevoke(true)} loading={revoking}>
                Thu hồi mẫu khuôn mặt
              </Button>
            )}
          </div>
        </Card>
      ) : null}

      {/* Consent */}
      {view === "consent" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <Card>
            {statusMeta && localState !== "none" ? (
              <div
                role="status"
                className={`mb-4 rounded-[var(--radius-control)] border px-3 py-2 text-[13px] ${
                  statusMeta.tone === "danger"
                    ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-strong)]"
                    : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-2)]"
                }`}
              >
                <p className="font-semibold">{statusMeta.title}</p>
                <p className="mt-0.5">{statusReason ?? statusMeta.description}</p>
              </div>
            ) : null}

            <CardTitle>Thông báo xử lý dữ liệu khuôn mặt</CardTitle>
            <CardDescription>
              Bản {CONSENT_VERSION} · Vui lòng đọc kỹ và đồng ý trước khi tiếp tục.
            </CardDescription>

            <div className="mt-4 space-y-3">
              {CONSENT_SECTIONS.map((section) => (
                <div key={section.title} className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--navy-800)]">
                    <Icon name="shield" size={14} className="text-[var(--brand)]" />
                    {section.title}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">{section.body}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:sticky lg:top-4">
            <CardTitle>Tóm tắt cam kết</CardTitle>
            <CardDescription>Bạn đang đồng ý đăng ký mẫu khuôn mặt để xác minh chấm công.</CardDescription>
            <ul className="mt-4 flex flex-col gap-2.5 text-[13px] text-[var(--text-2)]">
              {[
                "Xác minh 1:1 với mẫu của chính bạn",
                "Chỉ lưu mã tham chiếu, không lưu ảnh thô",
                "HR duyệt trước khi dùng để chấm công",
                "Có thể thu hồi mẫu khuôn mặt bất cứ lúc nào",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
                    <Icon name="check" size={10} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--border-strong)] text-[var(--brand)] focus:ring-[var(--brand)]"
                aria-label="Tôi đã đọc và đồng ý"
              />
              <span className="text-[12.5px] leading-relaxed text-[var(--text-2)]">
                {isAdminFlow
                  ? "Tôi xác nhận nhân viên đã đọc thông báo trên và đồng ý đăng ký khuôn mặt cho mục đích chấm công."
                  : "Tôi đã đọc thông báo trên và đồng ý đăng ký khuôn mặt cho mục đích chấm công."}
              </span>
            </label>

            <div className="mt-4 flex flex-col gap-2">
              <Button onClick={() => setView("capture")} disabled={providerBlocked || !consent} className="w-full">
                <Icon name="camera" size={16} /> Tiếp tục chụp ảnh
              </Button>
              {localState !== "none" ? (
                <Button variant="ghost" onClick={() => setView("status")}>
                  Quay lại trạng thái
                </Button>
              ) : null}
            </div>
            {!consent ? (
              <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[var(--text-3)]">
                <Icon name="info" size={13} /> Cần đánh dấu đồng ý để tiếp tục.
              </p>
            ) : null}
          </Card>
        </div>
      ) : null}

      {/* Camera */}
      {view === "capture" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_320px] lg:items-start">
          <Card>
            <CardTitle>Chụp ảnh khuôn mặt</CardTitle>
            <CardDescription>
              Đưa khuôn mặt vào giữa khung, nhìn thẳng camera, giữ yên và đảm bảo đủ sáng.
            </CardDescription>
            <div className="mt-4">
              <FaceScanCamera onCapture={onCapture} captureLabel="Chụp & đăng ký" />
            </div>
            {providerDemo && showDevControls ? (
              <label className="mt-4 flex flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)]">
                Kịch bản kiểm thử (chỉ môi trường dev)
                <select
                  value={fixture}
                  onChange={(e) => setFixture(e.target.value as FaceFixture)}
                  className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--navy-700)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)] sm:w-auto"
                >
                  <option value="good">good — liveness pass, đăng ký thành công</option>
                  <option value="blurry">blurry — chất lượng kém, yêu cầu chụp lại</option>
                  <option value="liveness-fail">liveness-fail — chống giả mạo thất bại</option>
                </select>
              </label>
            ) : null}
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardTitle>Trước khi chụp</CardTitle>
              <ul className="mt-3 flex flex-col gap-2 text-[13px] text-[var(--text-2)]">
                {[
                  "Đủ sáng, không ngược sáng",
                  "Nhìn thẳng camera, không nghiêng đầu",
                  "Chỉ một người trong khung hình",
                  "Không đội mũ/khẩu trang che khuôn mặt",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
                      <Icon name="check" size={10} />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-icon)] bg-[var(--brand-soft)] text-[var(--brand)] ring-1 ring-inset ring-blue-100">
                  <Icon name="shield" size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--navy-800)]">Quyền riêng tư</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-2)]">
                    Hệ thống chỉ kiểm tra chất lượng ảnh và gửi provider để tạo mẫu. Không lưu ảnh thô trên máy chủ.
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 px-0" onClick={() => setView("consent")}>
                <Icon name="arrow-right" size={14} className="rotate-180" /> Quay lại thông báo
              </Button>
            </Card>
          </div>
        </div>
      ) : null}

      {/* Đang gửi */}
      {view === "submitting" ? (
        <Card className="mx-auto w-full max-w-xl">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)] ring-1 ring-inset ring-blue-100">
              <Icon name="refresh" size={28} className="animate-spin" />
            </span>
            <div>
              <p className="text-lg font-bold text-[var(--navy-900)]">Đang xác minh và lưu đăng ký…</p>
              <p className="mt-1 text-[13px] text-[var(--text-2)]">Vui lòng không đóng trang này.</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Thành công */}
      {view === "success" ? (
        <Card className="mx-auto w-full max-w-xl border-[var(--success-border)]">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)] ring-1 ring-inset ring-[var(--success-border)]">
              <Icon name="check" size={36} />
            </span>
            <div>
              <h3 className="text-xl font-bold tracking-[-0.02em] text-[var(--navy-900)]">
                {resultStatus === "active" ? "Đăng ký thành công!" : "Đã gửi đăng ký!"}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-[var(--text-2)]">
                {resultStatus === "active"
                  ? isAdminFlow
                    ? "Khuôn mặt của nhân viên đã được kích hoạt và có thể dùng để chấm công."
                    : "Khuôn mặt đã được kích hoạt. Bạn có thể chấm công bằng khuôn mặt ngay bây giờ."
                  : "Đăng ký đã được ghi nhận và đang chờ HR duyệt. Bạn có thể chấm công bằng khuôn mặt sau khi HR duyệt."}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
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
        <Card className="mx-auto w-full max-w-xl border-[var(--danger-border)]">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-bg)] text-[var(--danger)] ring-1 ring-inset ring-[var(--danger-border)]">
              <Icon name="x" size={32} />
            </span>
            <div>
              <p role="alert" className="text-lg font-bold text-[var(--navy-900)]">Đăng ký chưa hoàn tất</p>
              <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-[var(--text-2)]">
                {error?.message ?? "Đã xảy ra lỗi không xác định."}
              </p>
              {error?.code ? <p className="mt-1 font-mono text-[11px] text-[var(--text-3)]">Mã lỗi: {error.code}</p> : null}
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

      <ConfirmModal
        open={confirmingRevoke}
        onClose={() => { if (!revoking) setConfirmingRevoke(false); }}
        onConfirm={onRevoke}
        title="Thu hồi mẫu khuôn mặt"
        message="Mẫu tham chiếu sẽ bị xóa và bạn phải đăng ký lại để chấm công bằng khuôn mặt. Tiếp tục thu hồi?"
        confirmLabel="Thu hồi"
        cancelLabel="Hủy"
        danger
        loading={revoking}
      />
    </div>
  );
}
