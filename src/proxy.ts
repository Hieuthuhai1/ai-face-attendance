import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

// LƯU Ý Next 16: config phải static (không .map/import) để parse lúc compile.
// Parity với PROTECTED_PREFIXES được giữ bằng unit test proxy-matcher.
export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/check-in/:path*", "/history/:path*", "/enrollment/:path*", "/reports/:path*", "/adjustments/:path*", "/leave/:path*", "/audit/:path*"],
};
