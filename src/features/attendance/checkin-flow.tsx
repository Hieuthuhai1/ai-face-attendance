"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DemoBanner } from "@/components/ui/demo-banner";
import { Input } from "@/components/ui/input";
import { CameraCapture } from "@/features/face-enrollment/camera-capture";
import { fallbackCheck, verifyCheck, type CheckResult } from "@/features/attendance/actions";
import { newIdempotencyKey } from "@/lib/idempotency";
import type { FaceFixture } from "@/server/face/types";

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

export function CheckInFlow(props: { status: TodayStatus; providerDemo: boolean }) {
  const router = useRouter();
  const [direction, setDirection] = useState<"check_in" | "check_out">(
    props.status.canCheckOut ? "check_out" : "check_in",
  );
  const [fixture, setFixture] = useState<FaceFixture>("good");
  const [key, setKey] = useState(() => newIdempotencyKey());
  const [ui, setUi] = useState<UiState>({ kind: "idle" });
  const [showFallback, setShowFallback] = useState(false);
  const [reason, setReason] = useState("");

  const s = props.status;

  async function onCapture(frameDataUrl: string) {
    setUi({ kind: "verifying" });
    let res: CheckResult;
    try {
      res = await verifyCheck({ direction, frameDataUrl, fixture: props.providerDemo ? fixture : undefined, idempotencyKey: key });
    } catch {
      setUi({ kind: "failed", code: "NETWORK_ERROR", message: "Mất mạng khi gửi. Bấm Thử lại (dùng cùng mã, không tạo trùng)." });
      return;
    }
    if (!res.ok) {
      setUi({ kind: "failed", code: res.code, message: res.message });
      return;
    }
    setUi({ kind: "result", res });
    setKey(newIdempotencyKey()); // attempt mới dùng key mới
    router.refresh();
  }

  function retry() {
    setUi({ kind: "idle" }); // giữ nguyên key → retry không trùng
  }

  async function onFallback(e: React.FormEvent) {
    e.preventDefault();
    setUi({ kind: "verifying" });
    const res = await fallbackCheck({ direction, reason, idempotencyKey: key });
    if (!res.ok) {
      setUi({ kind: "failed", code: res.code, message: res.message });
      return;
    }
    setUi({ kind: "result", res });
    setKey(newIdempotencyKey());
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

  return (
    <div className="flex flex-col gap-4">
      <DemoBanner />
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
          <p role="status" className="font-medium">
            {ui.res.status === "success" ? "✓ " : ui.res.status === "fallback" ? "○ " : "⚑ "}
            {ui.res.message}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(ui.res.occurred_at).toLocaleString("vi-VN")}
            {ui.res.duplicate ? " · (bản ghi đã tồn tại — chống trùng)" : ""}
          </p>
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={() => setUi({ kind: "idle" })}>Tiếp tục</Button>
          </div>
        </Card>
      ) : ui.kind === "failed" ? (
        <Card>
          <p role="alert" className="font-medium text-red-700">✕ {ui.code}</p>
          <p className="mt-1 text-sm text-slate-600">{ui.message}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={retry}>Thử lại (cùng mã)</Button>
            <Button size="sm" variant="ghost" onClick={() => { setKey(newIdempotencyKey()); setShowFallback(true); }}>
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
              <p role="status" className="text-sm">◌ Đang xác minh, vui lòng giữ nguyên…</p>
            ) : (
              <CameraCapture onCapture={onCapture} />
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
            <div><Button type="submit">Gửi ghi nhận thay thế</Button></div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
