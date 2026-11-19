export interface ReportQualitySignal {
  antifraudResult?: string;
  gpsQuality?: string;
}

export interface ReportQualitySummary {
  reviewCount: number;
  lowGpsCount: number;
  gpsUnavailableCount: number;
}

/** Counts review signals only. This deliberately does not model report approval. */
export function summarizeReportQuality(reports: ReportQualitySignal[]): ReportQualitySummary {
  return reports.reduce<ReportQualitySummary>((summary, report) => ({
    reviewCount: summary.reviewCount + (report.antifraudResult === "review" ? 1 : 0),
    lowGpsCount: summary.lowGpsCount + (report.gpsQuality === "low_accuracy" ? 1 : 0),
    gpsUnavailableCount: summary.gpsUnavailableCount + (report.gpsQuality === "unavailable" ? 1 : 0),
  }), { reviewCount: 0, lowGpsCount: 0, gpsUnavailableCount: 0 });
}
