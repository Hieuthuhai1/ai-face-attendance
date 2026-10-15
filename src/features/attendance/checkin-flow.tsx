"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DemoBanner } from "@/components/ui/demo-banner";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { CameraCapture } from "@/features/face-enrollment/camera-capture";
import { fallbackCheck, verifyCheck, type CheckResult } from "@/features/attendance/actions";
import type { FaceFixture } from "@/server/face/types";

/** Key cho attempt mới (Web Crypto, chạy sau hydrate nên không lệch SSR). */
function newClientKey(): string {
  return `evt_${crypto.randomUUID()}`;
}

export interface TodayStatus {
  eligible: boolean;
  hasEnrollment?: boolean;
  shift?: { name: string; start_time: string; end_time: string; overnight: boolean } | null;
  lastEvent?: { event_type: string; status: string; occurred_at: string } | null;
  canCheckIn?: boolean;
  canCheckOut?: boolean;
}

type UiState =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "result"; res: Extract<CheckResult, { ok: true }> }
  | { kind: "failed"; code: string; message: string };

const STEPS = ["1. Chọn thao tác", "2. Quét & xác minh", "3. Kết quả"] as const;

const FAILED_META: Record<string, { title: string; hint: string }> = {
  LIVENESS_FAILED: {
    title: "Không xác định được người thật",
    hint: "Thử lại đủ sáng, nhìn thẳng. Mock hiện tại không có liveness thật.",
  },
  NO_MATCH: {
    title: "Khuôn mặt không khớp",
    hint: "Thử lại hoặc dùng phương thức thay thế. Hệ thống không kết luận gian lận.",
  },
  PROVIDER_UNAVAILABLE: {
    title: "Dịch vụ nhận diện bận",
    hint: "Giữ nguyên trang, bấm Thử lại (cùng mã, không tạo trùng).",
  },
  NETWORK_ERROR: {
    title: "Mất kết nối",
    hint: "Kiểm tra mạng rồi bấm Thử lại (cùng mã).",
  },
  NO_SHIFT: { title: "Không có ca làm", hint: "Liên hệ HR nếu cần bổ sung phân ca." },
  NO_ENROLLMENT: { title: "Chưa có mẫu khuôn mặt", hint: "Đăng ký và chờ HR duyệt trước." },
  OUT_WITHOUT_IN: { title: "Chưa có lượt vào", hint: "Nếu quên check-in, gửi yêu cầu chỉnh công." },
  ALREADY_CHECKED_IN: { title: "Đã check-in rồi", hint: "Hãy check-out khi ra về." },
  RATE_LIMITED: { title: "Thao tác quá nhanh", hint: "Nghỉ ít phút rồi thử lại." },
};

