"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { Avatar } from "./avatar";
import { DropdownMenu, DropdownItem } from "./dropdown-menu";

const ROLE_LABELS: Record<string, string> = {
  employee: "Nhân viên",
  manager: "Quản lý",
  hr_admin: "HR Admin",
  system_admin: "System Admin",
};

const triggerClass =
  "flex items-center gap-2.5 rounded-[var(--radius-control)] p-1 pl-1.5 text-left transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]";

export interface UserMenuProps {
  /** Thông tin user */
  user: {
    displayName: string;
    email: string;
    avatar?: string;
    role: string;
  };
  /** Các menu items */
  items: Array<{
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
  }>;
  /** Trigger button class */
  triggerClassName?: string;
  /** Dropdown class */
  dropdownClassName?: string;
  /** Hiển thị avatar trong trigger */
  showAvatar?: boolean;
  /** Hiển thị tên trong trigger */
  showName?: boolean;
}

/** User Menu - dropdown menu cho user profile */
export function UserMenu({
  user,
  items,
  triggerClassName,
  dropdownClassName,
  showAvatar = true,
  showName = true,
}: UserMenuProps) {
  return (
    <DropdownMenu
      className="shrink-0"
      menuClassName={cn("w-64", dropdownClassName)}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Tài khoản"
          className={cn(triggerClass, triggerClassName)}
        >
          {showAvatar && <Avatar src={user.avatar} name={user.displayName} size="sm" />}
          {showName && (
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block truncate text-[13px] font-semibold leading-tight text-[var(--navy-800)]">
                {user.displayName}
              </span>
              <span className="mt-0.5 block truncate text-[11px] leading-tight text-[var(--text-3)]">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </span>
          )}
          <Icon
            name="chevron-down"
            size={15}
            className={cn("shrink-0 text-[var(--text-3)] transition-transform", open && "rotate-180")}
          />
        </button>
      )}
    >
      <div className="border-b border-[var(--border)] px-3 pb-2.5 pt-2">
        <p className="truncate text-sm font-semibold text-[var(--navy-800)]">{user.displayName}</p>
        <p className="truncate text-xs text-[var(--text-2)]">{user.email}</p>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-strong)]">
          {ROLE_LABELS[user.role] ?? user.role}
        </span>
      </div>
      <div className="pt-1">
        {items.map((item, index) => (
          <DropdownItem key={index} onSelect={item.onClick} danger={item.danger}>
            {item.icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>}
            <span className="flex-1 truncate">{item.label}</span>
          </DropdownItem>
        ))}
      </div>
    </DropdownMenu>
  );
}

/** User Menu với nested submenu */
export interface UserMenuItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  submenu?: UserMenuItem[];
}

export function UserMenuWithSubmenu({
  user,
  items,
  triggerClassName,
  dropdownClassName,
  showAvatar = true,
  showName = true,
}: {
  user: { displayName: string; email: string; avatar?: string; role: string };
  items: UserMenuItem[];
  triggerClassName?: string;
  dropdownClassName?: string;
  showAvatar?: boolean;
  showName?: boolean;
}) {
  return (
    <DropdownMenu
      className="shrink-0"
      menuClassName={cn("w-64", dropdownClassName)}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Tài khoản"
          className={cn(triggerClass, triggerClassName)}
        >
          {showAvatar && <Avatar src={user.avatar} name={user.displayName} size="sm" />}
          {showName && (
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block truncate text-[13px] font-semibold leading-tight text-[var(--navy-800)]">
                {user.displayName}
              </span>
              <span className="mt-0.5 block truncate text-[11px] leading-tight text-[var(--text-3)]">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </span>
          )}
          <Icon
            name="chevron-down"
            size={15}
            className={cn("shrink-0 text-[var(--text-3)] transition-transform", open && "rotate-180")}
          />
        </button>
      )}
    >
      <div className="border-b border-[var(--border)] px-3 pb-2.5 pt-2">
        <p className="truncate text-sm font-semibold text-[var(--navy-800)]">{user.displayName}</p>
        <p className="truncate text-xs text-[var(--text-2)]">{user.email}</p>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-strong)]">
          {ROLE_LABELS[user.role] ?? user.role}
        </span>
      </div>
      <div className="pt-1">{renderMenuItems(items)}</div>
    </DropdownMenu>
  );
}

