"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Portal } from "./portal";
import { Icon } from "./icon";
import { Button } from "./button";
import { Avatar } from "./avatar";
import { DropdownMenu, DropdownItem } from "./dropdown-menu";

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
      label={
        <div className={cn("flex items-center gap-2", triggerClassName)}>
          {showAvatar && (
            <Avatar
              src={user.avatar}
              name={user.displayName}
              size="sm"
              status="online"
            />
          )}
          {showName && (
            <span className="hidden sm:block truncate font-medium text-slate-800">
              {user.displayName}
            </span>
          )}
          <Icon name="chevron-down" size={16} className="text-slate-500" />
        </div>
      }
      className={dropdownClassName}
    >
      <div className="px-3 py-2 border-b border-slate-100">
        <p className="text-sm font-medium text-slate-900 truncate">{user.displayName}</p>
        <p className="text-xs text-slate-500 truncate">{user.email}</p>
        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--brand-soft)] text-[var(--brand-strong)]">
          {user.role}
        </span>
      </div>
      {items.map((item, index) => (
        <DropdownItem
          key={index}
          onSelect={item.onClick}
          danger={item.danger}
        >
          <div className="flex items-center gap-2">
            {item.icon && <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>}
            <span className="flex-1 truncate">{item.label}</span>
          </div>
        </DropdownItem>
      ))}
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
      label={
        <div className={cn("flex items-center gap-2", triggerClassName)}>
          {showAvatar && (
            <Avatar
              src={user.avatar}
              name={user.displayName}
              size="sm"
              status="online"
            />
          )}
          {showName && (
            <span className="hidden sm:block truncate font-medium text-slate-800">
              {user.displayName}
            </span>
          )}
          <Icon name="chevron-down" size={16} className="text-slate-500" />
        </div>
      }
      className={dropdownClassName}
    >
      <div className="px-3 py-2 border-b border-slate-100">
        <p className="text-sm font-medium text-slate-900 truncate">{user.displayName}</p>
        <p className="text-xs text-slate-500 truncate">{user.email}</p>
        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--brand-soft)] text-[var(--brand-strong)]">
          {user.role}
        </span>
      </div>
      {renderMenuItems(items)}
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
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
          >
            <div className="flex items-center gap-2 flex-1">
              {item.icon && <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </div>
            <Icon name="chevron-right" size={14} className="text-slate-400" />
          </button>
          <div className="absolute left-full top-0 min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-50 animate-fade-in">
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
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
          "hover:bg-slate-50 focus:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--brand)]",
          item.disabled && "opacity-50 cursor-not-allowed",
          item.danger && "text-red-700 hover:bg-red-50"
        )}
      >
        {item.icon && <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>}
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
      label={
        <button
          type="button"
          className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
          aria-label={`Thông báo${unreadCount > 0 ? `, ${unreadCount} chưa đọc` : ""}`}
        >
          <Icon name="inbox" size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      }
    >
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-medium text-slate-900">Thông báo</h3>
        {onViewAll && (
          <button type="button" onClick={onViewAll} className="text-xs text-[var(--brand)] hover:underline">
            Xem tất cả
          </button>
        )}
      </div>

      {loading ? (
        <div className="px-3 py-4 text-center text-sm text-slate-500">
          <Icon name="refresh" size={18} className="animate-spin mx-auto mb-2 text-[var(--info)]" />
          Đang tải...
        </div>
      ) : visibleNotifications.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-slate-500">
          <Icon name="inbox" size={24} className="mx-auto text-slate-300 mb-2" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {visibleNotifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => onNotificationClick?.(notification)}
              className={cn(
                "w-full px-3 py-3 text-left hover:bg-slate-50",
                !notification.read && "bg-[var(--info-bg)]/50"
              )}
            >
              <div className="flex items-start gap-2">
                <div className={cn("flex-shrink-0 mt-0.5", NOTIFICATION_ICONS[notification.type ?? "info"].color)}>
                  <Icon name={NOTIFICATION_ICONS[notification.type ?? "info"].icon} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-medium text-sm truncate", !notification.read && "font-semibold")}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{notification.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {notification.time.toLocaleString("vi-VN")}
                  </p>
                </div>
                {!notification.read && (
                  <span className="w-2 h-2 rounded-full bg-[var(--brand)] flex-shrink-0 mt-2" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {notifications.length > maxVisible && (
        <div className="px-3 py-2 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm text-[var(--brand)] hover:underline w-full"
          >
            Xem thêm {notifications.length - maxVisible} thông báo...
          </button>
        </div>
      )}
    </DropdownMenu>
  );
}