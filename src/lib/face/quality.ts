/**
 * Kiểm tra chất lượng ảnh phía client TRƯỚC khi gửi.
 * Trung thực: chỉ đo sáng/mờ/kích thước. Đây KHÔNG phải face detection,
 * KHÔNG phải liveness/anti-spoof (liveness do provider đảm nhiệm, Phase 4+).
 */

export interface QualityReport {
  ok: boolean;
  brightness: number; // 0..255 trung bình
  blur: number; // phương sai Laplacian (cao = nét)
  issues: string[];
}

export const QUALITY_RULES = {
  minBrightness: 40,
  maxBrightness: 220,
  minBlur: 60,
  minWidth: 320,
  minHeight: 240,
} as const;

/** Tính trên mảng grayscale (1 byte/pixel, row-major). */
export function analyzeQuality(
  gray: Uint8Array | number[],
  width: number,
  height: number,
): QualityReport {
  const issues: string[] = [];
  if (width < QUALITY_RULES.minWidth || height < QUALITY_RULES.minHeight) {
    issues.push("Ảnh quá nhỏ, hãy đưa camera lại gần hơn.");
  }
  const n = width * height;
  if (n === 0 || gray.length < n) {
    return { ok: false, brightness: 0, blur: 0, issues: ["Không đọc được dữ liệu ảnh."] };
  }
  let sum = 0;
  for (let i = 0; i < n; i++) sum += gray[i] as number;
  const brightness = sum / n;
  if (brightness < QUALITY_RULES.minBrightness) issues.push("Thiếu sáng, hãy di chuyển ra chỗ sáng hơn.");
  if (brightness > QUALITY_RULES.maxBrightness) issues.push("Quá sáng/cháy sáng, hãy tránh đèn chiếu thẳng.");

  // Laplacian variance (kernel 4-neighbour) trên ảnh gốc.
  let lapSum = 0;
  let lapSq = 0;
  let count = 0;
  const at = (x: number, y: number) => (gray[y * width + x] ?? 0) as number;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const lap = 4 * at(x, y) - at(x - 1, y) - at(x + 1, y) - at(x, y - 1) - at(x, y + 1);
      lapSum += lap;
      lapSq += lap * lap;
      count++;
    }
  }
  const mean = count > 0 ? lapSum / count : 0;
  const blur = count > 0 ? lapSq / count - mean * mean : 0;
  if (blur < QUALITY_RULES.minBlur) issues.push("Ảnh bị mờ, hãy giữ chắc camera và nhìn thẳng.");

  return { ok: issues.length === 0, brightness, blur, issues };
}
