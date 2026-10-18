"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import type { Role } from "@/types/db";
import { Icon, type IconName } from "@/components/ui/icon";
import {
  findTrail,
  isActiveItem,
  NAV_GROUPS,
  primaryMobileNav,
} from "./nav";
import { UserMenu, NotificationBell, type NotificationItem } from "@/components/ui/user-menu";
import { CommandPalette, ShortcutsHelp, useCommandPalette, type KeyboardShortcut } from "@/components/ui/command-palette";
import { IconButton } from "@/components/ui/icon-button";

export interface ShellUser {
  displayName: string;
  email: string;
  role: Role;
  avatar?: string;
}

interface AppShellProps {
  user: ShellUser | null;
  onLogout: () => void;
  children: ReactNode;
  /** Thông báo cho notification bell */
  notifications?: NotificationItem[];
  /** Callback khi click thông báo */
  onNotificationClick?: (notification: NotificationItem) => void;
  /** Callback xem tất cả thông báo */
  onViewAllNotifications?: () => void;
}

const linkBase =
  "flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-2 min-h-11";
const linkIdle = "text-slate-600 hover:bg-slate-100";
const linkActive = "bg-[var(--brand-soft)] text-[var(--brand-strong)]";

function NavLink({
  href,
  label,
  icon,
  collapsed,
  vertical,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: IconName;
  collapsed?: boolean;
  vertical?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActiveItem(pathname, href);
  if (vertical) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[11px] font-medium transition focus-visible:outline-2 ${active ? "text-[var(--brand-strong)]" : "text-slate-500"}`}
      >
        <Icon name={icon} size={20} />
        <span className="max-w-full truncate">{label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={`${linkBase} ${active ? linkActive : linkIdle} ${collapsed ? "justify-center px-0" : ""}`}
    >
      <Icon name={icon} size={18} />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const trail = findTrail(pathname);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {trail ? (
          <nav aria-label="Breadcrumb" className="mb-1 text-xs text-slate-500">
            {trail.group} <span aria-hidden="true">/</span> <span aria-current="page">{trail.label}</span>
          </nav>
        ) : null}
        <h1 className="truncate text-2xl font-bold text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

/** Shell ứng dụng: sidebar (desktop, thu gọn được) + topbar + bottom-bar (mobile) + command palette + shortcuts help */
export function AppShell({
  user,
  onLogout,
  children,
  notifications = [],
  onNotificationClick,
  onViewAllNotifications,
}: AppShellProps) {
  const pathname = usePathname();
  const { open: commandOpen, openPalette, closePalette } = useCommandPalette();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem("app:sidebar") === "collapsed";
    } catch {
      return false;
    }
  });

  const toggleSidebar = useCallback(() => {
    setCollapsed((v) => {
      try {
        window.localStorage.setItem("app:sidebar", v ? "expanded" : "collapsed");
      } catch {
        /* ignore */
      }
      return !v;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Toggle shortcuts help with ?
      if (e.key === "?" && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
      // Close shortcuts help with Escape
      if (e.key === "Escape" && shortcutsOpen) {
        setShortcutsOpen(false);
      }
    },
    [shortcutsOpen]
  );

  useEffect(() => {
    document.body.dataset.hydrated = "1";
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!user) {
    return <div className="min-h-full">{children}</div>;
  }

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(user.role)),
  })).filter((g) => g.items.length > 0);
  const mobile = primaryMobileNav(user.role);
  const initial = (user.displayName || user.email || "?").trim().charAt(0).toUpperCase();

  // Keyboard shortcuts for help dialog
  const shortcuts: KeyboardShortcut[] = [
    { key: "⌘K", description: "Mở Command Palette", category: "Điều hướng" },
    { key: "⌘/", description: "Hiển thị phím tắt", category: "Điều hướng" },
    { key: "Esc", description: "Đóng dialog/menu", category: "Điều hướng" },
    { key: "Tab", description: "Di chuyển giữa các phần tử", category: "Điều hướng" },
    { key: "Enter", description: "Xác nhận/Chọn", category: "Hành động" },
    { key: "← →", description: "Di chuyển bước (stepper)", category: "Chấm công" },
    { key: "Space", description: "Chụp ảnh (khi camera active)", category: "Chấm công" },
  ];

  // User menu items
  const userMenuItems = [
    { label: "Hồ sơ cá nhân", icon: <Icon name="user" size={16} />, onClick: () => window.location.href = "/settings/profile" },
    { label: "Cài đặt thông báo", icon: <Icon name="alert" size={16} />, onClick: () => window.location.href = "/settings/notifications" },
    { label: "Bảo mật & 2FA", icon: <Icon name="shield" size={16} />, onClick: () => window.location.href = "/settings/security" },
    { label: "Đăng xuất", icon: <Icon name="logout" size={16} />, onClick: onLogout, danger: true },
  ];

  return (
    <div className="flex min-h-full">
      {/* Sidebar desktop */}
      <nav
        aria-label="Điều hướng chính"
        className={`sticky top-0 hidden h-screen shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white p-3 transition-[width] lg:flex ${collapsed ? "w-[72px]" : "w-60"}`}
      >
        <div className={`flex items-center gap-2 px-1 ${collapsed ? "justify-center" : ""}`}>
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] font-bold text-white">
            A
          </span>
          {!collapsed ? (
            <span className="truncate text-sm font-bold text-slate-900">AI Face Attendance</span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-4">
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-1">
              {!collapsed ? (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.title}</p>
              ) : null}
              {g.items.map((i) => (
                <NavLink key={i.href} href={i.href} label={i.label} icon={i.icon} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
          aria-expanded={!collapsed}
          className="flex h-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} />
        </button>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
          <span className="truncate text-sm font-semibold text-slate-800 lg:hidden">AI Face Attendance</span>
          <span className="hidden text-sm text-slate-500 lg:block">
            {findTrail(pathname)?.label ?? ""}
          </span>
          <div className="flex items-center gap-2">
            {/* Command Palette Trigger */}
            <IconButton
              icon="search"
              label="Tìm kiếm lệnh (⌘K)"
              variant="ghost"
              size="md"
              onClick={openPalette}
            >
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded">
                ⌘K
              </kbd>
            </IconButton>

            {/* Shortcuts Help Trigger */}
            <IconButton
              icon="info"
              label="Phím tắt (⌘/)"
              variant="ghost"
              size="md"
              onClick={() => setShortcutsOpen(true)}
            >
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded">
                ⌘/
              </kbd>
            </IconButton>

            {/* Notification Bell */}
            <NotificationBell
              notifications={notifications}
              onNotificationClick={onNotificationClick}
              onViewAll={onViewAllNotifications}
              maxVisible={5}
            />

            {/* User Menu */}
            <UserMenu
              user={{
                displayName: user.displayName,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
              }}
              items={userMenuItems}
              showAvatar={true}
              showName={true}
            />
          </div>
        </header>

        {/* Nội dung (trang tự quản max-width/padding) */}
        <div className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</div>

        {/* Bottom-bar mobile */}
        <nav aria-label="Điều hướng nhanh" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${mobile.length}, 1fr)` }}>
            {mobile.map((i) => (
              <NavLink key={i.href} href={i.href} label={i.label} icon={i.icon} vertical />
            ))}
          </div>
        </nav>
      </div>

    <CommandPalette
      open={commandOpen}
      onClose={closePalette}
      items={[
        // Navigation
        { key: "nav-dashboard", label: "Dashboard", description: "Xem tổng quan hôm nay", icon: <Icon name="home" size={16} />, shortcut: "G D", group: "Điều hướng", action: () => window.location.href = "/dashboard" },
        { key: "nav-checkin", label: "Chấm công", description: "Check-in/Check-out bằng khuôn mặt", icon: <Icon name="camera" size={16} />, shortcut: "G C", group: "Điều hướng", action: () => window.location.href = "/check-in" },
        { key: "nav-history", label: "Lịch sử chấm công", description: "Xem lịch sử cá nhân", icon: <Icon name="clock" size={16} />, shortcut: "G H", group: "Điều hướng", action: () => window.location.href = "/history" },
        { key: "nav-enrollment", label: "Đăng ký khuôn mặt", description: "Quản lý mẫu khuôn mặt", icon: <Icon name="user" size={16} />, shortcut: "G E", group: "Điều hướng", action: () => window.location.href = "/enrollment" },
        { key: "nav-adjustments", label: "Chỉnh sửa công", description: "Tạo/yêu cầu chỉnh công", icon: <Icon name="file" size={16} />, shortcut: "G A", group: "Điều hướng", action: () => window.location.href = "/adjustments" },
        { key: "nav-leave", label: "Đơn nghỉ phép", description: "Tạo/xem đơn nghỉ", icon: <Icon name="calendar" size={16} />, shortcut: "G L", group: "Điều hướng", action: () => window.location.href = "/leave" },
        { key: "nav-reports", label: "Báo cáo chấm công", description: "Xem báo cáo & xuất CSV", icon: <Icon name="flag" size={16} />, shortcut: "G R", group: "Điều hướng", action: () => window.location.href = "/reports" },

        // Admin (HR only)
        ...(["hr_admin", "system_admin"].includes(user.role) ? [
          { key: "admin-employees", label: "Quản lý nhân viên", description: "CRUD nhân viên, import", icon: <Icon name="users" size={16} />, group: "Quản trị", action: () => window.location.href = "/admin/employees" },
          { key: "admin-shifts", label: "Quản lý ca làm", description: "Tạo ca, phân ca, lịch", icon: <Icon name="calendar" size={16} />, group: "Quản trị", action: () => window.location.href = "/admin/shifts" },
          { key: "admin-enrollments", label: "Xác minh khuôn mặt", description: "Duyệt/từ chối đăng ký", icon: <Icon name="shield" size={16} />, group: "Quản trị", action: () => window.location.href = "/admin/enrollments" },
          { key: "admin-audit", label: "Nhật ký Audit", description: "Xem log hệ thống", icon: <Icon name="file" size={16} />, group: "Quản trị", action: () => window.location.href = "/audit" },
        ] : []),

        // Actions
        { key: "action-refresh", label: "Làm mới trang", description: "Tải lại dữ liệu", icon: <Icon name="refresh" size={16} />, shortcut: "⌘R", group: "Hành động", action: () => window.location.reload() },
        { key: "action-profile", label: "Hồ sơ cá nhân", description: "Cập nhật thông tin", icon: <Icon name="user" size={16} />, group: "Hành động", action: () => window.location.href = "/settings/profile" },
        { key: "action-settings", label: "Cài đặt", description: "Cài đặt ứng dụng", icon: <Icon name="shield" size={16} />, group: "Hành động", action: () => window.location.href = "/settings" },
      ]}
      title="Command Palette"
      placeholder="Tìm kiếm lệnh, trang, hoặc hành động..."
    />

    <ShortcutsHelp
      open={shortcutsOpen}
      onClose={() => setShortcutsOpen(false)}
      shortcuts={shortcuts}
      title="Phím tắt bàn phím"
    />
  </div>
  );
}