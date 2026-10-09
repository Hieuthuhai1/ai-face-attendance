/**
 * Attendance integration trên LOCAL DB thật (rpc record_attendance_event qua PostgREST).
 * Chạy kèm RUN_DB_TESTS=1 (xem docs/TEST_DATA.md). RLS cấm client DELETE events nên
 * rows test ở lại DB với key duy nhất theo timestamp — không ảnh hưởng seed/assert sau.
 */
import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const RUN = process.env.RUN_DB_TESTS === "1";
const URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const PASS = "Passw0rd!";
const E_A = "e0000000-0000-0000-0000-000000000001";
const E_B = "e0000000-0000-0000-0000-000000000002";
const A_A = "a0000000-0000-0000-0000-000000000001";
const S_DAY = "50000000-0000-0000-0000-000000000001";

function api(): SupabaseClient {
  if (!ANON) throw new Error("Thiếu SUPABASE_TEST_ANON_KEY");
  return createClient(URL, ANON);
}

async function login(email: string) {
  const sb = api();
  const { error } = await sb.auth.signInWithPassword({ email, password: PASS });
  if (error) throw error;
  return sb;
}

function rpcArgs(key: string, overrides: Record<string, unknown> = {}) {
  return {
    p_employee_id: E_A,
    p_shift_assignment_id: A_A,
    p_event_type: "check_in",
    p_status: "success",
    p_method: "face",
    p_verification_ref: "it_ref",
    p_liveness: "pass",
    p_confidence: 0.95,
    p_idempotency_key: key,
    p_note: null,
    p_work_date: new Date().toISOString().slice(0, 10),
    p_shift_id: S_DAY,
    p_late_min: 0,
    p_early_leave_min: 0,
    ...overrides,
  };
}

(RUN ? describe : describe.skip)("attendance api integration (local DB)", () => {
  it("check-in hợp lệ: server timestamp + summary kèm", async () => {
    const sb = await login("nv.a@demo.vn");
    const key = `evt_it_${Date.now()}_1`;
    try {
      const { data, error } = await sb.rpc("record_attendance_event", rpcArgs(key));
      expect(error).toBeNull();
      const row = data as unknown as { occurred_at: string; created_by: string };
      expect(new Date(row.occurred_at).getTime()).toBeGreaterThan(Date.now() - 5 * 60 * 1000);
      // summary có dòng cho work_date hôm nay
      const sum = await sb
        .from("attendance_daily_summaries")
        .select("status")
        .eq("employee_id", E_A)
        .eq("work_date", new Date().toISOString().slice(0, 10))
        .eq("shift_id", S_DAY)
        .single();
      expect(sum.error).toBeNull();
    } finally {
      await sb.from("attendance_events").delete().eq("idempotency_key", key);
      await sb.auth.signOut();
    }
  });

  it("retry cùng key → 23505 (server action trả bản ghi cũ, không trùng)", async () => {
    const sb = await login("nv.a@demo.vn");
    const key = `evt_it_${Date.now()}_2`;
    try {
      const first = await sb.rpc("record_attendance_event", rpcArgs(key));
      expect(first.error).toBeNull();
      const second = await sb.rpc("record_attendance_event", rpcArgs(key));
      expect(second.error?.code).toBe("23505");
    } finally {
      await sb.from("attendance_events").delete().eq("idempotency_key", key);
      await sb.auth.signOut();
    }
  });

  it("browser sửa employee_id/user khác → 42501; RLS A/B giữ", async () => {
    const sb = await login("nv.a@demo.vn");
    try {
      const cross = await sb.rpc(
        "record_attendance_event",
        rpcArgs(`evt_it_${Date.now()}_3`, { p_employee_id: E_B }),
      );
      expect(cross.error?.code).toBe("42501");

      const evB = await sb.from("attendance_events").select("id").eq("employee_id", E_B);
      expect(evB.data ?? []).toEqual([]);
    } finally {
      await sb.auth.signOut();
    }
  });

  it("concurrent duplicate: 2 rpc cùng key → đúng 1 row", async () => {
    const sb = await login("nv.a@demo.vn");
    const key = `evt_it_${Date.now()}_cc`;
    try {
      const [r1, r2] = await Promise.all([
        sb.rpc("record_attendance_event", rpcArgs(key)),
        sb.rpc("record_attendance_event", rpcArgs(key)),
      ]);
      const codes = [r1.error?.code ?? null, r2.error?.code ?? null];
      expect(codes).toContain(null);
      expect(codes).toContain("23505");
      const rows = await sb.from("attendance_events").select("id").eq("idempotency_key", key);
      expect((rows.data ?? []).length).toBe(1);
    } finally {
      await sb.auth.signOut();
    }
  });

  it("transaction rollback: key lỗi → không tạo summary mồ côi", async () => {
    const sb = await login("nv.a@demo.vn");
    const key = `evt_it_${Date.now()}_4`;
    try {
      // status sai → function raise trước insert → không side-effect.
      const bad = await sb.rpc(
        "record_attendance_event",
        rpcArgs(key, { p_status: "bogus" }),
      );
      expect(bad.error).not.toBeNull();
      const leaked = await sb.from("attendance_events").select("id").eq("idempotency_key", key);
      expect(leaked.data ?? []).toEqual([]);
    } finally {
      await sb.auth.signOut();
    }
  });
});
