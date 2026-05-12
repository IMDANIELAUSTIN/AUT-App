import type { ReactNode } from "react";
import { useEquation } from "@/lib/equation";
import { NetWorthContext } from "@/lib/netWorthContext";
import { useNetWorth } from "@/lib/useNetWorth";

export function NetWorthProvider({ children }: { children: ReactNode }) {
  const { activeProfileId } = useEquation();
  const value = useNetWorth(activeProfileId);
  return <NetWorthContext.Provider value={value}>{children}</NetWorthContext.Provider>;
}
