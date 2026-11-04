import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client dùng service role — CHỈ import từ code server.
 * Dùng cho dữ liệu không được phép lộ qua RLS (ví dụ face_templates descriptor).
 * KHÔNG bao giờ trả client này hoặc dữ liệu nó đọc về browser.
 */

let cached: SupabaseClient | null = null;

/** Kiểm tra cấu hình mà không lộ giá trị secret. */
export function isServiceClientConfigured(env = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình cho server.");
  }
  if (!cached) {
    cached = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return cached;
}
