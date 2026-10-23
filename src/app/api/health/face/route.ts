import { getProviderHealth } from "@/server/face";
import { NextResponse } from "next/server";

export async function GET() {
  const health = getProviderHealth(process.env);
  return NextResponse.json(health, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}