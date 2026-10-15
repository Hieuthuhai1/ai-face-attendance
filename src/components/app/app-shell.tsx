"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Role } from "@/types/db";
import { Icon, type IconName } from "@/components/ui/icon";
import {
  findTrail,
  isActiveItem,
  NAV_GROUPS,
  primaryMobileNav,
} from "./nav";

export interface ShellUser {
  displayName: string;
  email: string;
  role: Role;
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

/** Shell ứng dụng: sidebar (desktop, thu gọn được) + topbar + bottom-bar (mobile). */
export function AppShell({
  user,
  onLogout,
  children,
}: {
  user: ShellUser | null;
  onLogout: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Đánh dấu đã hydrate xong — E2E chờ marker này trước khi click (tránh click
  // vào HTML tĩnh chưa gắn handler).
  useEffect(() => {
    document.body.dataset.hydrated = "1";
  }, []);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem("app:sidebar") === "collapsed";
    } catch {
      return false;
    }
  });

  function toggle() {
    setCollapsed((v) => {
      try {
        window.localStorage.setItem("app:sidebar", v ? "expanded" : "collapsed");
      } catch {
        /* bỏ qua */
      }
      return !v;
    });
  }

  if (!user) {
    return <div className="min-h-full">{children}</div>;
  }

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(user.role)),
  })).filter((g) => g.items.length > 0);
  const mobile = primaryMobileNav(user.role);
  const initial = (user.displayName || user.email || "?").trim().charAt(0).toUpperCase();

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
            onClick={toggle}
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
              <span
                aria-hidden="true"
                title={user.email}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand-strong)]"
              >
                {initial}
              </span>
              <div className="hidden min-w-0 flex-col leading-tight sm:flex">
                <span className="truncate text-sm font-medium text-slate-800">{user.displayName || user.email}</span>
                <span className="text-xs text-slate-500">{user.role}</span>
              </div>
              <form action={onLogout}>
                <button
                  type="submit"
                  aria-label="Đăng xuất"
                  title="Đăng xuất"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <Icon name="logout" size={18} />
                </button>
              </form>
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
      </div>
  );
}

