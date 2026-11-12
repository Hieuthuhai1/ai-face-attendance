"use client";

import { useState } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { useLanguage } from "@/components/app/language-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/db";

export interface ProfilePageData {
  profile: {
    displayName: string;
    email: string;
    role: Role;
    locale?: Locale;
  };
  employee: {
    employeeCode: string;
    title: string;
    department: string | null;
    employmentStatus: string;
    hiredAt: string | null;
  } | null;
  organizationName: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  employee: "Nhân viên",
  manager: "Quản lý",
  hr_admin: "HR Admin",
  system_admin: "System Admin",
};

const ROLE_TONE: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  employee: "neutral",
  manager: "info",
  hr_admin: "warning",
  system_admin: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Đang hoạt động",
  inactive: "Ngừng hoạt động",
  terminated: "Đã nghỉ việc",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  inactive: "warning",
  terminated: "danger",
};

function InfoRow({
  label,
  value,
  icon,
  skipTranslation = false,
}: {
  label: string;
  value: string;
  icon: "user" | "mail" | "id-card" | "building" | "briefcase" | "calendar" | "shield";
  skipTranslation?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--surface-muted)] text-[var(--text-3)] ring-1 ring-inset ring-[var(--border)]">
        <Icon name={icon} size={14} />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">{label}</dt>
        <dd
          className="mt-0.5 truncate text-[13px] font-semibold text-[var(--navy-800)]"
          data-i18n-skip={skipTranslation ? "true" : undefined}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

