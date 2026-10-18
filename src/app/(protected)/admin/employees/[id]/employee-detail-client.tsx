"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { LoadingState, EmptyState } from "@/components/ui/states";

interface EmployeeDetailData {
  id: string;
  employee: {
    id: string;
    employee_code: string;
    title: string | null;
    employment_status: string;
    department_id: string | null;
    manager_id: string | null;
    hired_at: string | null;
    terminated_at: string | null;
    department: { name: string }[] | null;
    manager: { employee_code: string }[] | null;
    profile: { display_name: string; email: string; is_active: boolean; created_at: string }[] | null;
  };
  faceEnrollment: {
    status: string;
    quality: number | null;
    consent_version: string | null;
    created_at: string | null;
    provider: string | null;
  } | null;
  attendanceEvents: Array<{
    event_type: string;
    status: string;
    occurred_at: string;
    method: string;
    confidence: number | null;
    liveness_status: string | null;
  }>;
  adjustments: Array<{
    work_date: string;
    requested_in: string | null;
    requested_out: string | null;
    reason: string;
    status: string;
    resolution_note: string | null;
    created_at: string;
  }>;
  leaves: Array<{
    id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string | null;
    status: string;
    created_at: string;
  }>;
  assignments: Array<{
    effective_from: string;
    effective_to: string | null;
    shift: { name: string; start_time: string; end_time: string; overnight: boolean; color: string }[];
  }>;
}

interface EmployeeDetailClientProps {
  data: EmployeeDetailData;
}

