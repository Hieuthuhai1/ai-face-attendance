/**
 * CSV export an toàn (chống formula injection) + helpers khoảng ngày.
 * Định nghĩa metrics xem docs/ARCHITECTURE.md ("Định nghĩa số liệu").
 */

/** Escape 1 ô: chặn =, +, -, @, tab ở đầu (tiền tố ') + quote chuẩn RFC 4180. */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^\s*[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const line = (cells: Array<string | number | null>) => cells.map(escapeCsvCell).join(",");
  return [line(headers), ...rows.map(line)].join("\r\n");
}

/** "2026-10" → { from: "2026-10-01", to: "2026-10-31" }. Sai định dạng → null. */
export function monthRange(month: string): { from: string; to: string } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const mm = String(mon).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${lastDay}` };
}

export const MAX_EXPORT_ROWS = 5000;
export const MAX_RANGE_DAYS = 62;

/** Validate khoảng ngày lọc báo cáo: định dạng, thứ tự, giới hạn độ dài. */
export function validateRange(
  from: string,
  to: string,
): { ok: true; from: string; to: string } | { ok: false; message: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { ok: false, message: "Ngày phải dạng YYYY-MM-DD." };
  }
  if (from > to) return { ok: false, message: "Từ ngày phải trước đến ngày." };
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (days > MAX_RANGE_DAYS) {
    return { ok: false, message: `Khoảng ngày tối đa ${MAX_RANGE_DAYS} ngày.` };
  }
  return { ok: true, from, to };
}
