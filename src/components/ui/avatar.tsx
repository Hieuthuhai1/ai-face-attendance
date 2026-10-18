"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";
import { Button } from "./button";

export interface AvatarProps {
  /** Kích thước avatar */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Tên hiển thị (dùng để tạo chữ cái đầu nếu không có ảnh) */
  name?: string;
  /** URL ảnh avatar */
  src?: string;
  /** Trạng thái online/offline/busy */
  status?: "online" | "offline" | "busy" | "away";
  /** Icon tùy chỉnh thay vì chữ cái đầu */
  icon?: IconName;
  /** CSS class thêm */
  className?: string;
  /** Alt text cho ảnh */
  alt?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg",
  xl: "h-16 w-16 text-xl",
};

const STATUS_SIZE: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-4 w-4",
};

const STATUS_CLASSES: Record<NonNullable<AvatarProps["status"]>, string> = {
  online: "bg-[var(--success)]",
  offline: "bg-slate-400",
  busy: "bg-[var(--danger)]",
  away: "bg-[var(--warning)]",
};

/** Tạo chữ cái đầu từ tên */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Avatar component với fallback chữ cái đầu, status indicator, và icon tùy chọn */
export function Avatar({
  size = "md",
  name,
  src,
  status,
  icon,
  className,
  alt,
}: AvatarProps) {
  const showStatus = status !== undefined;
  const hasImage = src && src.length > 0;

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {hasImage ? (
        <img
          src={src}
          alt={alt ?? name ?? "Avatar"}
          className={cn(
            "rounded-full object-cover bg-slate-100",
            SIZE_CLASSES[size],
            showStatus && "ring-2 ring-white"
          )}
        />
      ) : icon ? (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-strong)] font-medium",
            SIZE_CLASSES[size]
          )}
          aria-hidden="true"
        >
          <Icon name={icon} size={parseInt(SIZE_CLASSES[size].match(/\d+/)?.[0] ?? "20")} />
        </span>
      ) : (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-strong)] font-medium",
            SIZE_CLASSES[size]
          )}
          aria-hidden="true"
        >
          {name ? getInitials(name) : "?"}
        </span>
      )}

      {showStatus && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-white",
            STATUS_CLASSES[status],
            STATUS_SIZE[size]
          )}
          aria-label={`Trạng thái: ${status}`}
        />
      )}
    </div>
  );
}

/** Avatar nhóm - hiển thị nhiều avatar chồng lên nhau */
export function AvatarGroup({
  avatars,
  max = 5,
  size = "md",
  className,
}: {
  avatars: Array<{ src?: string; name?: string; alt?: string }>;
  max?: number;
  size?: NonNullable<AvatarProps["size"]>;
  className?: string;
}) {
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className={cn("flex -space-x-2", className)} aria-label="Nhóm avatar">
      {visible.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          name={avatar.name}
          alt={avatar.alt}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {remaining > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-600 font-medium ring-2 ring-white",
            SIZE_CLASSES[size]
          )}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}

/** Avatar có thể upload - dùng trong settings/profile */
export function AvatarUpload({
  src,
  name,
  size = "xl",
  onChange,
  onRemove,
  disabled,
}: {
  src?: string;
  name?: string;
  size?: NonNullable<AvatarProps["size"]>;
  onChange: (file: File) => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Chỉ chấp nhận file ảnh");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Ảnh không được lớn hơn 2MB");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange(file);
  }

  function handleRemove() {
    setPreview(null);
    onRemove?.();
  }

  const imageSrc = preview ?? src;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar src={imageSrc} name={name} size={size} />
        {!disabled && (
          <label className="absolute bottom-0 right-0 cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleChange}
              disabled={disabled}
              className="sr-only"
            />
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-[var(--brand)] text-white text-xs shadow-md hover:brightness-110 transition">
              <Icon name="camera" size={14} />
            </span>
          </label>
        )}
      </div>
      {imageSrc && onRemove && !disabled && (
        <Button variant="ghost" size="sm" onClick={handleRemove}>
          <Icon name="x" size={14} /> Xóa ảnh
        </Button>
      )}
      <p className="text-xs text-slate-500 text-center max-w-xs">
        Tải lên ảnh JPG/PNG, tối đa 2MB. Khuyến nghị tỷ lệ 1:1.
      </p>
    </div>
  );
}