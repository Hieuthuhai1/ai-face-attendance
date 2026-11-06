import { describe, expect, it } from "vitest";
import {
  addDays,
  bucketTrendDays,
  buildTrendDays,
  listDates,
  parseISODate,
  startOfMonth,
  startOfWeek,
  sumTrendDays,
  takeLast,
} from "@/lib/dashboard/trends";

const EMP_A = "11111111-1111-1111-1111-111111111111";
const EMP_B = "22222222-2222-2222-2222-222222222222";
const EMP_C = "33333333-3333-3333-3333-333333333333";

describe("tiện ích ngày", () => {
  it("parse/format ngày theo UTC, không lệch múi giờ", () => {
    expect(parseISODate("2026-11-05")).toBe(Date.UTC(2026, 10, 5));
    expect(addDays("2026-11-05", 1)).toBe("2026-11-06");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("listDates trả đủ ngày và rỗng khi khoảng sai", () => {
    expect(listDates("2026-11-01", "2026-11-03")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
    expect(listDates("2026-11-03", "2026-11-01")).toEqual([]);
  });

  it("tuần bắt đầu thứ Hai, tháng bắt đầu ngày 01", () => {
    // 2026-11-05 là thứ Năm
    expect(startOfWeek("2026-11-05")).toBe("2026-11-02");
    expect(startOfWeek("2026-11-08")).toBe("2026-11-02"); // Chủ nhật
    expect(startOfMonth("2026-11-05")).toBe("2026-11-01");
  });
});

describe("buildTrendDays", () => {
  const base = {
    from: "2026-11-02",
    to: "2026-11-04",
    activeEmployeeIds: [EMP_A, EMP_B, EMP_C],
    assignments: [
      { employee_id: EMP_A, effective_from: "2026-11-01", effective_to: null },
      { employee_id: EMP_B, effective_from: "2026-11-01", effective_to: "2026-11-30" },
      { employee_id: EMP_C, effective_from: "2026-11-04", effective_to: null },
    ],
  };

  it("tính số có ca, đã chấm công, đi muộn và vắng", () => {
    const days = buildTrendDays({
      ...base,
      summaries: [
        { employee_id: EMP_A, work_date: "2026-11-02", status: "present", first_in: "2026-11-02T01:00:00Z" },
        { employee_id: EMP_B, work_date: "2026-11-02", status: "late", first_in: "2026-11-02T02:00:00Z" },
        { employee_id: EMP_A, work_date: "2026-11-03", status: "present", first_in: "2026-11-03T01:00:00Z" },
      ],
      leaves: [],
    });

    expect(days).toHaveLength(3);
    const first = days[0];
    expect(first).toMatchObject({
      date: "2026-11-02",
      label: "02/11",
      assigned: 2,
      checked_in: 2,
      present: 1,
      late: 1,
      absent: 0,
      attendance_rate: 100,
      on_time_rate: 50,
    });

    // 03/11: chỉ EMP_A chấm công, EMP_B vắng
    expect(days[1]).toMatchObject({ assigned: 2, checked_in: 1, absent: 1, attendance_rate: 50 });

    // 04/11: EMP_C vào ca nhưng chưa chấm công
    expect(days[2]).toMatchObject({ assigned: 3, checked_in: 0, absent: 3, attendance_rate: 0 });
  });

  it("trừ nhân viên nghỉ phép đã duyệt khỏi số vắng", () => {
    const days = buildTrendDays({
      ...base,
      to: "2026-11-02",
      summaries: [
        { employee_id: EMP_A, work_date: "2026-11-02", status: "present", first_in: "2026-11-02T01:00:00Z" },
      ],
      leaves: [{ employee_id: EMP_B, start_date: "2026-11-02", end_date: "2026-11-03" }],
    });

    expect(days[0]).toMatchObject({
      assigned: 2,
      checked_in: 1,
      on_leave: 1,
      absent: 0,
      attendance_rate: 50,
    });
  });

  it("trả null cho tỷ lệ khi chưa phân ca", () => {
    const days = buildTrendDays({
      from: "2026-11-02",
      to: "2026-11-02",
      activeEmployeeIds: [EMP_A],
      assignments: [],
      summaries: [],
      leaves: [],
    });
    expect(days[0]).toMatchObject({ assigned: 0, attendance_rate: null, on_time_rate: null });
  });

  it("bỏ qua bản ghi của nhân viên không còn active", () => {
    const days = buildTrendDays({
      from: "2026-11-02",
      to: "2026-11-02",
      activeEmployeeIds: [EMP_A],
      assignments: [],
      summaries: [
        { employee_id: EMP_B, work_date: "2026-11-02", status: "present", first_in: "2026-11-02T01:00:00Z" },
      ],
      leaves: [],
    });
    expect(days[0].checked_in).toBe(0);
  });
});

describe("tổng hợp bucket", () => {
  const days = buildTrendDays({
    from: "2026-10-26",
    to: "2026-11-04",
    activeEmployeeIds: [EMP_A],
    assignments: [{ employee_id: EMP_A, effective_from: "2026-10-01", effective_to: null }],
    summaries: [
      { employee_id: EMP_A, work_date: "2026-10-28", status: "present", first_in: "2026-10-28T01:00:00Z" },
      { employee_id: EMP_A, work_date: "2026-11-02", status: "late", first_in: "2026-11-02T02:00:00Z" },
    ],
    leaves: [],
  });

  it("gộp theo tuần và tính lại tỷ lệ từ tổng", () => {
    const weeks = bucketTrendDays(days, "week");
    expect(weeks.map((w) => w.key)).toEqual(["2026-10-26", "2026-11-02"]);
    expect(weeks[0]).toMatchObject({ label: "Tuần 26/10", from: "2026-10-26", to: "2026-11-01" });
    expect(weeks[0].checked_in).toBe(1);
    expect(weeks[1]).toMatchObject({ label: "Tuần 02/11", from: "2026-11-02", to: "2026-11-04" });
    expect(weeks[1].late).toBe(1);
    expect(weeks[1].attendance_rate).toBe(33);
  });

  it("gộp theo tháng", () => {
    const months = bucketTrendDays(days, "month");
    expect(months.map((m) => m.key)).toEqual(["2026-10-01", "2026-11-01"]);
    expect(months[0]).toMatchObject({ label: "Tháng 10/2026", checked_in: 1 });
    expect(months[1]).toMatchObject({ label: "Tháng 11/2026", checked_in: 1 });
  });

  it("sumTrendDays cộng dồn và tính tỷ lệ kỳ", () => {
    const totals = sumTrendDays(days);
    expect(totals.checked_in).toBe(2);
    expect(totals.attendance_rate).toBe(20);
    expect(totals.on_time_rate).toBe(50);
  });

  it("takeLast lấy N phần tử cuối", () => {
    expect(takeLast([1, 2, 3, 4], 2)).toEqual([3, 4]);
    expect(takeLast([1, 2], 5)).toEqual([1, 2]);
  });
});
