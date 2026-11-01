import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextParam } from "@/features/auth/oauth";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, normalizeLocale } from "@/lib/i18n/config";

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

  const response = NextResponse.redirect(`${origin}${next}`);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("locale")
      .eq("id", user.id)
      .maybeSingle();
    response.cookies.set(LOCALE_COOKIE, normalizeLocale(profile?.locale), {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }
  return response;
}
