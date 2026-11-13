"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Role } from "@/types/db";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { findTrail, isActiveItem, NAV_GROUPS, primaryMobileNav, type NavGroup } from "./nav";
import { UserMenu, NotificationBell, type NotificationItem } from "@/components/ui/user-menu";
import { CommandPalette, ShortcutsHelp, useCommandPalette, type KeyboardShortcut } from "@/components/ui/command-palette";
import { IconButton } from "@/components/ui/icon-button";
import { Avatar } from "@/components/ui/avatar";
import { useLanguage } from "./language-provider";

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

const ROLE_LABELS: Record<Role, string> = {
  employee: "Nhân viên",
  manager: "Quản lý",
  hr_admin: "HR Admin",
  system_admin: "System Admin",
};

const SIDEBAR_BG = "var(--sidebar-gradient)";

function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/dashboard"
      prefetch={false}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]",
        collapsed && "justify-center",
      )}
      aria-label="AI Face Attendance — Dashboard"
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [background-image:var(--brand-gradient)] text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.95)] ring-1 ring-white/20">
        <Icon name="scan-face" size={21} />
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--navy-900)] bg-[var(--accent)]"
        />
      </span>
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold leading-tight tracking-[-0.01em] text-white">
            Timekeeping
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            AI Attendance
          </span>
        </span>
      ) : null}
    </Link>
  );
}

function NavLink({
  href,
  label,
  icon,
  collapsed,
  vertical,
  prefetch,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: IconName;
  collapsed?: boolean;
  vertical?: boolean;
  /** `false` = không prefetch route này khi link vào viewport. */
  prefetch?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const active = isActiveItem(pathname, href);
  const translatedLabel = t(label);

  /**
   * Không prefetch khi link vào viewport (10 route × render server = tải nặng
   * ngay khi mở trang). Chỉ prefetch khi người dùng có ý định bấm (hover/focus)
   * để chuyển trang vẫn nhanh.
   */
  const prefetchOnIntent = () => {
    if (prefetch === false) return;
    router.prefetch(href);
  };

  if (vertical) {
    return (
      <Link
        href={href}
        prefetch={false}
        onMouseEnter={prefetchOnIntent}
        onFocus={prefetchOnIntent}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-medium transition-colors",
          active ? "text-[var(--brand)]" : "text-[var(--text-3)] hover:text-[var(--navy-700)]",
        )}
      >
        <span
          className={cn(
            "flex h-7 w-9 items-center justify-center rounded-lg transition-colors",
            active ? "bg-[var(--brand-soft)]" : "bg-transparent",
          )}
        >
          <Icon name={icon} size={19} />
        </span>
        <span className="w-full truncate text-center leading-tight">{translatedLabel}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={prefetchOnIntent}
      onFocus={prefetchOnIntent}
      aria-current={active ? "page" : undefined}
      title={collapsed ? translatedLabel : undefined}
      onClick={onNavigate}
      className={cn(
        "group relative flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium transition-all duration-150",
        active
          ? "bg-[var(--brand)] text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.95)]"
          : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
        collapsed && "justify-center px-0",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--accent)]"
        />
      ) : null}
      <Icon
        name={icon}
        size={18}
        className={cn(
          "shrink-0 transition-colors",
          active ? "text-white" : "text-slate-400 group-hover:text-slate-200",
        )}
      />
      {!collapsed ? <span className="truncate">{translatedLabel}</span> : null}
    </Link>
  );
}

