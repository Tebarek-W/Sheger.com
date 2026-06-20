import { redirect } from "next/navigation";

import { Sidebar } from "@/components/admin/Sidebar";
import { getSessionProfile } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth: middleware already gates /dashboard, but every server
  // render also asserts admin so a new route or middleware gap can't leak.
  const { isAdmin } = await getSessionProfile();
  if (!isAdmin) {
    redirect("/login?error=not_admin");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <main className="min-h-0 flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