function LanguageOption({
  active,
  saving,
  code,
  nativeLabel,
  englishLabel,
  onSelect,
}: {
  active: boolean;
  saving: boolean;
  code: string;
  nativeLabel: string;
  englishLabel: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-3 rounded-[var(--radius-control)] border p-3 text-left transition",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]",
        active
          ? "border-[var(--brand)] bg-[var(--brand-soft)] shadow-[var(--shadow-xs)]"
          : "border-[var(--border)] bg-white hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-white text-xs font-bold text-[var(--navy-800)] shadow-sm ring-1 ring-inset ring-[var(--border)]">
        {code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[var(--navy-800)]" data-i18n-skip="true">
          {nativeLabel}
        </span>
        <span className="block text-[12px] text-[var(--text-3)]" data-i18n-skip="true">
          {englishLabel}
        </span>
      </span>
      {saving ? (
        <Icon name="refresh" size={18} className="animate-spin text-[var(--brand)]" />
      ) : active ? (
        <Icon name="check" size={18} className="text-[var(--brand)]" />
      ) : null}
    </button>
  );
}

export function ProfileClient({ profile, employee, organizationName }: ProfilePageData) {
  const { locale, setLocale, t } = useLanguage();
  const [saving, setSaving] = useState<Locale | null>(null);

  async function chooseLocale(next: Locale) {
    if (next === locale || saving) return;
    setSaving(next);
    const result = await setLocale(next);
    setSaving(null);
    if (!result.ok) {
      toast.error(result.message ?? t("Không thể cập nhật ngôn ngữ. Vui lòng thử lại."));
      return;
    }
    toast.success(t("Ngôn ngữ đã được cập nhật."));
  }

  const roleLabel = t(ROLE_LABEL[profile.role] ?? profile.role);
  const roleTone = ROLE_TONE[profile.role] ?? "neutral";
  const statusLabel = employee ? t(STATUS_LABEL[employee.employmentStatus] ?? employee.employmentStatus) : "";
  const statusTone = employee ? STATUS_TONE[employee.employmentStatus] ?? "neutral" : "neutral";
  const dateLocale = locale === "en" ? "en-US" : "vi-VN";
  const initial = (profile.displayName || profile.email || "?").trim().charAt(0).toUpperCase();

  return (
    <main className="page-shell flex flex-col gap-6">
      <PageHeader
        eyebrow="Tài khoản"
        icon="user"
        title={t("Hồ sơ cá nhân")}
        description={t("Thông tin tài khoản, nhân sự và tùy chọn hiển thị.")}
      />

      {/* Hero hồ sơ */}
      <section className="relative overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-[var(--navy-900)] p-5 text-white shadow-[var(--shadow-card)] sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-blue-500/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold text-white ring-1 ring-inset ring-white/20">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                {organizationName ?? t("Tổ chức")}
              </p>
              <h2 className="mt-1 truncate text-xl font-bold tracking-[-0.02em] sm:text-2xl">
                {profile.displayName || t("Chưa cập nhật")}
              </h2>
              <p className="truncate text-[13px] text-slate-300">{profile.email}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={roleTone === "danger" ? "danger" : roleTone === "warning" ? "warning" : roleTone === "info" ? "info" : "neutral"}>
                  <Icon name="shield" size={12} /> {roleLabel}
                </Badge>
                {employee ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1 text-[12px] font-medium text-slate-200">
                    <Icon name="id-card" size={12} /> {employee.employeeCode}
                  </span>
                ) : null}
                {employee ? (
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium",
                    employee.employmentStatus === "active"
                      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-300/25 bg-amber-400/10 text-amber-200",
                  )}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" /> {statusLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[230px]">
            <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">{t("Phòng ban")}</p>
              <p className="mt-1 truncate text-[13px] font-semibold text-white">
                {employee?.department ?? t("Chưa cập nhật")}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">{t("Chức danh")}</p>
              <p className="mt-1 truncate text-[13px] font-semibold text-white">
                {employee?.title || t("Chưa cập nhật")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title={t("Thông tin cá nhân")}
              description={t("Thông tin tài khoản dùng để đăng nhập và hiển thị trong hệ thống.")}
              action={<Badge tone="brand"><Icon name="user" size={12} /> {t("Tài khoản")}</Badge>}
            />
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <InfoRow label={t("Họ và tên")} value={profile.displayName || "—"} icon="user" skipTranslation />
              <InfoRow label={t("Email")} value={profile.email} icon="mail" skipTranslation />
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--surface-muted)] text-[var(--text-3)] ring-1 ring-inset ring-[var(--border)]">
                  <Icon name="shield" size={14} />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">{t("Vai trò")}</dt>
                  <dd className="mt-1"><Badge tone={roleTone}>{roleLabel}</Badge></dd>
                </div>
              </div>
              <InfoRow
                label={t("Tổ chức")}
                value={organizationName ?? t("Chưa cập nhật")}
                icon="building"
                skipTranslation={Boolean(organizationName)}
              />
            </dl>
          </Card>

          {employee ? (
            <Card>
              <CardHeader
                title={t("Thông tin nhân sự")}
                description={t("Liên hệ HR nếu thông tin chưa chính xác.")}
                action={<Badge tone={statusTone}>{statusLabel}</Badge>}
              />
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <InfoRow label={t("Mã nhân viên")} value={employee.employeeCode} icon="id-card" skipTranslation />
                <InfoRow
                  label={t("Phòng ban")}
                  value={employee.department ?? t("Chưa cập nhật")}
                  icon="building"
                  skipTranslation={Boolean(employee.department)}
                />
                <InfoRow
                  label={t("Chức danh")}
                  value={employee.title || t("Chưa cập nhật")}
                  icon="briefcase"
                  skipTranslation={Boolean(employee.title)}
                />
                <InfoRow
                  label={t("Ngày vào làm")}
                  value={employee.hiredAt ? new Date(employee.hiredAt).toLocaleDateString(dateLocale) : t("Chưa cập nhật")}
                  icon="calendar"
                  skipTranslation={Boolean(employee.hiredAt)}
                />
              </dl>
            </Card>
          ) : (
            <Card>
              <CardHeader title={t("Thông tin nhân sự")} description={t("Chưa có thông tin nhân sự.")} />
              <p className="mt-3 text-[13px] text-[var(--text-2)]">
                {t("Liên hệ HR nếu thông tin chưa chính xác.")}
              </p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title={t("Ngôn ngữ")}
              description={t("Chọn ngôn ngữ hiển thị cho toàn bộ ứng dụng.")}
            />
            <div role="group" aria-label={t("Ngôn ngữ")} className="mt-4 flex flex-col gap-2.5">
              <LanguageOption
                active={locale === "vi"}
                saving={saving === "vi"}
                code="VI"
                nativeLabel="Tiếng Việt"
                englishLabel="Vietnamese"
                onSelect={() => void chooseLocale("vi")}
              />
              <LanguageOption
                active={locale === "en"}
                saving={saving === "en"}
                code="EN"
                nativeLabel="English"
                englishLabel="English"
                onSelect={() => void chooseLocale("en")}
              />
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-[var(--text-3)]">
              <Icon name="info" size={13} className="mt-0.5 shrink-0" />
              {t("Tùy chọn này được lưu vào hồ sơ của bạn và áp dụng cho mọi trang.")}
            </p>
          </Card>

          <Card>
            <CardHeader
              title={t("Bảo mật & quyền truy cập")}
              description={t("Quyền được quản lý phía máy chủ, không thể thay đổi từ trình duyệt.")}
            />
            <ul className="mt-4 flex flex-col gap-2.5 text-[13px] text-[var(--text-2)]">
              {[
                "Vai trò do quản trị viên cấp",
                "Dữ liệu khuôn mặt chỉ dùng để chấm công",
                "Mọi thao tác đặc quyền đều ghi audit log",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
                    <Icon name="check" size={10} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">{t("Email đăng nhập")}</p>
              <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--navy-800)]">{profile.email}</p>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
