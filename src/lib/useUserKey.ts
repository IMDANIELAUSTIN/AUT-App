import { useEffect, useState } from "react";

const KEY = "fyi:user_key:v1";

function genKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function useUserKey() {
  const [key, setKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    let v = localStorage.getItem(KEY);
    if (!v) { v = genKey(); localStorage.setItem(KEY, v); }
    return v;
  });
  useEffect(() => {
    if (!key && typeof window !== "undefined") {
      const v = genKey();
      localStorage.setItem(KEY, v);
      setKey(v);
    }
  }, [key]);
  return key;
}
