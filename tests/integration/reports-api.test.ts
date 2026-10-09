/**
 * Report scope integration trên LOCAL DB thật.
 * Chạy kèm RUN_DB_TESTS=1. Export CSV action cần session Next nên E2E ở Phase 9;
 * ở đây kiểm tra scope dữ liệu + policy audit mà export phụ thuộc.
 */
import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const RUN = process.env.RUN_DB_TESTS === "1";
const URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const PASS = "Passw0rd!";
const E_A = "e0000000-0000-0000-0000-000000000001";
const E_B = "e0000000-0000-0000-0000-000000000002";
const E_MGR = "e0000000-0000-0000-0000-000000000003";
const ORG = "11111111-1111-1111-1111-111111111111";

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

(RUN ? describe : describe.skip)("reports api integration (local DB)", () => {
  it("employee A chỉ thấy summary mình (user A/B)", async () => {
    const sb = await login("nv.a@demo.vn");
    try {
      const res = await sb.from("attendance_daily_summaries").select("employee_id, work_date");
      expect(res.error).toBeNull();
      expect(res.data?.length).toBeGreaterThan(0);
      expect(res.data?.every((r) => r.employee_id === E_A)).toBe(true);
    } finally {
      await sb.auth.signOut();
    }
  });

  it("manager chỉ thấy team + chính mình", async () => {
    const sb = await login("quan.ly@demo.vn");
    try {
      const res = await sb.from("attendance_daily_summaries").select("employee_id");
      expect(res.error).toBeNull();
      const ids = new Set((res.data ?? []).map((r) => r.employee_id as string));
      for (const id of ids) {
        expect([E_A, E_B, E_MGR].includes(id)).toBe(true);
      }
    } finally {
      await sb.auth.signOut();
    }
  });

  it("manager ghi audit export (policy cho exportCsv)", async () => {
    const sb = await login("quan.ly@demo.vn");
    try {
      const ins = await sb.from("audit_logs").insert({
        organization_id: ORG,
        actor_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        action: "report.export",
        resource_type: "attendance_report",
        resource_id: "it_range",
        metadata: { rows: 1 },
      });
      expect(ins.error).toBeNull();
    } finally {
      await sb.auth.signOut();
    }
  });

  it("lọc khoảng ngày biên (date boundary)", async () => {
    const sb = await login("hr@demo.vn");
    try {
      const res = await sb
        .from("attendance_daily_summaries")
        .select("work_date")
        .eq("employee_id", E_A)
        .gte("work_date", "2026-10-09")
        .lte("work_date", "2026-10-09");
      expect(res.error).toBeNull();
      expect(res.data?.every((r) => r.work_date === "2026-10-09")).toBe(true);
    } finally {
      await sb.auth.signOut();
    }
  });
});
