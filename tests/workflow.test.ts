import { describe, expect, it } from "vitest";
import { adjustmentFormSchema, leaveFormSchema, reviewSchema } from "@/features/workflow/validation";

describe("workflow validation", () => {
  it("adjustment: cần ít nhất 1 giờ đề xuất, ra sau vào, lý do đủ dài", () => {
    const base = { work_date: "2026-10-08", event_id: null, reason: "Quên check-out" };
    expect(adjustmentFormSchema.safeParse({ ...base, requested_in: null, requested_out: null }).success).toBe(false);
    expect(
      adjustmentFormSchema.safeParse({ ...base, requested_in: "2026-10-08T08:00", requested_out: "2026-10-08T07:00" }).success,
    ).toBe(false);
    expect(adjustmentFormSchema.safeParse({ ...base, requested_in: null, requested_out: "2026-10-08T17:00" }).success).toBe(true);
    expect(adjustmentFormSchema.safeParse({ ...base, requested_in: "2026-10-08T08:00", requested_out: null, reason: "ngắn" }).success).toBe(false);
  });

  it("leave: end trước start bị từ chối", () => {
    expect(
      leaveFormSchema.safeParse({ leave_type: "sick", start_date: "2026-10-20", end_date: "2026-10-19", reason: "Ốm nặng cần nghỉ" }).success,
    ).toBe(false);
    expect(
      leaveFormSchema.safeParse({ leave_type: "sick", start_date: "2026-10-20", end_date: "2026-10-21", reason: "Ốm nặng cần nghỉ" }).success,
    ).toBe(true);
  });

  it("review: từ chối bắt buộc lý do, duyệt không cần", () => {
    expect(reviewSchema.safeParse({ decision: "rejected", note: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ decision: "rejected", note: "Thiếu minh chứng" }).success).toBe(true);
    expect(reviewSchema.safeParse({ decision: "approved", note: "" }).success).toBe(true);
  });
});
