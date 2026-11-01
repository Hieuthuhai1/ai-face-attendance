"use client";

import { useState } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { useLanguage } from "@/components/app/language-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
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
  skipTranslation = false,
}: {
  label: string;
  value: string;
  skipTranslation?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd
        className="mt-1 truncate text-sm font-medium text-slate-900"
        data-i18n-skip={skipTranslation ? "true" : undefined}
      >
        {value}
      </dd>
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
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
        active
          ? "border-[var(--brand)] bg-[var(--brand-soft)]"
          : "border-slate-200 bg-white hover:bg-slate-50",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-700 shadow-sm">
        {code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900" data-i18n-skip="true">
          {nativeLabel}
        </span>
        <span className="block text-xs text-slate-500" data-i18n-skip="true">
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title={t("Hồ sơ cá nhân")}
        description={t("Thông tin tài khoản và tùy chọn hiển thị.")}
      />

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{t("Thông tin cá nhân")}</CardTitle>
            <CardDescription>{t("Thông tin tài khoản và tùy chọn hiển thị.")}</CardDescription>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand-strong)]">
            {(profile.displayName || profile.email || "?").trim().charAt(0).toUpperCase()}
          </span>
        </div>

        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <InfoRow label={t("Họ và tên")} value={profile.displayName || "—"} skipTranslation />
          <InfoRow label={t("Email")} value={profile.email} skipTranslation />
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("Vai trò")}</dt>
            <dd className="mt-1">
              <Badge tone={roleTone}>{roleLabel}</Badge>
            </dd>
          </div>
          <InfoRow
            label={t("Tổ chức")}
            value={organizationName ?? t("Chưa cập nhật")}
            skipTranslation={Boolean(organizationName)}
          />
        </dl>
      </Card>

      {employee ? (
        <Card>
          <CardTitle>{t("Thông tin nhân sự")}</CardTitle>
          <CardDescription>{t("Liên hệ HR nếu thông tin chưa chính xác.")}</CardDescription>
          <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <InfoRow label={t("Mã nhân viên")} value={employee.employeeCode} skipTranslation />
            <InfoRow
              label={t("Phòng ban")}
              value={employee.department ?? t("Chưa cập nhật")}
              skipTranslation={Boolean(employee.department)}
            />
            <InfoRow
              label={t("Chức danh")}
              value={employee.title || t("Chưa cập nhật")}
              skipTranslation={Boolean(employee.title)}
            />
            <div className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {t("Trạng thái")}
              </dt>
              <dd className="mt-1">
                <Badge tone={statusTone}>{statusLabel}</Badge>
              </dd>
            </div>
            <InfoRow
              label={t("Ngày vào làm")}
              value={
                employee.hiredAt
                  ? new Date(employee.hiredAt).toLocaleDateString(dateLocale)
                  : t("Chưa cập nhật")
              }
              skipTranslation={Boolean(employee.hiredAt)}
            />
          </dl>
        </Card>
      ) : (
        <Card>
          <CardTitle>{t("Thông tin nhân sự")}</CardTitle>
          <CardDescription>{t("Chưa có thông tin nhân sự.")}</CardDescription>
          <p className="mt-3 text-sm text-slate-500">
            {t("Liên hệ HR nếu thông tin chưa chính xác.")}
          </p>
        </Card>
      )}

      <Card>
        <CardTitle>{t("Ngôn ngữ")}</CardTitle>
        <CardDescription>{t("Chọn ngôn ngữ hiển thị cho toàn bộ ứng dụng.")}</CardDescription>
        <div
          role="group"
          aria-label={t("Ngôn ngữ")}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
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
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Icon name="info" size={14} />
          {t("Tùy chọn này được lưu vào hồ sơ của bạn và áp dụng cho mọi trang.")}
        </p>
      </Card>
    </div>
  );
}
