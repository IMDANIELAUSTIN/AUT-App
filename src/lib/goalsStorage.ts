export const GOAL_TARGETS_KEY = "fyi:goals-targets:v1";
export const GOAL_SNAPSHOTS_KEY = "fyi:goals-snapshots:v1";

const GOAL_TARGETS_MIGRATION_KEY = `${GOAL_TARGETS_KEY}:profile-migration`;
const GOAL_SNAPSHOTS_MIGRATION_KEY = `${GOAL_SNAPSHOTS_KEY}:profile-migration`;

export type GoalTargets = {
  expenses: number;
  savings: number;
  wage: number;
  hours: number;
  surplus: number;
};

export type GoalSnapshot = {
  id: string;
  date: string;
  income: number;
  expenses: number;
  surplus: number;
  hours: number;
};

export const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

const signedNum = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const uid = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function targetsKey(profileId?: string) {
  return profileId ? `${GOAL_TARGETS_KEY}:profile:${profileId}` : GOAL_TARGETS_KEY;
}

function snapshotsKey(profileId?: string) {
  return profileId ? `${GOAL_SNAPSHOTS_KEY}:profile:${profileId}` : GOAL_SNAPSHOTS_KEY;
}

function readTargets(key: string, defaults: GoalTargets): GoalTargets | null {
  const raw = JSON.parse(localStorage.getItem(key) || "null");
  if (!raw || typeof raw !== "object") return null;
  return {
    expenses: num(raw.expenses, defaults.expenses),
    savings: num(raw.savings, defaults.savings),
    wage: num(raw.wage, defaults.wage),
    hours: num(raw.hours, defaults.hours),
    surplus: num(raw.surplus, defaults.surplus),
  };
}

function readSnapshots(key: string): GoalSnapshot[] | null {
  const raw = JSON.parse(localStorage.getItem(key) || "null");
  if (!Array.isArray(raw)) return null;
  return raw
    .map((snapshot): GoalSnapshot | null =>
      snapshot && typeof snapshot === "object"
        ? {
            id: typeof snapshot.id === "string" ? snapshot.id : uid(),
            date: typeof snapshot.date === "string" ? snapshot.date : new Date().toISOString(),
            income: num(snapshot.income),
            expenses: num(snapshot.expenses),
            surplus: signedNum(snapshot.surplus),
            hours: num(snapshot.hours),
          }
        : null,
    )
    .filter(Boolean) as GoalSnapshot[];
}

export function loadGoalTargets(defaults: GoalTargets, profileId?: string): GoalTargets {
  if (typeof window === "undefined") return defaults;
  try {
    const key = targetsKey(profileId);
    const saved = readTargets(key, defaults);
    if (saved) return saved;

    if (profileId && !localStorage.getItem(GOAL_TARGETS_MIGRATION_KEY)) {
      const legacy = readTargets(GOAL_TARGETS_KEY, defaults);
      if (legacy) {
        localStorage.setItem(key, JSON.stringify(legacy));
        localStorage.setItem(GOAL_TARGETS_MIGRATION_KEY, profileId);
        return legacy;
      }
    }

    return defaults;
  } catch {
    return defaults;
  }
}

export function saveGoalTargets(targets: GoalTargets, profileId?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(targetsKey(profileId), JSON.stringify(targets));
  } catch {
    /* ignore */
  }
}

export function loadGoalSnapshots(profileId?: string): GoalSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const key = snapshotsKey(profileId);
    const saved = readSnapshots(key);
    if (saved) return saved;

    if (profileId && !localStorage.getItem(GOAL_SNAPSHOTS_MIGRATION_KEY)) {
      const legacy = readSnapshots(GOAL_SNAPSHOTS_KEY);
      if (legacy) {
        localStorage.setItem(key, JSON.stringify(legacy));
        localStorage.setItem(GOAL_SNAPSHOTS_MIGRATION_KEY, profileId);
        return legacy;
      }
    }

    return [];
  } catch {
    return [];
  }
}

export function saveGoalSnapshots(snapshots: GoalSnapshot[], profileId?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(snapshotsKey(profileId), JSON.stringify(snapshots));
  } catch {
    /* ignore */
  }
}
