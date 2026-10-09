import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types/db";

/** Session + profile đáng tin cậy phía server (đọc từ DB, không tin client). */
export async function requireUser(): Promise<{ userId: string; profile: Profile }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, organization_id, is_active")
    .eq("id", user.id)
    .single();
  if (error || !profile || !profile.is_active) redirect("/login");
  return { userId: user.id, profile: profile as Profile };
}

/** Guard theo role — chặn server-side, không chỉ ẩn nút UI. */
export async function requireRole(allowed: Role[]): Promise<{ userId: string; profile: Profile }> {
  const session = await requireUser();
  if (!allowed.includes(session.profile.role)) redirect("/dashboard?forbidden=1");
  return session;
}
