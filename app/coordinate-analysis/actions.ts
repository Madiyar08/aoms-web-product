"use server";

import { saveDecision } from "@/lib/cluster-decisions";
import { revalidatePath } from "next/cache";

export async function decideClusterAction(signature: string, atmIds: string[], decision: string) {
  saveDecision(signature, atmIds, decision, "");
  revalidatePath("/coordinate-analysis");
}
