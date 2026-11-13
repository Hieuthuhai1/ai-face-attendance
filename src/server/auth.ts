import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types/db";

/**
 * Session + profile đáng tin cậy phía server (đọc từ DB, không tin client).
 *
 * Bọc `cache()` để mỗi request chỉ gọi Supabase Auth + query profile MỘT lần,
 * dù ShellHost và page (hoặc nhiều server action con) cùng gọi requireUser.
 * Trước đây dashboard gọi 8 lần song song → 8 round-trip auth, làm TTFB chậm.
 */
export const requireUser = cache(async (): Promise<{ userId: string; profile: Profile }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, organization_id, is_active, locale")
    .eq("id", user.id)
    .single();
  if (error || !profile || !profile.is_active) redirect("/login");
  return { userId: user.id, profile: profile as Profile };
});

/** Guard theo role — chặn server-side, không chỉ ẩn nút UI. */
export const requireRole = cache(
  async (allowed: Role[]): Promise<{ userId: string; profile: Profile }> => {
    const session = await requireUser();
    if (!allowed.includes(session.profile.role)) {
      // Employee bị chặn → về trang chấm công (trang chính cho employee)
      // Manager/HR bị chặn → về dashboard (sẽ hiển thị forbidden message)
      const fallback = session.profile.role === "employee" ? "/check-in" : "/dashboard?forbidden=1";
      redirect(fallback);
    }
    return session;
  },
);
