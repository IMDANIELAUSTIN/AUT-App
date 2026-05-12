import { createContext, useContext } from "react";
import type { useNetWorth } from "@/lib/useNetWorth";

export type NetWorthState = ReturnType<typeof useNetWorth>;

export const NetWorthContext = createContext<NetWorthState | null>(null);

export function useNetWorthContext() {
  const value = useContext(NetWorthContext);
  if (!value) {
    throw new Error("useNetWorthContext must be used inside NetWorthProvider");
  }
  return value;
}
