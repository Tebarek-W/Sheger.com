import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth";

export default async function HomePage() {
  const { isAdmin } = await getSessionProfile();
  redirect(isAdmin ? "/dashboard" : "/login");
}
