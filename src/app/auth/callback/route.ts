import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextParam } from "@/features/auth/oauth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextParam(searchParams.get("next"));
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
