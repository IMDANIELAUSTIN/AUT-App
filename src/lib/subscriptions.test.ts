import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadSubscriptions,
  makeSubscription,
  saveSubscriptions,
  SUBSCRIPTIONS_KEY,
} from "@/lib/subscriptions";

function createStorage() {
  const records = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => records.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      records.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      records.delete(key);
    }),
    clear: vi.fn(() => {
      records.clear();
    }),
  };
}

describe("subscription storage", () => {
  beforeEach(() => {
    const localStorage = createStorage();
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps subscriptions isolated by profile id", () => {
    saveSubscriptions([makeSubscription({ name: "Profile A", price: 10 })], "profile-a");
    saveSubscriptions([makeSubscription({ name: "Profile B", price: 20 })], "profile-b");

    expect(loadSubscriptions("profile-a").map((subscription) => subscription.name)).toEqual([
      "Profile A",
    ]);
    expect(loadSubscriptions("profile-b").map((subscription) => subscription.name)).toEqual([
      "Profile B",
    ]);
  });

  it("migrates legacy global subscriptions only into the first profile that loads them", () => {
    localStorage.setItem(
      SUBSCRIPTIONS_KEY,
      JSON.stringify([makeSubscription({ name: "Legacy", price: 30 })]),
    );

    expect(loadSubscriptions("profile-a").map((subscription) => subscription.name)).toEqual([
      "Legacy",
    ]);
    expect(loadSubscriptions("profile-b").map((subscription) => subscription.name)).not.toContain(
      "Legacy",
    );
  });
});
