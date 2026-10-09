import { randomUUID } from "node:crypto";

/** Idempotency key for attendance events: `evt_<uuid>`. Server enforces uniqueness. */
export function newIdempotencyKey(prefix = "evt"): string {
  return `${prefix}_${randomUUID()}`;
}
