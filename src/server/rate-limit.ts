/**
 * Rate limit đơn giản theo sliding window (bộ nhớ tiến trình).
 * Đủ cho local/single-instance; production đa instance cần Redis/DB (ghi trong PROVIDER_SETUP).
 */
interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now(),
): { allowed: boolean; retryAfterMs: number } {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0] ?? now;
    return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
  }
  bucket.hits.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

/** Dùng trong tests để cô lập trạng thái. */
export function resetRateLimits(): void {
  buckets.clear();
}

export const ENROLL_SUBMIT_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
export const VERIFY_LIMIT = { max: 10, windowMs: 60 * 1000 };