export function CheckInFlow(props: { status: TodayStatus; providerDemo: boolean }) {
  const router = useRouter();
  const [direction, setDirection] = useState<"check_in" | "check_out">(
    props.status.canCheckOut ? "check_out" : "check_in",
  );
  const [fixture, setFixture] = useState<FaceFixture>("good");
  // Idempotency key giữ trong ref (không render) để SSR/client hydration khớp nhau.
  // Sinh bằng Web Crypto tại thời điểm submit — không import node:crypto vào browser.
  const keyRef = useRef("");
  function ensureKey(): string {
    if (!keyRef.current) keyRef.current = newClientKey();
    return keyRef.current;
  }
  function newAttempt() {
    keyRef.current = newClientKey();
  }
  const [ui, setUi] = useState<UiState>({ kind: "idle" });
  const [showFallback, setShowFallback] = useState(false);
  const [reason, setReason] = useState("");

  const s = props.status;
  const step = ui.kind === "idle" ? 0 : ui.kind === "verifying" ? 1 : 2;

  async function onCapture(frameDataUrl: string) {
    setUi({ kind: "verifying" });
    let res: CheckResult;
    try {
      res = await verifyCheck({ direction, frameDataUrl, fixture: props.providerDemo ? fixture : undefined, idempotencyKey: ensureKey() });
    } catch {
      setUi({ kind: "failed", code: "NETWORK_ERROR", message: "Mất mạng khi gửi. Bấm Thử lại (dùng cùng mã, không tạo trùng)." });
      return;
    }
    if (!res.ok) {
      setUi({ kind: "failed", code: res.code, message: res.message });
      return;
    }
    setUi({ kind: "result", res });
    newAttempt();
    router.refresh();
  }

  function retry() {
    setUi({ kind: "idle" });
  }

  function newCapture() {
    newAttempt();
    setUi({ kind: "idle" });
  }

  async function onFallback(e: React.FormEvent) {
    e.preventDefault();
    setUi({ kind: "verifying" });
    const res = await fallbackCheck({ direction, reason, idempotencyKey: ensureKey() });
    if (!res.ok) {
      setUi({ kind: "failed", code: res.code, message: res.message });
      return;
    }
    setUi({ kind: "result", res });
    newAttempt();
    setShowFallback(false);
    router.refresh();
  }

  if (!s.eligible) {
    return (
      <Card>
        <CardTitle>Không đủ điều kiện</CardTitle>
        <CardDescription>Tài khoản chưa phải nhân viên đang làm việc. Liên hệ HR.</CardDescription>
      </Card>
    );
  }
  if (!s.hasEnrollment) {
    return (
      <Card>
        <CardTitle>Chưa có mẫu khuôn mặt</CardTitle>
        <CardDescription>Đăng ký khuôn mặt và chờ HR duyệt trước khi chấm công.</CardDescription>
      </Card>
    );
  }

  const failed = ui.kind === "failed" ? (FAILED_META[ui.code] ?? { title: `Lỗi (${ui.code})`, hint: ui.message }) : null;

  return (
    <div className="flex flex-col gap-4">
      <DemoBanner />

      {/* Stepper */}
      <ol aria-label="Tiến trình chấm công" className="flex items-center gap-1 text-xs">
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
          {s.shift ? `Ca: ${s.shift.name} (${s.shift.start_time}–${s.shift.end_time}${s.shift.overnight ? ", qua đêm" : ""})` : "Hôm nay không có ca làm"}
        </CardTitle>
        <CardDescription>
          {s.lastEvent
            ? `Gần nhất: ${s.lastEvent.event_type} lúc ${new Date(s.lastEvent.occurred_at).toLocaleString("vi-VN")} (${s.lastEvent.status})`
            : "Chưa có bản ghi hôm nay."}
        </CardDescription>
        <div className="mt-3 flex gap-2" role="group" aria-label="Chọn hành động">
          <Button variant={direction === "check_in" ? "primary" : "secondary"} onClick={() => { setDirection("check_in"); setUi({ kind: "idle" }); }} disabled={!s.canCheckIn}>
            Chấm công vào
          </Button>
          <Button variant={direction === "check_out" ? "primary" : "secondary"} onClick={() => { setDirection("check_out"); setUi({ kind: "idle" }); }} disabled={!s.canCheckOut}>
            Chấm công ra
          </Button>
        </div>
      </Card>

      {ui.kind === "result" ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className={ui.res.status === "success" ? "text-[var(--success)]" : "text-[var(--warning)]"}>
              <Icon name={ui.res.status === "success" ? "check" : ui.res.status === "fallback" ? "clock" : "flag"} size={40} />
            </span>
            <p role="status" className="text-lg font-semibold">
              {ui.res.status === "success"
                ? direction === "check_in" ? "Check-in thành công" : "Check-out thành công"
                : ui.res.status === "fallback" ? "Đã ghi nhận thay thế" : "Chờ HR rà soát"}
            </p>
            {/* Giờ server — chỉ hiện sau khi backend xác nhận và trả về */}
            <p className="tnum text-3xl font-bold">
              {new Date(ui.res.occurred_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="text-sm text-slate-500">
              {new Date(ui.res.occurred_at).toLocaleDateString("vi-VN")} · giờ do server ghi nhận
              {ui.res.duplicate ? " · (bản ghi đã tồn tại — chống trùng)" : ""}
            </p>
            <p className="text-sm text-slate-600">{ui.res.message}</p>
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setUi({ kind: "idle" })}>Tiếp tục</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowFallback(true); }}>Dùng phương thức thay thế</Button>
          </div>
        </Card>
      ) : ui.kind === "failed" && failed ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="text-[var(--danger)]"><Icon name="x" size={36} /></span>
            <p role="alert" className="text-lg font-semibold">{failed.title}</p>
            <p className="text-sm text-slate-600">{failed.hint}</p>
            <p className="text-xs text-slate-400">Mã lỗi: {ui.code} (để đối chiếu với HR/kỹ thuật)</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={retry}>Thử lại (cùng mã)</Button>
            <Button size="sm" variant="secondary" onClick={newCapture}>Chụp lại (mã mới)</Button>
            <Button size="sm" variant="ghost" onClick={() => { newAttempt(); setShowFallback(true); }}>
              Dùng phương thức thay thế
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <CardTitle>Xác minh khuôn mặt — {direction === "check_in" ? "vào" : "ra"}</CardTitle>
          {props.providerDemo ? (
            <select value={fixture} onChange={(e) => setFixture(e.target.value as FaceFixture)} aria-label="Kịch bản mock" className="mt-2 h-10 rounded-lg border border-slate-300 px-3 text-sm">
              <option value="good">good — pass (confidence cao)</option>
              <option value="blurry">blurry — confidence thấp → HR rà soát</option>
              <option value="liveness-fail">liveness-fail — thất bại</option>
              <option value="no-match">no-match — không khớp</option>
            </select>
          ) : null}
          <div className="mt-3">
            {ui.kind === "verifying" ? (
              <div role="status" className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="animate-spin text-[var(--info)]"><Icon name="refresh" size={32} /></span>
                <p className="font-medium">Đang xác minh, vui lòng giữ nguyên trang…</p>
                <p className="text-sm text-slate-500">Hệ thống đang đối chiếu với mẫu của bạn và ghi nhận giờ server. Chưa hiển thị thành công cho tới khi backend xác nhận.</p>
              </div>
            ) : (
              <CameraCapture onCapture={onCapture} showGuide />
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
          <form onSubmit={onFallback} className="mt-2 flex flex-col gap-2">
            <Input label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)} required hint="VD: camera hỏng, mất mạng, nhận diện lỗi liên tục." />
            <div><Button type="submit" loading={ui.kind === "verifying"}>Gửi ghi nhận thay thế</Button></div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
