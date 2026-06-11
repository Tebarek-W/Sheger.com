import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/env";

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return new NextResponse(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in sheger-admin/.env.local",
      { status: 500 },
    );
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    getSupabaseUrl()!,
    getSupabasePublishableKey()!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname === "/login";
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

  if (!user && isDashboard) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && isDashboard) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=not_admin", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