export function EmployeeDetailClient({ data }: EmployeeDetailClientProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const { employee, faceEnrollment, attendanceEvents, adjustments, leaves, assignments } = data;

  const profile = (employee.profile as { display_name: string; email: string; is_active: boolean; created_at: string }[])?.[0] || null;
  const department = (employee.department as { name: string }[])?.[0] || null;
  const manager = (employee.manager as { employee_code: string }[])?.[0] || null;

  const faceEnrollmentData = faceEnrollment;
  const faceStatus = faceEnrollmentData?.status || "none";
  const faceQuality = faceEnrollmentData?.quality;

  const faceStatusConfig = {
    active: { label: "Đã đăng ký", color: "success" },
    pending: { label: "Chờ duyệt", color: "warning" },
    rejected: { label: "Đã từ chối", color: "danger" },
    revoked: { label: "Đã thu hồi", color: "neutral" },
    none: { label: "Chưa đăng ký", color: "neutral" },
  } as const;

  const tabs = [
    { key: "overview", label: "Tổng quan", icon: "home" },
    { key: "work_info", label: "Thông tin công việc", icon: "briefcase" },
    { key: "schedule", label: "Lịch làm việc", icon: "calendar" },
    { key: "attendance", label: "Lịch sử chấm công", icon: "clock" },
    { key: "requests", label: "Đơn từ", icon: "file" },
    { key: "face_enrollment", label: "Thiết lập nhận diện", icon: "user" },
  ];

  const name = profile?.display_name || "—";
  const email = profile?.email || "—";
  const isProfileActive = profile?.is_active ?? false;

  // Helper function to render work schedule
  function renderWorkSchedule() {
    if (assignments && assignments.length > 0) {
      return (
        <div className="space-y-2">
          {assignments.slice(0, 3).map((a: any, i: number) => {
            const shift = (a.shift as any[])?.[0];
            return (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                <div>
                  <p className="font-medium text-slate-900">{shift?.name || "Ca không tên"}</p>
                  <p className="text-sm text-slate-500">
                    {shift?.start_time || "—"} – {shift?.end_time || "—"}{" "}
                    {shift?.overnight ? "(qua đêm)" : ""}
                  </p>
                </div>
                <span className="text-sm text-slate-500">
                  Từ {new Date(a.effective_from).toLocaleDateString("vi-VN")}
                  {a.effective_to
                    ? " đến " + new Date(a.effective_to).toLocaleDateString("vi-VN")
                    : " (chưa hết hạn)"}
                </span>
              </div>
            );
          })}
          {assignments.length > 3 && (
            <p className="text-sm text-slate-500 text-center py-2">
              Và {assignments.length - 3} ca khác...
            </p>
          )}
        </div>
      );
    }
    return (
      <EmptyState title="Chưa phân ca" description="Nhân viên chưa được phân ca làm việc nào." />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9V6a2 2 0 00-2-2H8a2 2 0 00-2 2v7m8 0v5m0-8v8m0 0l-4-4m4 4l4-4m0 0H4a2 2 0 01-2-2v-7a2 2 0 012-2h12a2 2 0 012 2v7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{profile?.display_name || "—"}</h1>
              <p className="text-sm text-slate-500">{email}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={isProfileActive ? "success" : "danger"}>
              <Icon name="user" size={12} /> Hồ sơ {isProfileActive ? "Hoạt động" : "Vô hiệu"}
            </Badge>
            <Badge tone={employee.employment_status === "active" ? "success" : "danger"}>
              <Icon name={employee.employment_status === "active" ? "check" : "x"} size={12} />
              {employee.employment_status === "active" ? "Đang làm việc" : employee.employment_status === "inactive" ? "Tạm nghỉ" : "Đã nghỉ việc"}
            </Badge>
            <Badge tone={faceStatusConfig[faceStatus as keyof typeof faceStatusConfig]?.color || "neutral"}>
              <Icon name="user" size={12} /> {faceStatusConfig[faceStatus as keyof typeof faceStatusConfig]?.label || "Không xác định"}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Mã nhân viên</p>
            <p className="mt-1 font-semibold text-slate-900">{employee.employee_code}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Phòng ban</p>
            <p className="mt-1 font-medium text-slate-900">{department?.name || "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Quản lý trực tiếp</p>
            <p className="mt-1 font-medium text-slate-900">{manager?.employee_code || "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Chức danh</p>
            <p className="mt-1 font-medium text-slate-900">{employee.title || "—"}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Ngày tuyển dụng</p>
            <p className="mt-1 font-medium text-slate-900">{employee.hired_at ? new Date(employee.hired_at).toLocaleDateString("vi-VN") : "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Ngày nghỉ việc</p>
            <p className="mt-1 font-medium text-slate-900">{employee.terminated_at ? new Date(employee.terminated_at).toLocaleDateString("vi-VN") : "—"}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Tài khoản tạo lúc</p>
            <p className="mt-1 font-medium text-slate-900">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString("vi-VN") : "—"}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs items={tabs} value={activeTab} onChange={setActiveTab} />

      <TabPanel key="overview" value={activeTab}>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Face Enrollment Status */}
          <Card>
            <CardTitle>Thiết lập nhận diện khuôn mặt</CardTitle>
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Trạng thái</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge tone={faceStatusConfig[faceStatus as keyof typeof faceStatusConfig]?.color || "neutral"}>
                      {faceStatusConfig[faceStatus as keyof typeof faceStatusConfig]?.label || "Không xác định"}
                    </Badge>
                    {faceQuality !== null && faceQuality !== undefined && (
                      <span className="text-sm text-slate-500">Chất lượng: {(faceQuality * 100).toFixed(1)}%</span>
                    )}
                  </div>
                </div>
                {faceStatus === "none" && (
                  <Button size="sm" onClick={() => window.location.href = `/admin/employees/${employee.id}/enroll`}>
                    <Icon name="plus" size={14} /> Đăng ký nhận diện
                  </Button>
                )}
                {faceStatus === "active" && (
                  <Button variant="secondary" size="sm" onClick={() => window.location.href = `/admin/employees/${employee.id}/enroll/revoke`}>
                    <Icon name="rotate-ccw" size={14} /> Thu hồi
                  </Button>
                )}
                {faceStatus === "pending" && (
                  <span className="text-sm text-slate-500">Đang chờ HR duyệt...</span>
                )}
                {faceStatus === "rejected" && (
                  <Button variant="secondary" size="sm" onClick={() => window.location.href = `/admin/employees/${employee.id}/enroll`}>
                    <Icon name="rotate-ccw" size={14} /> Đăng ký lại
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Work Schedule */}
          <Card>
            <CardTitle>Ca làm việc hiện tại</CardTitle>
            <div className="mt-4">
              {renderWorkSchedule()}
            </div>
          </Card>
        </div>

        <Card>
          <CardTitle>Thông tin bổ sung</CardTitle>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Trạng thái hồ sơ</span>
              <span className="font-medium">{isProfileActive ? "Hoạt động" : "Vô hiệu"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Trạng thái làm việc</span>
              <Badge tone={employee.employment_status === "active" ? "success" : employee.employment_status === "inactive" ? "warning" : "danger"}>
                {employee.employment_status === "active" ? "Đang làm việc" : employee.employment_status === "inactive" ? "Tạm nghỉ" : "Đã nghỉ việc"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Face Enrollment</span>
              <Badge tone={faceStatusConfig[faceStatus as keyof typeof faceStatusConfig]?.color || "neutral"}>
                {faceStatusConfig[faceStatus as keyof typeof faceStatusConfig]?.label || "Không xác định"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Chất lượng khuôn mặt</span>
              <span className="font-medium">{faceQuality !== null && faceQuality !== undefined ? `${(faceQuality * 100).toFixed(1)}%` : "—"}</span>
            </div>
          </div>
        </Card>
      </TabPanel>

      <TabPanel key="work_info" value={activeTab}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle>Thông tin cơ bản</CardTitle>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Mã nhân viên</span>
                <span className="font-medium">{employee.employee_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Họ tên</span>
                <span className="font-medium">{profile?.display_name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="font-medium">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chức danh</span>
                <span className="font-medium">{employee.title || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phòng ban</span>
                <span className="font-medium">{department?.name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quản lý trực tiếp</span>
                <span className="font-medium">{manager?.employee_code || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Trạng thái làm việc</span>
                <Badge tone={employee.employment_status === "active" ? "success" : employee.employment_status === "inactive" ? "warning" : "danger"}>
                  {employee.employment_status === "active" ? "Đang làm việc" : employee.employment_status === "inactive" ? "Tạm nghỉ" : "Đã nghỉ việc"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ngày tuyển dụng</span>
                <span className="font-medium">{employee.hired_at ? new Date(employee.hired_at).toLocaleDateString("vi-VN") : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ngày nghỉ việc</span>
                <span className="font-medium">{employee.terminated_at ? new Date(employee.terminated_at).toLocaleDateString("vi-VN") : "—"}</span>
              </div>
            </div>
          </Card>
        </div>
      </TabPanel>

      <TabPanel key="schedule" value={activeTab}>
        <Card>
          <CardTitle>Lịch phân ca</CardTitle>
          <div className="mt-4">
            {assignments && assignments.length > 0 ? (
              <DataTable
                ariaLabel="Lịch phân ca"
                rows={assignments}
                keyOf={(a, i) => `${a.effective_from}-${i}`}
                emptyTitle="Chưa phân ca"
                emptyDescription="Nhân viên chưa được phân ca làm việc nào."
                columns={[
                  { key: "shift", header: "Ca làm", render: (a) => <span className="font-medium">{(a.shift as any[])?.[0]?.name || "—"}</span> },
                  { key: "time", header: "Giờ", render: (a) => `${(a.shift as any[])?.[0]?.start_time || "—"} – ${(a.shift as any[])?.[0]?.end_time || "—"}${(a.shift as any[])?.[0]?.overnight ? " (qua đêm)" : ""}` },
                  { key: "from", header: "Từ ngày", render: (a) => <span className="tnum">{new Date(a.effective_from).toLocaleDateString("vi-VN")}</span> },
                  { key: "to", header: "Đến ngày", render: (a) => <span className="tnum">{a.effective_to ? new Date(a.effective_to).toLocaleDateString("vi-VN") : "Chưa hết hạn"}</span> },
                  { key: "type", header: "Loại", render: (a) => <Badge tone={(a.shift as any[])?.[0]?.overnight ? "info" : "neutral"}>{(a.shift as any[])?.[0]?.overnight ? "Qua đêm" : "Ngày"}</Badge> },
                ]}
                cardTitle={(a) => `${(a.shift as any[])?.[0]?.name || "Ca không tên"}`}
                cardMeta={(a) => `${new Date(a.effective_from).toLocaleDateString("vi-VN")} ${a.effective_to ? "→ " + new Date(a.effective_to).toLocaleDateString("vi-VN") : " (chưa hết hạn)"}`}
              />
            ) : (
              <EmptyState title="Chưa phân ca" description="Nhân viên chưa được phân ca làm việc nào." />
            )}
          </div>
        </Card>
      </TabPanel>

      <TabPanel key="attendance" value={activeTab}>
        <Card>
          <CardTitle>Lịch sử chấm công</CardTitle>
          <div className="mt-4">
            {attendanceEvents && attendanceEvents.length > 0 ? (
              <DataTable
                ariaLabel="Lịch sử chấm công"
                rows={attendanceEvents}
                keyOf={(e, i) => `${e.occurred_at}-${i}`}
                emptyTitle="Chưa có bản ghi chấm công"
                emptyDescription="Nhân viên chưa có bản ghi chấm công nào."
                columns={[
                  { key: "date", header: "Ngày", render: (e) => <span className="tnum">{new Date(e.occurred_at).toLocaleDateString("vi-VN")}</span> },
                  { key: "time", header: "Giờ", render: (e) => <span className="tnum">{new Date(e.occurred_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span> },
                  { key: "type", header: "Loại", render: (e) => <Badge tone={e.event_type === "check_in" ? "info" : "success"}>{e.event_type === "check_in" ? "Check-in" : "Check-out"}</Badge> },
                  { key: "method", header: "Phương thức", render: (e) => <Badge tone={e.method === "face" ? "info" : e.method === "pin_fallback" ? "warning" : "neutral"}>{e.method === "face" ? "Khuôn mặt" : e.method === "pin_fallback" ? "PIN thay thế" : "Thủ công"}</Badge> },
                  { key: "status", header: "Trạng thái", render: (e) => <Badge tone={e.status === "success" ? "success" : e.status === "pending_review" ? "warning" : e.status === "fallback" ? "info" : "danger"}>{e.status === "success" ? "Thành công" : e.status === "pending_review" ? "Chờ rà soát" : e.status === "fallback" ? "Thay thế" : "Thất bại"}</Badge> },
                  { key: "confidence", header: "Confidence", render: (e) => e.confidence !== null ? `${(e.confidence * 100).toFixed(1)}%` : "—" },
                  { key: "liveness", header: "Liveness", render: (e) => e.liveness_status ? <Badge tone={e.liveness_status === "pass" ? "success" : "danger"}>{e.liveness_status}</Badge> : "—" },
                ]}
                cardTitle={(e) => `${e.event_type === "check_in" ? "Check-in" : "Check-out"} lúc ${new Date(e.occurred_at).toLocaleTimeString("vi-VN")}`}
                cardMeta={(e) => `Phương thức: ${e.method === "face" ? "Khuôn mặt" : e.method === "pin_fallback" ? "PIN thay thế" : "Thủ công"} · Trạng thái: ${e.status === "success" ? "Thành công" : e.status === "pending_review" ? "Chờ rà soát" : e.status === "fallback" ? "Thay thế" : "Thất bại"}`}
              />
            ) : (
              <EmptyState title="Chưa có bản ghi chấm công" description="Nhân viên chưa có bản ghi chấm công nào." />
            )}
          </div>
        </Card>
      </TabPanel>

      <TabPanel key="requests" value={activeTab}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle>Điều chỉnh chấm công</CardTitle>
            <div className="mt-4">
              {adjustments && adjustments.length > 0 ? (
                <DataTable
                  ariaLabel="Yêu cầu điều chỉnh"
                  rows={adjustments}
                  keyOf={(a) => a.work_date}
                  emptyTitle="Chưa có yêu cầu"
                  emptyDescription="Nhân viên chưa gửi yêu cầu chỉnh công nào."
                  columns={[
                    { key: "date", header: "Ngày", render: (a) => <span className="tnum">{a.work_date}</span> },
                    { key: "in", header: "Giờ vào đề xuất", render: (a) => a.requested_in ? new Date(a.requested_in).toLocaleTimeString("vi-VN") : "—" },
                    { key: "out", header: "Giờ ra đề xuất", render: (a) => a.requested_out ? new Date(a.requested_out).toLocaleTimeString("vi-VN") : "—" },
                    { key: "status", header: "Trạng thái", render: (a) => <Badge tone={a.status === "approved" ? "success" : a.status === "rejected" ? "danger" : "warning"}>{a.status === "approved" ? "Đã duyệt" : a.status === "rejected" ? "Từ chối" : "Chờ duyệt"}</Badge> },
                    { key: "reason", header: "Lý do", render: (a) => <span className="max-w-48 truncate">{a.reason}</span> },
                  ]}
                  cardTitle={(a) => `${a.work_date}`}
                  cardMeta={(a) => `Đề xuất: ${a.requested_in ? new Date(a.requested_in).toLocaleTimeString("vi-VN") : "—"} – ${a.requested_out ? new Date(a.requested_out).toLocaleTimeString("vi-VN") : "—"}`}
                />
              ) : (
                <EmptyState title="Chưa có yêu cầu" description="Nhân viên chưa gửi yêu cầu chỉnh công nào." />
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Đơn nghỉ phép</CardTitle>
            <div className="mt-4">
              {leaves && leaves.length > 0 ? (
                <DataTable
                  ariaLabel="Đơn nghỉ phép"
                  rows={leaves}
                  keyOf={(l) => l.id}
                  emptyTitle="Chưa có đơn nghỉ"
                  emptyDescription="Nhân viên chưa gửi đơn nghỉ phép nào."
                  columns={[
                    { key: "type", header: "Loại", render: (l) => l.leave_type },
                    { key: "range", header: "Thời gian", render: (l) => <span className="tnum">{l.start_date} → {l.end_date}</span> },
                    { key: "status", header: "Trạng thái", render: (l) => <Badge tone={l.status === "approved" ? "success" : l.status === "rejected" ? "danger" : "warning"}>{l.status === "approved" ? "Đã duyệt" : l.status === "rejected" ? "Từ chối" : "Chờ duyệt"}</Badge> },
                    { key: "reason", header: "Lý do", render: (l) => <span className="max-w-48 truncate">{l.reason || "—"}</span> },
                  ]}
                  cardTitle={(l) => `${l.leave_type} · {l.start_date} → {l.end_date}`}
                  cardMeta={(l) => `Trạng thái: ${l.status === "approved" ? "Đã duyệt" : l.status === "rejected" ? "Từ chối" : "Chờ duyệt"}`}
                />
              ) : (
                <EmptyState title="Chưa có đơn nghỉ" description="Nhân viên chưa gửi đơn nghỉ phép nào." />
              )}
            </div>
          </Card>
        </div>
      </TabPanel>

      <TabPanel key="face_enrollment" value={activeTab}>
        <Card>
          <CardTitle>Thiết lập nhận diện khuôn mặt</CardTitle>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-500">Trạng thái đăng ký</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone={faceStatusConfig[faceStatus as keyof typeof faceStatusConfig]?.color || "neutral"}>
                    {faceStatusConfig[faceStatus as keyof typeof faceStatusConfig]?.label || "Không xác định"}
                  </Badge>
                  {faceQuality !== null && faceQuality !== undefined && (
                    <span className="text-sm text-slate-500">Chất lượng: {(faceQuality * 100).toFixed(1)}%</span>
                  )}
                </div>
              </div>
              {faceStatus === "none" && (
                <Button onClick={() => window.location.href = `/admin/employees/${employee.id}/enroll`}>
                  <Icon name="plus" size={14} /> Đăng ký nhận diện
                </Button>
              )}
              {faceStatus === "active" && (
                <Button variant="secondary" onClick={() => window.location.href = `/admin/employees/${employee.id}/enroll/revoke`}>
                  <Icon name="rotate-ccw" size={14} /> Thu hồi
                </Button>
              )}
              {faceStatus === "pending" && (
                <span className="text-sm text-slate-500">Đang chờ HR duyệt...</span>
              )}
              {faceStatus === "rejected" && (
                <Button variant="secondary" onClick={() => window.location.href = `/admin/employees/${employee.id}/enroll`}>
                  <Icon name="rotate-ccw" size={14} /> Đăng ký lại
                </Button>
              )}
            </div>

            {faceEnrollmentData ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Trạng thái</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      <Badge tone={faceStatusConfig[faceStatus as keyof typeof faceStatusConfig]?.color || "neutral"}>
                        {faceStatusConfig[faceStatus as keyof typeof faceStatusConfig]?.label || "Không xác định"}
                      </Badge>
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Chất lượng khuôn mặt</p>
                    <p className="mt-1 font-semibold text-slate-900">{faceQuality !== null && faceQuality !== undefined ? `${(faceQuality * 100).toFixed(1)}%` : "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Provider</p>
                    <p className="mt-1 font-semibold text-slate-900">{faceEnrollmentData?.provider || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Phiên bản consent</p>
                    <p className="mt-1 font-semibold text-slate-900">{faceEnrollmentData?.consent_version || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Đăng ký lúc</p>
                    <p className="mt-1 font-semibold text-slate-900">{faceEnrollmentData?.created_at ? new Date(faceEnrollmentData.created_at).toLocaleString("vi-VN") : "—"}</p>
                  </div>
                </div>

                {faceStatus === "active" && (
                  <Button variant="danger" onClick={() => window.location.href = `/admin/employees/${employee.id}/enroll/revoke`} className="w-full max-w-xs">
                    <Icon name="rotate-ccw" size={14} /> Thu hồi đăng ký khuôn mặt
                  </Button>
                )}
                {faceStatus === "rejected" && (
                  <Button variant="secondary" onClick={() => window.location.href = `/admin/employees/${employee.id}/enroll`} className="w-full max-w-xs">
                    <Icon name="rotate-ccw" size={14} /> Đăng ký lại
                  </Button>
                )}
              </div>
            ) : (
              <EmptyState title="Chưa có đăng ký" description="Nhân viên chưa đăng ký nhận diện khuôn mặt." />
            )}
          </div>
        </Card>
      </TabPanel>
    </div>
  );
}