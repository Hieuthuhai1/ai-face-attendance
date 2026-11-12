import type { Role } from "@/types/db";
import type { IconName } from "@/components/ui/icon";

export interface NavItem {
  href: string;
  label: string;
  /** Nhãn ngắn cho bottom-bar mobile (tránh cắt chữ). */
  short?: string;
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

/**
 * Cấu trúc sidebar dùng chung cho desktop + mobile drawer.
 * Thứ tự nhóm phản ánh luồng làm việc: Tổng quan → Quản trị nhân sự →
 * Đơn từ → Hệ thống. Mỗi mục vẫn giữ RBAC theo role.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Tổng quan",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ALL },
      { href: "/check-in", label: "Chấm công", icon: "camera", roles: ALL },
      { href: "/enrollment", label: "Nhận diện khuôn mặt AI", icon: "scan-face", roles: ALL },
      { href: "/history", label: "Lịch sử chấm công", short: "Lịch sử", icon: "clock", roles: ALL },
    ],
  },
  {
    title: "Quản trị nhân sự",
    items: [
      { href: "/admin/employees", label: "Nhân viên", icon: "users", roles: HR },
      { href: "/admin/attendance", label: "Chấm công toàn thể", icon: "chart", roles: REVIEW },
      { href: "/admin/shifts", label: "Ca làm việc", icon: "calendar", roles: HR },
      { href: "/reports", label: "Báo cáo thống kê", short: "Báo cáo", icon: "chart", roles: REVIEW },
      { href: "/approval", label: "Trung tâm duyệt", icon: "clipboard-check", roles: REVIEW },
      { href: "/admin/enrollments", label: "Xác minh khuôn mặt", icon: "shield", roles: REVIEW },
      { href: "/audit", label: "Nhật ký Audit", icon: "file-text", roles: HR },
    ],
  },
  {
    title: "Đơn từ",
    items: [
      { href: "/requests", label: "Yêu cầu của tôi", icon: "file-text", roles: ALL },
      { href: "/adjustments", label: "Chỉnh công", icon: "file", roles: ALL },
      { href: "/leave", label: "Đơn nghỉ", icon: "calendar", roles: ALL },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { href: "/settings/profile", label: "Tài khoản", icon: "id-card", roles: ALL },
      { href: "/settings", label: "Cài đặt", icon: "settings", roles: HR },
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

/**
 * Chuẩn hóa so khớp active: đúng trang hoặc con của nó.
 * `/settings` là mục gốc nên chỉ active khi đúng path — tránh việc
 * `/settings/profile` làm sáng cả "Cài đặt" và "Tài khoản".
 */
export function isActiveItem(pathname: string, href: string): boolean {
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Route công khai (không shell). */
export function isPublicRoute(pathname: string): boolean {
  return pathname === "/" || pathname === "/login" || pathname.startsWith("/auth/");
}
