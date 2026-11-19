"use server";

import { requireAdminPermission } from "@/lib/access-control";
import { revalidatePath } from "next/cache";
import { retryFailedDeliveryJob } from "@/lib/delivery-queue";
export async function retryDeliveryJobAction(id: string) {
  requireAdminPermission("operations:write");
  const result = retryFailedDeliveryJob(id);
  revalidatePath("/delivery-queue");
  return result;
}
