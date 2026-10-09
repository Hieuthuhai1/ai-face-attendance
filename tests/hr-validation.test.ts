import { describe, expect, it } from "vitest";
import { hasRole } from "@/lib/roles";
import {
  assignmentFormSchema,
  employeeFormSchema,
  shiftFormSchema,
} from "@/features/hr/validation";

describe("roles helper", () => {
  it("hasRole đúng/từ chối đúng", () => {
    expect(hasRole("hr_admin", ["hr_admin", "system_admin"])).toBe(true);
    expect(hasRole("employee", ["hr_admin"])).toBe(false);
    expect(hasRole(undefined, ["employee"])).toBe(false);
  });
});

describe("hr validation", () => {
  it("ca: giờ sai định dạng / bắt đầu == kết thúc bị từ chối", () => {
    const base = { name: "Ca X", overnight: false, grace_in_min: 5, grace_out_min: 5, rounding_min: 1 };
    expect(shiftFormSchema.safeParse({ ...base, start_time: "8:00", end_time: "17:00" }).success).toBe(false);
    expect(shiftFormSchema.safeParse({ ...base, start_time: "08:00", end_time: "08:00" }).success).toBe(false);
    expect(shiftFormSchema.safeParse({ ...base, start_time: "22:00", end_time: "06:00" }).success).toBe(true);
  });

  it("phân ca: ngày kết thúc trước bắt đầu bị từ chối", () => {
    const base = {
      employee_id: "e0000000-0000-0000-0000-000000000001",
      shift_id: "50000000-0000-0000-0000-000000000001",
    };
    expect(
      assignmentFormSchema.safeParse({ ...base, effective_from: "2026-10-01", effective_to: "2026-09-01" }).success,
    ).toBe(false);
    expect(
      assignmentFormSchema.safeParse({ ...base, effective_from: "2026-10-01", effective_to: null }).success,
    ).toBe(true);
  });

  it("nhân viên: mã sai / thiếu tên bị từ chối", () => {
    const base = { department_id: null, manager_id: null, title: "", employment_status: "active" as const };
    expect(
      employeeFormSchema.safeParse({ ...base, employee_code: "NV 001!", display_name: "A" }).success,
    ).toBe(false);
    expect(
      employeeFormSchema.safeParse({ ...base, employee_code: "NV001", display_name: "" }).success,
    ).toBe(false);
  });
});
