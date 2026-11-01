import type { Locale } from "./config";
import { VI_TO_EN } from "./dictionary";
import { VI_TO_EN_OVERRIDES } from "./overrides";

const DICTIONARY: Record<string, string> = { ...VI_TO_EN, ...VI_TO_EN_OVERRIDES };

const LOWER_DICTIONARY: Record<string, string> = Object.fromEntries(
  Object.entries(DICTIONARY).map(([key, value]) => [key.toLocaleLowerCase("vi"), value]),
);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS: Array<[RegExp, string]> = [
  [/Thứ Hai/gi, "Monday"],
  [/Thứ Ba/gi, "Tuesday"],
  [/Thứ Tư/gi, "Wednesday"],
  [/Thứ Năm/gi, "Thursday"],
  [/Thứ Sáu/gi, "Friday"],
  [/Thứ Bảy/gi, "Saturday"],
  [/Chủ Nhật/gi, "Sunday"],
];

function plural(value: string, singular: string, pluralForm: string): string {
  return value === "1" ? singular : pluralForm;
}

/** Translate interpolated Vietnamese text that cannot be looked up verbatim. */
export function translateDynamic(input: string): string {
  let out = input;

  for (const [pattern, replacement] of WEEKDAYS) out = out.replace(pattern, replacement);

  // Dates: "ngày 31 tháng 10 năm 2026", "31 tháng 10", "tháng 10 2026".
  out = out.replace(
    /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/gi,
    (_m, day: string, month: string, year: string) =>
      `${MONTHS[Number(month) - 1] ?? month} ${day}, ${year}`,
  );
  out = out.replace(
    /(\d{1,2})\s+tháng\s+(\d{1,2})/gi,
    (_m, day: string, month: string) => `${day} ${MONTHS[Number(month) - 1] ?? month}`,
  );
  out = out.replace(
    /tháng\s+(\d{1,2})\s+năm\s+(\d{4})/gi,
    (_m, month: string, year: string) => `${MONTHS[Number(month) - 1] ?? month} ${year}`,
  );
  out = out.replace(
    /tháng\s+(\d{1,2})\b/gi,
    (match, month: string) => MONTHS[Number(month) - 1] ?? match,
  );

  // Greetings and day words inside longer strings.
  out = out.replace(/Chào buổi sáng/gi, "Good morning");
  out = out.replace(/Chào buổi trưa/gi, "Good afternoon");
  out = out.replace(/Chào buổi chiều/gi, "Good afternoon");
  out = out.replace(/Chào buổi tối/gi, "Good evening");
  out = out.replace(/Xin chào/gi, "Hello");
  out = out.replace(/Hôm nay/gi, "Today");
  out = out.replace(/Hôm qua/gi, "Yesterday");
  out = out.replace(/Ngày mai/gi, "Tomorrow");
  out = out.replace(/Tuần này/gi, "This week");
  out = out.replace(/Tháng này/gi, "This month");
  out = out.replace(/Năm nay/gi, "This year");

  // Relative time.
  out = out.replace(/(\d+)\s*giờ trước/gi, (_m, n: string) => `${n} ${plural(n, "hour", "hours")} ago`);
  out = out.replace(/(\d+)\s*phút trước/gi, (_m, n: string) => `${n} ${plural(n, "minute", "minutes")} ago`);
  out = out.replace(/(\d+)\s*ngày trước/gi, (_m, n: string) => `${n} ${plural(n, "day", "days")} ago`);
  out = out.replace(/(\d+)\s*tuần trước/gi, (_m, n: string) => `${n} ${plural(n, "week", "weeks")} ago`);
  out = out.replace(/(\d+)\s*tháng trước/gi, (_m, n: string) => `${n} ${plural(n, "month", "months")} ago`);
  out = out.replace(/(\d+)\s*năm trước/gi, (_m, n: string) => `${n} ${plural(n, "year", "years")} ago`);

  // Late / early values.
  out = out.replace(/(?:Đi muộn|Trễ)\s*(\d+)\s*′/gi, "Late $1′");
  out = out.replace(/(?:Về sớm|Sớm)\s*(\d+)\s*′/gi, "Early $1′");
  out = out.replace(/(?:Đi muộn|Trễ)\s*(\d+)\s*phút/gi, (_m, n: string) => `Late ${n} ${plural(n, "minute", "minutes")}`);
  out = out.replace(/(?:Về sớm|Sớm)\s*(\d+)\s*phút/gi, (_m, n: string) => `Early ${n} ${plural(n, "minute", "minutes")}`);

  // Quantities in longer strings.
  out = out.replace(/(\d+)\s*phút/gi, (_m, n: string) => `${n} ${plural(n, "minute", "minutes")}`);
  out = out.replace(/(\d+)\s*giây/gi, (_m, n: string) => `${n} ${plural(n, "second", "seconds")}`);
  out = out.replace(/(\d+)\s*giờ/gi, (_m, n: string) => `${n} ${plural(n, "hour", "hours")}`);
  out = out.replace(/(\d+)\s*ngày/gi, (_m, n: string) => `${n} ${plural(n, "day", "days")}`);
  out = out.replace(/(\d+)\s*tuần/gi, (_m, n: string) => `${n} ${plural(n, "week", "weeks")}`);
  out = out.replace(/(\d+)\s*tháng/gi, (_m, n: string) => `${n} ${plural(n, "month", "months")}`);
  out = out.replace(/(\d+)\s*năm/gi, (_m, n: string) => `${n} ${plural(n, "year", "years")}`);

  // Confidence / match / update labels.
  out = out.replace(/Cập nhật(?::|\s+lúc)?\s*(\d{1,2}:\d{2})/gi, "Updated: $1");
  out = out.replace(/Cập nhật lúc/gi, "Updated at");
  out = out.replace(/Khớp\s*(\d+(?:[.,]\d+)?)\s*%/gi, "Match $1%");
  out = out.replace(/Độ tin cậy\s*(\d+(?:[.,]\d+)?)\s*%/gi, "Confidence $1%");
  out = out.replace(/Còn\s*(\d+)\s*ngày/gi, (_m, n: string) => `${n} ${plural(n, "day", "days")} left`);
  out = out.replace(/Xem thêm\s*(\d+)\s*thông báo/gi, "View $1 more notifications");
  out = out.replace(/Thông báo,\s*(\d+)\s*chưa đọc/gi, "Notifications, $1 unread");
  out = out.replace(/Gần nhất:/gi, "Latest:");
  out = out.replace(/Đề xuất:/gi, "Proposed:");
  out = out.replace(/Đã xử lý:/gi, "Processed:");
  out = out.replace(/Gửi lúc/gi, "Submitted at");
  out = out.replace(/Tạo lúc/gi, "Created at");
  out = out.replace(/Xóa lúc/gi, "Deleted at");
  out = out.replace(/\blúc\b/gi, "at");

  // Short labels with a colon and a value.
  out = out.replace(/Thời gian:/gi, "Time:");
  out = out.replace(/Ngày:/gi, "Date:");
  out = out.replace(/Trạng thái:/gi, "Status:");
  out = out.replace(/Ghi chú:/gi, "Note:");
  out = out.replace(/Lý do:/gi, "Reason:");
  out = out.replace(/Ca:/gi, "Shift:");
  out = out.replace(/Tổng:/gi, "Total:");
  out = out.replace(/Số lượng:/gi, "Quantity:");
  out = out.replace(/Kỳ:/gi, "Period:");

  // Date range.
  out = out.replace(
    /Từ\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+đến\s+(\d{1,2}\/\d{1,2}\/\d{4})/gi,
    "From $1 to $2",
  );
  out = out.replace(/\bvào\s+(\d{1,2}:\d{2})/gi, "in at $1");
  out = out.replace(/\bra\s+(\d{1,2}:\d{2})/gi, "out at $1");

  return out;
}

function lookup(core: string): string | undefined {
  const direct = DICTIONARY[core];
  if (direct !== undefined) return direct;
  const lower = LOWER_DICTIONARY[core.toLocaleLowerCase("vi")];
  if (lower !== undefined) return lower;
  const dynamic = translateDynamic(core);
  return dynamic !== core ? dynamic : undefined;
}

/**
 * Translate a single text value. Whitespace is preserved so the function can be
 * applied directly to DOM text nodes without breaking layout.
 */
export function translateText(text: string, locale: Locale): string {
  if (locale !== "en" || !text) return text;

  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  const core = text.slice(leading.length, text.length - trailing.length);
  if (!core) return text;

  const translated = lookup(core);
  return translated === undefined ? text : `${leading}${translated}${trailing}`;
}

/** Convenience helper for components that render a known Vietnamese string. */
export function createTranslator(locale: Locale): (vietnamese: string) => string {
  return (vietnamese: string) => translateText(vietnamese, locale);
}
