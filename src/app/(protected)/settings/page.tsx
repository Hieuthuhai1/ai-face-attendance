import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";
import { LoadingState } from "@/components/ui/states";

export default async function SettingsPage() {
  return (
    <Suspense fallback={<LoadingState message="Đang tải cài đặt…" />}>
      <SettingsClient />
    </Suspense>
  );
}