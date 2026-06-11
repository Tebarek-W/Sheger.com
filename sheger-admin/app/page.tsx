import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type ConnectionStatus = "not_configured" | "error" | "connected";

async function getConnectionStatus(): Promise<{
  status: ConnectionStatus;
  categoryCount: number;
  message?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { status: "not_configured", categoryCount: 0 };
  }

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true });

  if (error) {
    return {
      status: "error",
      categoryCount: 0,
      message: error.message,
    };
  }

  return { status: "connected", categoryCount: count ?? 0 };
}

export default async function AdminHomePage() {
  const { status, categoryCount, message } = await getConnectionStatus();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16">
      <main className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          Sheger Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
          Dashboard foundation
        </h1>
        <p className="mt-3 text-zinc-600">
          Phase 1 is wired. Connect Supabase to manage users, businesses, and
          bookings.
        </p>

        <div className="mt-8 rounded-xl bg-zinc-50 p-4">
          {status === "not_configured" && (
            <>
              <p className="font-medium text-zinc-900">Setup required</p>
              <p className="mt-1 text-sm text-zinc-600">
                Copy <code className="text-teal-700">.env.example</code> to{" "}
                <code className="text-teal-700">.env.local</code> and add your
                Supabase keys.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <p className="font-medium text-red-700">Database not ready</p>
              <p className="mt-1 text-sm text-zinc-600">
                Run the SQL in <code>supabase/migrations</code> and{" "}
                <code>supabase/seed.sql</code> in your Supabase project.
              </p>
              {message && (
                <p className="mt-2 text-xs text-red-600">{message}</p>
              )}
            </>
          )}

          {status === "connected" && (
            <>
              <p className="font-medium text-teal-700">Connected to Supabase</p>
              <p className="mt-1 text-sm text-zinc-600">
                {categoryCount} service categories found in the database.
              </p>
            </>
          )}
        </div>

        <ul className="mt-8 space-y-2 text-sm text-zinc-600">
          <li>Users — manage accounts and roles</li>
          <li>Businesses — approve and moderate listings</li>
          <li>Bookings — view and manage appointments</li>
          <li>Payments & reports — coming in Phase 2</li>
        </ul>
      </main>
    </div>
  );
}
