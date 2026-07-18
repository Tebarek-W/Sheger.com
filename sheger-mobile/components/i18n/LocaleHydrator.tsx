import { useEffect } from "react";

import { useLocaleStore } from "@/stores/localeStore";

export function LocaleHydrator() {
  const hydrate = useLocaleStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return null;
}
