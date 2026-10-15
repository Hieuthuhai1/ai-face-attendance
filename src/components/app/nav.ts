import type { Role } from "@/types/db";
import type { IconName } from "@/components/ui/icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  roles: Role[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const ALL: Role[] = ["employee", "manager", "hr_admin", "system_admin"];
const REVIEW: Role[] = ["manager", "hr_admin", "system_admin"];
const HR: Role[] = ["hr_admin", "system_admin"];

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Chấm công",
    items: [
      { href: "/dashboard", label: "Hôm nay", icon: "home", roles: ALL },
      { href: "/check-in", label: "Chấm công", icon: "camera", roles: ALL },
      { href: "/history", label: "Lịch sử", icon: "clock", roles: ALL },
      { href: "/enrollment", label: "Khuôn mặt", icon: "user", roles: ALL },
    ],
  },
  {
    title: "Đơn từ",
    items: [
      { href: "/adjustments", label: "Chỉnh công", icon: "file", roles: ALL },
      { href: "/leave", label: "Đơn nghỉ", icon: "calendar", roles: ALL },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { href: "/reports", label: "Báo cáo", icon: "flag", roles: REVIEW },
      { href: "/admin/employees", label: "Nhân viên", icon: "users", roles: HR },
      { href: "/admin/shifts", label: "Ca làm", icon: "calendar", roles: HR },
      { href: "/admin/enrollments", label: "Xác minh khuôn mặt", icon: "shield", roles: HR },
      { href: "/audit", label: "Audit", icon: "file", roles: HR },
    ],
  },
];

/** Toàn bộ mục menu mà role được thấy (phẳng, giữ thứ tự nhóm). */
export function navForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return NAV_GROUPS.flatMap((g) => g.items.filter((i) => i.roles.includes(role)));
}

/** 5 mục chính cho bottom-bar mobile (ưu tiên thao tác nhân viên). */
export function primaryMobileNav(role: Role | undefined): NavItem[] {
  const all = navForRole(role);
  const preferred = ["/check-in", "/dashboard", "/history", "/adjustments", "/reports"];
  const picked = preferred.flatMap((href) => all.filter((i) => i.href === href));
  const rest = all.filter((i) => !picked.includes(i));
  return [...picked, ...rest].slice(0, 5);
}

/** Breadcrumb [Nhóm, Trang] cho pathname. */
export function findTrail(pathname: string): { group: string; label: string } | null {
  for (const g of NAV_GROUPS) {
    const item = [...g.items]
      .sort((a, b) => b.href.length - a.href.length)
      .find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
    if (item) return { group: g.title, label: item.label };
  }
  return null;
}

/** Chuẩn hóa so khớp active: đúng trang hoặc con của nó. */
export function isActiveItem(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Route công khai (không shell). */
export function isPublicRoute(pathname: string): boolean {
  return pathname === "/" || pathname === "/login" || pathname.startsWith("/auth/");
}
