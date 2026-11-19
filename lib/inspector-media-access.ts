export function isInspectorMediaReference(url: string, reports: Array<{ photosJson?: string; videoUrl?: string }>): boolean {
  if (!url) return false;
  return reports.some((report) => {
    if (report.videoUrl === url) return true;
    try {
      const photos: unknown = JSON.parse(report.photosJson || "[]");
      return Array.isArray(photos) && photos.includes(url);
    } catch { return false; }
  });
}