function SidebarNav({
  groups,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          {!collapsed ? (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400/80">
              {t(group.title)}
            </p>
          ) : (
            <span aria-hidden="true" className="mx-auto mb-1 h-px w-6 bg-white/10" />
          )}
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const { t } = useLanguage();
  const trail = findTrail(pathname);

  return (
    <>
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[13px] sm:flex">
        <Link
          href="/dashboard"
          prefetch={false}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--brand)]"
          aria-label="Dashboard"
        >
          <Icon name="home" size={15} />
        </Link>
        {trail ? (
          <>
            <Icon name="chevron-right" size={13} className="hidden shrink-0 text-slate-300 xl:block" />
            <span className="hidden truncate text-[var(--text-3)] xl:inline">{t(trail.group)}</span>
            <Icon name="chevron-right" size={13} className="shrink-0 text-slate-300" />
            <span className="truncate font-semibold text-[var(--navy-800)]">{t(trail.label)}</span>
          </>
        ) : (
          <>
            <Icon name="chevron-right" size={13} className="shrink-0 text-slate-300" />
            <span className="font-semibold text-[var(--navy-800)]">AI Attendance</span>
          </>
        )}
      </nav>
      <span className="truncate text-sm font-semibold text-[var(--navy-800)] sm:hidden">
        {trail ? t(trail.short ?? trail.label) : "AI Attendance"}
      </span>
    </>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  icon,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Nhãn nhỏ phía trên tiêu đề (vd: "ĐIỂM DANH AI"). */
  eyebrow?: string;
  /** Icon hiển thị cạnh tiêu đề. */
  icon?: IconName;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="eyebrow mb-1.5 flex items-center gap-1.5">
            {icon ? <Icon name={icon} size={13} className="text-[var(--brand)]" /> : null}
            {t(eyebrow)}
          </p>
        ) : null}
        <div className="flex items-center gap-2.5">
          {!eyebrow && icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-icon)] bg-[var(--brand-soft)] text-[var(--brand)] ring-1 ring-inset ring-blue-100">
              <Icon name={icon} size={18} />
            </span>
          ) : null}
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.025em] text-[var(--navy-900)] sm:text-[27px]">
            {t(title)}
          </h1>
        </div>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[var(--text-2)]">
            {t(description)}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
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
  const router = useRouter();
  const { t } = useLanguage();
  const { open: commandOpen, openPalette, closePalette } = useCommandPalette();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Đóng drawer khi đổi route
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đóng drawer sau khi điều hướng
    setMobileOpen(false);
  }, [pathname]);

  // Khoá scroll nền khi drawer mở
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Toggle shortcuts help with ?
      if (e.key === "?" && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
      // Close overlays with Escape
      if (e.key === "Escape") {
        if (shortcutsOpen) setShortcutsOpen(false);
        if (mobileOpen) setMobileOpen(false);
      }
    },
    [shortcutsOpen, mobileOpen]
  );

  useEffect(() => {
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
  const roleLabel = ROLE_LABELS[user.role];

  // Keyboard shortcuts for help dialog
  const shortcuts: KeyboardShortcut[] = [
    { key: "⌘K", description: t("Mở Command Palette"), category: t("Điều hướng") },
    { key: "⌘/", description: t("Hiển thị phím tắt"), category: t("Điều hướng") },
    { key: "Esc", description: t("Đóng dialog/menu"), category: t("Điều hướng") },
    { key: "Tab", description: t("Di chuyển giữa các phần tử"), category: t("Điều hướng") },
    { key: "Enter", description: t("Xác nhận/Chọn"), category: t("Hành động") },
    { key: "← →", description: t("Di chuyển bước (stepper)"), category: t("Chấm công") },
    { key: "Space", description: t("Chụp ảnh (khi camera active)"), category: t("Chấm công") },
  ];

  // User menu items
  const userMenuItems = [
    { label: t("Tài khoản"), icon: <Icon name="id-card" size={16} />, onClick: () => router.push("/settings/profile") },
    { label: t("Đăng xuất"), icon: <Icon name="logout" size={16} />, onClick: onLogout, danger: true },
  ];

  return (
    <div className="flex min-h-dvh bg-[var(--background)]">
      {/* Sidebar desktop */}
      <nav
        aria-label={t("Điều hướng chính")}
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-white/5 shadow-[var(--shadow-sidebar)] transition-[width] duration-200 lg:flex",
          collapsed ? "w-[var(--sidebar-w-collapsed)]" : "w-[var(--sidebar-w)]",
        )}
        style={{ backgroundImage: SIDEBAR_BG }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-16 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className={cn("relative flex h-[var(--topbar-h)] shrink-0 items-center px-5", collapsed && "justify-center px-2")}>
          <BrandMark collapsed={collapsed} />
        </div>

        <div className="scrollbar-dark relative flex-1 overflow-y-auto px-3 py-3">
          <SidebarNav groups={groups} collapsed={collapsed} />
        </div>

        <div className="relative shrink-0 border-t border-white/[0.07] p-3">
          {!collapsed ? (
            <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5">
              <Avatar name={user.displayName} src={user.avatar} size="sm" className="ring-2 ring-white/10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{user.displayName}</p>
                <p className="truncate text-[11px] text-slate-400">{roleLabel}</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                aria-label={t("Đăng xuất")}
                title={t("Đăng xuất")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon name="logout" size={16} />
              </button>
            </div>
          ) : (
            <div className="mb-2 flex flex-col items-center gap-1.5">
              <Avatar name={user.displayName} src={user.avatar} size="sm" className="ring-2 ring-white/10" />
              <button
                type="button"
                onClick={onLogout}
                aria-label={t("Đăng xuất")}
                title={t("Đăng xuất")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon name="logout" size={16} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={t(collapsed ? "Mở rộng menu" : "Thu gọn menu")}
            aria-expanded={!collapsed}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-[10px] px-3 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white",
              collapsed && "justify-center px-0",
            )}
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
            {!collapsed ? <span>{t("Thu gọn menu")}</span> : null}
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-[var(--topbar-h)] shrink-0 items-center gap-2 border-b border-[var(--border)] bg-white/95 px-4 shadow-[0_1px_2px_rgba(16,27,60,0.04)] backdrop-blur-xl sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t("Mở menu")}
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--navy-800)] lg:hidden"
          >
            <Icon name="menu" size={20} />
          </button>

          <span className="hidden shrink-0 lg:inline-flex">
            <IconButton
              icon="panel-left"
              label={t(collapsed ? "Mở rộng menu" : "Thu gọn menu")}
              variant="ghost"
              size="md"
              onClick={toggleSidebar}
            />
          </span>

          <Breadcrumb pathname={pathname} />

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
            {/* Command Palette Trigger */}
            <button
              type="button"
              onClick={openPalette}
              className="hidden h-10 w-56 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-[13px] text-[var(--text-3)] transition-colors hover:border-[var(--border-strong)] hover:bg-white md:flex lg:w-64"
              aria-label={t("Tìm kiếm lệnh (⌘K)")}
            >
              <Icon name="search" size={16} />
              <span className="flex-1 truncate text-left">{t("Tìm kiếm...")}</span>
              <kbd className="rounded-md border border-[var(--border)] bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--text-3)]">
                ⌘K
              </kbd>
            </button>

            <IconButton
              icon="search"
              label={t("Tìm kiếm lệnh (⌘K)")}
              variant="ghost"
              size="md"
              onClick={openPalette}
              className="md:hidden"
            />

            <span className="hidden shrink-0 sm:inline-flex">
              <IconButton
                icon="help-circle"
                label={t("Phím tắt (⌘/)")}
                variant="ghost"
                size="md"
                onClick={() => setShortcutsOpen(true)}
              />
            </span>

            <NotificationBell
              notifications={notifications}
              onNotificationClick={onNotificationClick}
              onViewAll={onViewAllNotifications}
              maxVisible={5}
            />

            <span aria-hidden="true" className="mx-0.5 hidden h-8 w-px bg-[var(--border)] sm:block" />

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

        {/* Nội dung (trang tự quản padding qua .page-shell) */}
        <div className="min-w-0 flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </div>

        {/* Bottom-bar mobile */}
        <nav
          aria-label={t("Điều hướng nhanh")}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-12px_rgba(16,27,60,0.25)] backdrop-blur-xl lg:hidden"
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${mobile.length}, minmax(0, 1fr))` }}>
            {mobile.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.short ?? item.label}
                icon={item.icon}
                vertical
                // Thanh dưới chỉ hiện trên mobile nhưng vẫn nằm trong DOM ở
                // desktop → prefetch trùng với sidebar. Tắt để không tải 2 lần.
                prefetch={false}
              />
            ))}
          </div>
        </nav>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("Điều hướng chính")}>
          <div
            className="absolute inset-0 bg-[var(--navy-950)]/60 backdrop-blur-sm animate-fade-in"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[286px] max-w-[86vw] flex-col overflow-hidden shadow-2xl animate-slide-in"
            style={{ backgroundImage: SIDEBAR_BG }}
          >
            <div className="flex h-[var(--topbar-h)] shrink-0 items-center justify-between px-5">
              <BrandMark />
              <button
                type="button"
                onClick={closeMobile}
                aria-label={t("Đóng")}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="scrollbar-dark flex-1 overflow-y-auto px-3 py-3">
              <SidebarNav groups={groups} collapsed={false} onNavigate={closeMobile} />
            </div>
            <div className="shrink-0 border-t border-white/[0.07] p-4">
              <div className="flex items-center gap-2.5">
                <Avatar name={user.displayName} src={user.avatar} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
                  <p className="truncate text-xs text-slate-400">{roleLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="mt-3 flex h-10 w-full items-center gap-2 rounded-[10px] border border-white/10 px-3 text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Icon name="logout" size={16} /> {t("Đăng xuất")}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <CommandPalette
        open={commandOpen}
        onClose={closePalette}
        items={[
          // Navigation
          { key: "nav-dashboard", label: "Dashboard", description: "Xem tổng quan hôm nay", icon: <Icon name="dashboard" size={16} />, shortcut: "G D", group: "Điều hướng", action: () => router.push("/dashboard") },
          { key: "nav-checkin", label: "Chấm công", description: "Check-in/Check-out bằng khuôn mặt", icon: <Icon name="camera" size={16} />, shortcut: "G C", group: "Điều hướng", action: () => router.push("/check-in") },
          { key: "nav-history", label: "Lịch sử chấm công", description: "Xem lịch sử cá nhân", icon: <Icon name="clock" size={16} />, shortcut: "G H", group: "Điều hướng", action: () => router.push("/history") },
          { key: "nav-enrollment", label: "Nhận diện khuôn mặt AI", description: "Quản lý mẫu khuôn mặt", icon: <Icon name="scan-face" size={16} />, shortcut: "G E", group: "Điều hướng", action: () => router.push("/enrollment") },
          { key: "nav-requests", label: "Yêu cầu của tôi", description: "Tạo/xem đơn nghỉ & chỉnh công", icon: <Icon name="file-text" size={16} />, shortcut: "G R", group: "Điều hướng", action: () => router.push("/requests") },
          { key: "nav-adjustments", label: "Chỉnh sửa công", description: "Tạo/yêu cầu chỉnh công", icon: <Icon name="file" size={16} />, shortcut: "G A", group: "Điều hướng", action: () => router.push("/adjustments") },
          { key: "nav-leave", label: "Đơn nghỉ phép", description: "Tạo/xem đơn nghỉ", icon: <Icon name="calendar" size={16} />, shortcut: "G L", group: "Điều hướng", action: () => router.push("/leave") },
          { key: "nav-reports", label: "Báo cáo thống kê", description: "Xem báo cáo & xuất CSV", icon: <Icon name="chart" size={16} />, shortcut: "G B", group: "Điều hướng", action: () => router.push("/reports") },
          { key: "nav-approval", label: "Trung tâm duyệt", description: "Duyệt đơn của team/tổ chức", icon: <Icon name="clipboard-check" size={16} />, shortcut: "G P", group: "Điều hướng", action: () => router.push("/approval") },

          // Admin (HR only)
          ...(["hr_admin", "system_admin"].includes(user.role) ? [
            { key: "admin-settings", label: "Cài đặt tổ chức", description: "Chính sách, ngày lễ, vai trò, audit", icon: <Icon name="settings" size={16} />, group: "Quản trị", action: () => router.push("/settings") },
            { key: "admin-employees", label: "Quản lý nhân viên", description: "CRUD nhân viên, import", icon: <Icon name="users" size={16} />, group: "Quản trị", action: () => router.push("/admin/employees") },
            { key: "admin-shifts", label: "Quản lý ca làm", description: "Tạo ca, phân ca, lịch", icon: <Icon name="calendar" size={16} />, group: "Quản trị", action: () => router.push("/admin/shifts") },
            { key: "admin-enrollments", label: "Xác minh khuôn mặt", description: "Duyệt/từ chối đăng ký", icon: <Icon name="shield" size={16} />, group: "Quản trị", action: () => router.push("/admin/enrollments") },
            { key: "admin-audit", label: "Nhật ký Audit", description: "Xem log hệ thống", icon: <Icon name="file-text" size={16} />, group: "Quản trị", action: () => router.push("/audit") },
          ] : []),

          // Actions
          { key: "action-refresh", label: "Làm mới trang", description: "Tải lại dữ liệu", icon: <Icon name="refresh" size={16} />, shortcut: "⌘R", group: "Hành động", action: () => router.refresh() },
          { key: "action-profile", label: "Tài khoản", description: "Cập nhật thông tin", icon: <Icon name="id-card" size={16} />, group: "Hành động", action: () => router.push("/settings/profile") },
          { key: "action-settings", label: "Cài đặt", description: "Cài đặt ứng dụng", icon: <Icon name="settings" size={16} />, group: "Hành động", action: () => router.push("/settings") },
        ].map((item) => ({
          ...item,
          label: t(item.label),
          description: item.description ? t(item.description) : undefined,
          group: item.group ? t(item.group) : undefined,
        }))}
        title={t("Command Palette")}
        placeholder={t("Tìm kiếm lệnh, trang, hoặc hành động...")}
      />

      <ShortcutsHelp
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        shortcuts={shortcuts}
        title={t("Phím tắt bàn phím")}
      />
    </div>
  );
}
