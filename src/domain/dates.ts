const DAY_MS = 86_400_000;

export function tripDayCount(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / DAY_MS) + 1;
}

export function lodgingNightCount(dayCount: number): number {
  return Math.max(0, dayCount - 1);
}
