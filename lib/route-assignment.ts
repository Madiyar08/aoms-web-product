export interface ExistingRouteAssignment {
  scheduleId: string;
  date: string;
  atmIds: string[];
}

/** Finds ATM IDs already assigned to another crew route on the same date. */
export function findAlreadyAssignedAtmIds(
  candidateAtmIds: string[],
  existingRoutes: ExistingRouteAssignment[],
  date: string,
  scheduleId: string
): Set<string> {
  const candidates = new Set(candidateAtmIds);
  const assigned = new Set<string>();
  for (const route of existingRoutes) {
    if (route.date !== date || route.scheduleId === scheduleId) continue;
    for (const atmId of route.atmIds || []) {
      if (candidates.has(atmId)) assigned.add(atmId);
    }
  }
  return assigned;
}
