import { findById, insertRow, updateRow, withTransaction } from "./db";
import { nowIso } from "./entity";

const TABLE = "submission_idempotency";

export interface SubmissionRecord {
  id: string;
  employeeId: string;
  status: "processing" | "completed";
  reportId: string;
  createdAt: string;
  updatedAt: string;
}

export function getSubmissionRecord(id: string): SubmissionRecord | null {
  return findById<SubmissionRecord>(TABLE, id);
}

/** Atomically reserves a key in the single-process SQLite request path. */
export function isSubmissionReservationStale(record: SubmissionRecord, leaseMinutes = 10): boolean {
  return record.status === "processing" && Date.now() - Date.parse(record.updatedAt) > leaseMinutes * 60_000;
}

export function reserveSubmission(id: string, employeeId: string): SubmissionRecord {
  return withTransaction(() => {
    const now = nowIso();
    const existing = getSubmissionRecord(id);
    const row: SubmissionRecord = {
      id, employeeId, status: "processing", reportId: "",
      createdAt: existing?.createdAt || now, updatedAt: now,
    };
    if (existing) {
      if (existing.employeeId !== employeeId || !isSubmissionReservationStale(existing)) {
        throw new Error("Submission is already reserved");
      }
      updateRow<SubmissionRecord>(TABLE, id, row);
    } else {
      insertRow(TABLE, row);
    }
    return row;
  });
}

export function completeSubmission(id: string, reportId: string): void {
  updateRow<SubmissionRecord>(TABLE, id, {
    status: "completed",
    reportId,
    updatedAt: nowIso(),
  });
}
