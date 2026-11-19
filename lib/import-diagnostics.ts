export type ImportIssueSeverity = "error" | "warning";

export interface ImportRowIssue {
  rowNumber: number;
  code: string;
  address: string;
  severity: ImportIssueSeverity;
  reason: string;
}

export const IMPORT_ISSUE_LIMIT = 100;

/** Keep preview diagnostics bounded even for unusually large workbooks. */
export function appendImportIssue(
  issues: ImportRowIssue[],
  issue: ImportRowIssue,
  limit = IMPORT_ISSUE_LIMIT,
): void {
  if (issues.length < limit) issues.push(issue);
}

export function importIssueSummary(issues: ImportRowIssue[]) {
  return {
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    shown: issues.length,
  };
}
