/** Class-name joiner (Phase 1: no external dep for this trivial util). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
