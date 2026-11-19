import type { CleaningReport } from "./cleaning-reports";

/** Minimal employee-facing projection. Never expose photo paths, GPS or internal antifraud details. */
export function toEmployeeCleaningReportView(report: CleaningReport) {
  return {
    id: report.id,
    atmCode: report.atmCode,
    atmId: report.atmId,
    submittedAt: report.createdAt,
    submittedDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(report.clientTime || report.createdAt)),
    status: report.approvalStatus || "pending",
    reviewedAt: report.reviewedAt || null,
    reviewComment: report.reviewComment || "",
    antifraud: report.antifraudResult === "review" || (report.antifraudFlags || []).length > 0,
  };
}
