import { useQuery } from "@tanstack/react-query";

import { fetchMyBusinesses } from "@/lib/api/owner";
import { useAuth } from "@/hooks/useAuth";

export function useOwnerBusiness() {
  const { user, profile } = useAuth();

  const query = useQuery({
    queryKey: ["owner-businesses", user?.id],
    queryFn: () => fetchMyBusinesses(user!.id),
    enabled: Boolean(user?.id && profile?.role === "business_owner"),
  });

  const business = query.data?.[0] ?? null;

  return {
    ...query,
    business,
    businesses: query.data ?? [],
  };
}
