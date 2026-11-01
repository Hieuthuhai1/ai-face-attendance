"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/lib/i18n/config";

const localeSchema = z.enum(["vi", "en"]);

export type UpdateLocaleResult =
  | { ok: true }
  | { ok: false; code: "VALIDATION_ERROR" | "UPDATE_FAILED"; message: string };

/** Persist the signed-in user's display language and mirror it into a cookie. */
export async function updateLocaleAction(locale: string): Promise<UpdateLocaleResult> {
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Ngôn ngữ không hợp lệ.",
    };
  }

  const { userId } = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ locale: parsed.data })
    .eq("id", userId);

  if (error) {
    return {
      ok: false,
      code: "UPDATE_FAILED",
      message: "Không thể cập nhật ngôn ngữ. Vui lòng thử lại.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, parsed.data, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });

  return { ok: true };
}
