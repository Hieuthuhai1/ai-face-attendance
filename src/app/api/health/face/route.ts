import { getProviderHealth } from "@/server/face";
import { NextResponse, connection } from "next/server";

export async function GET() {
  // Đọc env lúc runtime (Vercel có thể chỉ inject secret ở runtime), không prerender.
  await connection();
  const health = getProviderHealth(process.env);
  return NextResponse.json(health, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
