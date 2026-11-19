"use server";

import { requireAdminPermission } from "@/lib/access-control";

import { saveDecision } from "@/lib/cluster-decisions";
import { revalidatePath } from "next/cache";

export async function decideClusterAction(signature: string, atmIds: string[], decision: string) {
  requireAdminPermission("atms:write");
  saveDecision(signature, atmIds, decision, "");
  revalidatePath("/coordinate-analysis");
}
