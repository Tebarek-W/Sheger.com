"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";

function ShegerMark() {
  return (
    <div
      aria-hidden
      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"
    >
      <span className="text-2xl font-extrabold tracking-tight text-white">S</span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    params.get("error") === "not_admin"
      ? "This account does not have admin access."
      : "",
  );
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <section className="relative flex flex-col justify-between bg-[var(--primary)] px-8 py-10 text-white lg:w-[42%] lg:px-12 lg:py-14">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-center gap-4">
            <ShegerMark />
            <div>
              <p className="text-lg font-bold tracking-tight">Sheger</p>
              <p className="text-sm text-white/80">Admin Console</p>
            </div>
          </div>
        </div>

        <div className="relative mt-10 max-w-md lg:mt-0">
          <h1 className="text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
            Manage your booking platform
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/85">
            Approve businesses, monitor bookings, and oversee payments from one
            secure dashboard.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/90">
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Business approval workflow
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Real-time booking oversight
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              User and role management
            </li>
          </ul>
        </div>

        <p className="relative mt-10 text-xs text-white/60 lg:mt-0">
          Sheger Booking Platform &middot; Ethiopia
        </p>
      </section>

      {/* Sign-in panel */}
      <section className="flex flex-1 items-center justify-center bg-white px-6 py-12 lg:px-16">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--primary)]">
              Secure sign in
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--primary-dark)]">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Enter your admin credentials to access the dashboard.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-[var(--primary-dark)]"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-[var(--primary-dark)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:bg-white focus:ring-2 focus:ring-[var(--primary-light)]"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-[var(--primary-dark)]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-[var(--primary-dark)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:bg-white focus:ring-2 focus:ring-[var(--primary-light)]"
                placeholder="Enter your password"
                required
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-[var(--border)] bg-[var(--primary-light)] px-4 py-3 text-sm font-medium text-[var(--primary-dark)]"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in...
                </>
              ) : (
                "Sign in to dashboard"
              )}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs leading-relaxed text-[var(--primary-dark)]">
              <span className="font-semibold">Admin access only.</span>{" "}
              Customer and business owner accounts cannot sign in here. Contact
              your platform administrator if you need access.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
