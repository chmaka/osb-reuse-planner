import type { Remnant, RemnantStatus } from '../../types';

export type AnalyticsPeriod = 'all' | '30d' | '90d';
export interface AnalyticsFilter {
  period: AnalyticsPeriod;
  thicknessMm: number | null;
}
export interface AnalyticsGroup {
  label: string;
  count: number;
  areaMm2: number;
}
export interface StatusGroup extends AnalyticsGroup {
  status: RemnantStatus;
}
export const STATUS_LABELS: Record<RemnantStatus, string> = {
  MEASURED: 'Izmjereno — čeka provjeru',
  VERIFIED: 'Verifikovano',
  AVAILABLE: 'Dostupno',
  RESERVED: 'Rezervisano',
  USED: 'Evidentirano kao iskorišćeno',
  REJECTED: 'Odbačeno'
};
export const STATUSES = Object.keys(STATUS_LABELS) as RemnantStatus[];

function positiveArea(areaMm2: number): number {
  return Number.isFinite(areaMm2) && areaMm2 >= 0 ? areaMm2 : 0;
}
function validThickness(mm: number): number | null {
  return Number.isFinite(mm) && mm > 0 ? mm : null;
}
function groupBy<T extends string | number>(
  remnants: Remnant[], key: (r: Remnant) => T
): Map<T, AnalyticsGroup> {
  const groups = new Map<T, AnalyticsGroup>();
  for (const remnant of remnants) {
    const id = key(remnant);
    const group = groups.get(id) ?? { label: String(id), count: 0, areaMm2: 0 };
    group.count += 1;
    group.areaMm2 += positiveArea(remnant.areaMm2);
    groups.set(id, group);
  }
  return groups;
}

/** Local records only: no physical reuse, cost savings, or CNC-approval inference. */
export function analyzeInventory(
  remnants: Remnant[],
  filter: AnalyticsFilter = { period: 'all', thicknessMm: null },
  nowMs: number = Date.now()
) {
  const days = filter.period === '30d' ? 30 : filter.period === '90d' ? 90 : null;
  const cutoff = days === null ? null : nowMs - days * 86_400_000;
  const filtered = remnants.filter(r => {
    if (filter.thicknessMm !== null && validThickness(r.thicknessMm) !== filter.thicknessMm)
      return false;
    if (cutoff !== null) {
      const createdAt = Date.parse(r.createdAt);
      if (!Number.isFinite(createdAt) || createdAt < cutoff || createdAt > nowMs) return false;
    }
    return true;
  });

  const totalAreaMm2 = filtered.reduce((sum, r) => sum + positiveArea(r.areaMm2), 0);
  const thickness = Array.from(groupBy(filtered, r => validThickness(r.thicknessMm) ?? 0))
    .map(([mm, group]) => ({ ...group, thicknessMm: mm, label: mm > 0 ? mm + ' mm' : 'Neodređeno' }))
    .sort((a, b) => a.thicknessMm - b.thicknessMm);

  const materials = Array.from(groupBy(filtered, r => r.material.trim() || 'Nepoznat materijal'))
    .map(([label, group]) => ({ ...group, label }))
    .sort((a, b) => b.areaMm2 - a.areaMm2 || a.label.localeCompare(b.label));

  const status = STATUSES.map(s => {
    const items = filtered.filter(r => r.status === s);
    return {
      status: s,
      label: STATUS_LABELS[s],
      count: items.length,
      areaMm2: items.reduce((sum, r) => sum + positiveArea(r.areaMm2), 0)
    };
  });

  const availableThicknesses = Array.from(new Set(
    remnants.map(r => validThickness(r.thicknessMm)).filter((mm): mm is number => mm !== null)
  )).sort((a, b) => a - b);

  return {
    total: filtered.length,
    totalAreaMm2,
    measuredCount: status.find(s => s.status === 'MEASURED')?.count ?? 0,
    invalidAreaCount: filtered.filter(r => !Number.isFinite(r.areaMm2) || r.areaMm2 < 0).length,
    materials,
    thickness,
    status,
    availableThicknesses
  };
}

function escapeCsvCell(value: string | number): string {
  const original = String(value);
  // Spreadsheet apps can execute formulas in user-provided labels; neutralize leading formula markers.
  const safe = /^[\s]*[=+@-]/.test(original) ? "'" + original : original;
  return '"' + safe.replaceAll('"', '""') + '"';
}

/** Aggregated counts and geometry in mm²; no uploaded photos or private record IDs. */
export function exportInventorySummaryCsv(data: ReturnType<typeof analyzeInventory>): string {
  const rows: (string | number)[][] = [
    ['kategorija', 'naziv', 'broj_zapisa', 'evidentirana_povrsina_mm2'],
    ...data.thickness.map(g => ['debljina', g.label, g.count, g.areaMm2]),
    ...data.materials.map(g => ['materijal', g.label, g.count, g.areaMm2]),
    ...data.status.map(g => ['status', g.label, g.count, g.areaMm2])
  ];
  return rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n') + '\r\n';
}
