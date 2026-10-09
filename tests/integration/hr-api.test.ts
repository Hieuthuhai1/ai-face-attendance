/**
 * Integration tests trên LOCAL Supabase thật (PostgREST + Auth + RLS).
 * Chạy: RUN_DB_TESTS=1 SUPABASE_TEST_URL=... SUPABASE_TEST_ANON_KEY=... npx vitest run tests/integration
 * Không chạy trong CI thiếu Docker (describe.skip). Tự dọn dữ liệu tạm.
 */
import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const RUN = process.env.RUN_DB_TESTS === "1";
const URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? "";

const PASS = "Passw0rd!";
const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const E_A = "e0000000-0000-0000-0000-000000000001";
const E_B = "e0000000-0000-0000-0000-000000000002";
const ORG = "11111111-1111-1111-1111-111111111111";

function api(): SupabaseClient {
  if (!ANON) throw new Error("Thiếu SUPABASE_TEST_ANON_KEY");
  return createClient(URL, ANON);
}

async function login(email: string, password: string = PASS) {
  const sb = api();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { sb, userId: data.user.id };
}

(RUN ? describe : describe.skip)("hr api integration (local DB)", () => {
  it("login đúng/sai + session + logout", async () => {
    const { sb, userId } = await login("nv.a@demo.vn");
    expect(userId).toBe(A);
    const { data } = await sb.auth.getUser();
    expect(data.user?.id).toBe(A);

    const bad = api();
    const wrong = await bad.auth.signInWithPassword({ email: "nv.a@demo.vn", password: "sai" });
    expect(wrong.error).not.toBeNull();

    await sb.auth.signOut();
    const after = await sb.auth.getUser();
    expect(after.data.user).toBeNull();
  });

  it("employee A chỉ thấy mình, không thấy B (API-level)", async () => {
    const { sb } = await login("nv.a@demo.vn");
    const emp = await sb.from("employees").select("id");
    expect(emp.error).toBeNull();
    expect(emp.data?.map((r) => r.id)).toEqual([E_A]);

    const ev = await sb.from("attendance_events").select("employee_id");
    expect(ev.error).toBeNull();
    expect(ev.data?.length).toBeGreaterThan(0);
    expect(ev.data?.every((r) => r.employee_id === E_A)).toBe(true);
    expect(ev.data?.map((r) => r.employee_id)).not.toContain(E_B);
    await sb.auth.signOut();
  });

  it("HR thấy toàn org + chặn trùng mã nhân viên", async () => {
    const { sb } = await login("hr@demo.vn");
    const all = await sb.from("employees").select("id").eq("organization_id", ORG);
    expect(all.error).toBeNull();
    expect(all.data?.length).toBeGreaterThanOrEqual(5);

    const dup = await sb.from("employees").insert({
      organization_id: ORG,
      employee_code: "NV001",
      title: "trung ma",
    });
    expect(dup.error?.code).toBe("23505");
    await sb.auth.signOut();
  });

  it("deactivate giữ lịch sử + overlap phân ca bị chặn + giờ sai bị chặn", async () => {
    const { sb } = await login("hr@demo.vn");
    const code = `NV_TMP_${Date.now()}`;
    try {
      // Tạo tạm (không profile) rồi vô hiệu hóa.
      const created = await sb
        .from("employees")
        .insert({ organization_id: ORG, employee_code: code, employment_status: "active" })
        .select("id")
        .single();
      expect(created.error).toBeNull();
      if (!created.data) throw new Error("Không tạo được employee tạm.");
      const tmpId = created.data.id as string;

      const de = await sb.from("employees").update({ employment_status: "terminated" }).eq("id", tmpId);
      expect(de.error).toBeNull();
      const check = await sb.from("employees").select("employment_status").eq("id", tmpId).single();
      expect(check.data?.employment_status).toBe("terminated");

      // Overlap: A đã có phân ca từ 2026-01-01 vô thời hạn → gán giao nhau phải lỗi.
      const ov = await sb.from("shift_assignments").insert({
        organization_id: ORG,
        employee_id: E_A,
        shift_id: "50000000-0000-0000-0000-000000000003",
        effective_from: "2026-06-01",
        effective_to: null,
      });
      expect(ov.error?.code).toBe("23P01");

      // Giờ bắt đầu == kết thúc vi phạm check.
      const badShift = await sb.from("work_shifts").insert({
        organization_id: ORG,
        name: `Ca sai ${Date.now()}`,
        start_time: "08:00",
        end_time: "08:00",
      });
      expect(badShift.error?.code).toBe("23514");

      // Ca đêm seed đúng overnight.
      const night = await sb.from("work_shifts").select("start_time, end_time, overnight").eq("name", "Ca dem").single();
      expect(night.data).toMatchObject({ start_time: "22:00:00", overnight: true });

      await sb.from("employees").delete().eq("id", tmpId);
    } finally {
      await sb.from("employees").delete().eq("employee_code", code);
      await sb.auth.signOut();
    }
  });

  it("employee tự nâng role qua API bị chặn", async () => {
    const { sb } = await login("nv.b@demo.vn");
    const up = await sb.from("profiles").update({ role: "hr_admin" }).eq("id", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(up.error).not.toBeNull();
    await sb.auth.signOut();
  });
});
