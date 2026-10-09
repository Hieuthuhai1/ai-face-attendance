/**
 * Workflow integration trên LOCAL DB thật (adjustments RPC + leave + audit).
 * Chạy kèm RUN_DB_TESTS=1. Rows test dùng ngày riêng, không clash seed.
 */
import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const RUN = process.env.RUN_DB_TESTS === "1";
const URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const PASS = "Passw0rd!";
const E_A = "e0000000-0000-0000-0000-000000000001";
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

(RUN ? describe : describe.skip)("workflow api integration (local DB)", () => {
  it("employee tạo request + trùng pending cùng ngày bị chặn", async () => {
    const sb = await login("nv.a@demo.vn");
    let reqId = "";
    try {
      const day = "2026-10-11";
      const first = await sb
        .from("attendance_adjustment_requests")
        .insert({
          organization_id: ORG,
          employee_id: E_A,
          work_date: day,
          requested_in: `${day}T08:00:00+07:00`,
          reason: "integration test",
          status: "pending",
        })
        .select("id")
        .single();
      expect(first.error).toBeNull();
      reqId = (first.data as unknown as { id: string }).id;
      const dup = await sb.from("attendance_adjustment_requests").insert({
        organization_id: ORG,
        employee_id: E_A,
        work_date: day,
        requested_out: `${day}T17:00:00+07:00`,
        reason: "trung",
        status: "pending",
      });
      expect(dup.error?.code).toBe("23505");
    } finally {
      await sb.auth.signOut();
    }
    // Tự dọn: duyệt luôn để lần chạy sau không vướng unique pending.
    if (reqId) {
      const mgr = await login("quan.ly@demo.vn");
      try {
        await mgr.rpc("decide_adjustment_request", { p_request_id: reqId, p_decision: "approved", p_note: "cleanup" });
      } finally {
        await mgr.auth.signOut();
      }
    }
  });

  it("manager duyệt qua RPC + idempotent + audit; employee bị chặn", async () => {
    const emp = await login("nv.a@demo.vn");
    let reqId = "";
    try {
      const created = await emp
        .from("attendance_adjustment_requests")
        .insert({
          organization_id: ORG,
          employee_id: E_A,
          work_date: "2026-10-12",
          requested_out: "2026-10-12T17:05:00+07:00",
          reason: "integration duyet",
          status: "pending",
        })
        .select("id")
        .single();
      expect(created.error).toBeNull();
      reqId = (created.data as unknown as { id: string }).id;
    } finally {
      await emp.auth.signOut();
    }

    const mgr = await login("quan.ly@demo.vn");
    try {
      const ok = await mgr.rpc("decide_adjustment_request", {
        p_request_id: reqId,
        p_decision: "approved",
        p_note: "ok",
      });
      expect(ok.error).toBeNull();
      const again = await mgr.rpc("decide_adjustment_request", {
        p_request_id: reqId,
        p_decision: "rejected",
        p_note: "doi y",
      });
      expect(again.error?.message).toBe("ALREADY_DECIDED");
    } finally {
      await mgr.auth.signOut();
    }

    const empA2 = await login("nv.a@demo.vn");
    let pendingId = "";
    try {
      const created = await empA2
        .from("attendance_adjustment_requests")
        .insert({
          organization_id: ORG,
          employee_id: E_A,
          work_date: "2026-10-13",
          requested_in: "2026-10-13T08:00:00+07:00",
          reason: "integration 42501",
          status: "pending",
        })
        .select("id")
        .single();
      expect(created.error).toBeNull();
      pendingId = (created.data as unknown as { id: string }).id;
    } finally {
      await empA2.auth.signOut();
    }

    const empB = await login("nv.b@demo.vn");
    try {
      const forbidden = await empB.rpc("decide_adjustment_request", {
        p_request_id: pendingId,
        p_decision: "approved",
        p_note: "x",
      });
      expect(forbidden.error?.code).toBe("42501");
    } finally {
      await empB.auth.signOut();
    }
    // Tự dọn pending kiểm tra 42501.
    const mgr2 = await login("quan.ly@demo.vn");
    try {
      await mgr2.rpc("decide_adjustment_request", { p_request_id: pendingId, p_decision: "rejected", p_note: "cleanup" });
    } finally {
      await mgr2.auth.signOut();
    }

    const hr = await login("hr@demo.vn");
    try {
      const audits = await hr
        .from("audit_logs")
        .select("id")
        .eq("action", "adjustment.approved")
        .eq("resource_id", reqId);
      expect(audits.error).toBeNull();
      expect((audits.data ?? []).length).toBe(1);
    } finally {
      await hr.auth.signOut();
    }
  });

  it("leave: tạo + manager duyệt đơn team", async () => {
    // Ngày động theo lần chạy để không clash với rows các lần trước.
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const start = fmt(new Date(Date.now() + 30 * 86400000));
    const end = fmt(new Date(Date.now() + 31 * 86400000));
    const emp = await login("nv.b@demo.vn");
    try {
      const created = await emp.from("leave_requests").insert({
        organization_id: ORG,
        employee_id: "e0000000-0000-0000-0000-000000000002",
        leave_type: "sick",
        start_date: start,
        end_date: end,
        reason: "integration nghi om",
        status: "pending",
      });
      expect(created.error).toBeNull();
    } finally {
      await emp.auth.signOut();
    }
    const mgr = await login("quan.ly@demo.vn");
    try {
      const up = await mgr
        .from("leave_requests")
        .update({ status: "approved" })
        .eq("employee_id", "e0000000-0000-0000-0000-000000000002")
        .eq("start_date", start)
        .eq("status", "pending")
        .select("id");
      expect(up.error).toBeNull();
      expect((up.data ?? []).length).toBe(1);
    } finally {
      await mgr.auth.signOut();
    }
  });
});