function renderMenuItems(items: UserMenuItem[]): ReactNode {
  return items.map((item, index) => {
    if (item.submenu && item.submenu.length > 0) {
      return (
        <div key={index} className="relative">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--navy-700)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            {item.icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>}
            <span className="flex-1 truncate">{item.label}</span>
            <Icon name="chevron-right" size={14} className="text-[var(--text-3)]" />
          </button>
          <div className="absolute left-full top-0 z-50 min-w-52 rounded-xl border border-[var(--border)] bg-white p-1.5 shadow-[var(--shadow-popover)] animate-fade-in">
            {renderMenuItems(item.submenu)}
          </div>
        </div>
      );
    }

    return (
      <button
        key={index}
        type="button"
        onClick={item.onClick}
        disabled={item.disabled}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
          item.disabled && "cursor-not-allowed opacity-50",
          item.danger
            ? "text-[var(--danger)] hover:bg-[var(--danger-bg)]"
            : "text-[var(--navy-700)] hover:bg-[var(--surface-muted)]",
        )}
      >
        {item.icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>}
        <span className="truncate">{item.label}</span>
      </button>
    );
  });
}

/** Notification Bell - chuông thông báo */
export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: Date;
  read: boolean;
  type?: "info" | "success" | "warning" | "error";
  onClick?: () => void;
}

export interface NotificationBellProps {
  /** Danh sách thông báo */
  notifications: NotificationItem[];
  /** Callback khi click thông báo */
  onNotificationClick?: (notification: NotificationItem) => void;
  /** Callback khi click "Xem tất cả" */
  onViewAll?: () => void;
  /** Số lượng tối đa hiển thị */
  maxVisible?: number;
  /** Loading */
  loading?: boolean;
  /** Empty message */
  emptyMessage?: string;
}

const NOTIFICATION_ICONS = {
  info: { icon: "info", color: "text-[var(--info)]" },
  success: { icon: "check", color: "text-[var(--success)]" },
  warning: { icon: "alert", color: "text-[var(--warning)]" },
  error: { icon: "x", color: "text-[var(--danger)]" },
};

export function NotificationBell({
  notifications,
  onNotificationClick,
  onViewAll,
  maxVisible = 5,
  loading = false,
  emptyMessage = "Không có thông báo",
}: NotificationBellProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const visibleNotifications = notifications.slice(0, maxVisible);

  return (
    <DropdownMenu
      className="shrink-0"
      menuClassName="w-[22rem] max-w-[calc(100vw-2rem)]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-2)] transition-colors",
            "hover:bg-[var(--surface-muted)] hover:text-[var(--navy-800)]",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]",
            open && "bg-[var(--surface-muted)] text-[var(--navy-800)]",
          )}
          aria-label={`Thông báo${unreadCount > 0 ? `, ${unreadCount} chưa đọc` : ""}`}
        >
          <Icon name="bell" size={19} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-white ring-2 ring-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 pb-2.5 pt-2">
        <h3 className="text-sm font-semibold text-[var(--navy-800)]">Thông báo</h3>
        {unreadCount > 0 ? (
          <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-strong)]">
            {unreadCount} mới
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="px-3 py-6 text-center text-sm text-[var(--text-2)]">
          <Icon name="refresh" size={18} className="mx-auto mb-2 animate-spin text-[var(--brand)]" />
          Đang tải...
        </div>
      ) : visibleNotifications.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-[var(--text-2)]">
          <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-3)]">
            <Icon name="bell" size={20} />
          </span>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto scrollbar-slim">
          {visibleNotifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => onNotificationClick?.(notification)}
              className={cn(
                "flex w-full gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)]",
                !notification.read && "bg-[var(--brand-soft)]/50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)]",
                  NOTIFICATION_ICONS[notification.type ?? "info"].color,
                )}
              >
                <Icon name={NOTIFICATION_ICONS[notification.type ?? "info"].icon} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[13px] text-[var(--navy-800)]", !notification.read && "font-semibold")}>
                  {notification.title}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--text-2)]">{notification.message}</span>
                <span className="mt-1 block text-[10px] text-[var(--text-3)]">
                  {notification.time.toLocaleString("vi-VN")}
                </span>
              </span>
              {!notification.read && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />}
            </button>
          ))}
        </div>
      )}

      <div className="mt-1 border-t border-[var(--border)] px-3 pb-1 pt-2">
        <button
          type="button"
          onClick={onViewAll}
          className="w-full rounded-lg py-1.5 text-center text-xs font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand-soft)]"
        >
          {notifications.length > maxVisible
            ? `Xem thêm ${notifications.length - maxVisible} thông báo`
            : "Xem tất cả thông báo"}
        </button>
      </div>
    </DropdownMenu>
  );
}
