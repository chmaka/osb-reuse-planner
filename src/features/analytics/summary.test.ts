import { describe, expect, it } from 'vitest';
import { analyzeInventory, exportInventorySummaryCsv } from './summary';
import type { Remnant } from '../../types';

const mock = (id: string, props: Partial<Remnant> = {}): Remnant => ({
  id, label: 'Ostatak ' + id, material: 'OSB', thicknessMm: 18,
  polygonMm: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }],
  holesMm: [], defectsMm: [], areaMm2: 200_000, location: 'Radionica',
  status: 'MEASURED', calibrationMethod: 'two-point-manual', mmPerPx: 1,
  revision: 1, createdAt: '2026-11-20T12:00:00Z',
  updatedAt: '2026-11-20T12:00:00Z', ...props
});

const NOW = Date.parse('2026-11-23T12:00:00Z');
describe('local inventory analytics', () => {
  it('sums stored geometry in mm² and keeps statuses unchanged', () => {
    const records = [
      mock('a'),
      mock('b', { status: 'AVAILABLE', areaMm2: 500_000, thicknessMm: 21, material: 'Šperploča' }),
      mock('c', { status: 'USED', areaMm2: 100_000, thicknessMm: 18 })
    ];
    const out = analyzeInventory(records, { period: 'all', thicknessMm: null }, NOW);
    expect(out.totalAreaMm2).toBe(800_000);
    expect(out.total).toBe(3);
    expect(out.measuredCount).toBe(1);
    expect(out.thickness.map(g => [g.label, g.count, g.areaMm2])).toEqual([
      ['18 mm', 2, 300_000], ['21 mm', 1, 500_000]
    ]);
    expect(records[0].status).toBe('MEASURED');
    expect(out.status.find(s => s.status === 'USED')?.count).toBe(1);
  });
  it('filters by thickness and recency without silently including invalid dates', () => {
    const records = [
      mock('recent'),
      mock('older', { thicknessMm: 21, createdAt: '2026-01-12T10:00:00Z' }),
      mock('invalid', { createdAt: 'bad-date', areaMm2: 15 }),
      mock('future', { createdAt: '2026-12-02T10:00:00Z' })
    ];
    const recent = analyzeInventory(records, { period: '30d', thicknessMm: 18 }, NOW);
    expect(recent.total).toBe(1);
    expect(recent.totalAreaMm2).toBe(200_000);
    expect(analyzeInventory(records, { period: 'all', thicknessMm: 21 }, NOW).total).toBe(1);
    expect(recent.availableThicknesses).toEqual([18, 21]);
  });
  it('reports corrupt area values instead of inventing a valid measurement', () => {
    const out = analyzeInventory([
      mock('corrupt', { areaMm2: Number.NaN }),
      mock('negative', { areaMm2: -50 })
    ], { period: 'all', thicknessMm: null }, NOW);
    expect(out.total).toBe(2);
    expect(out.invalidAreaCount).toBe(2);
    expect(out.totalAreaMm2).toBe(0);
  });
  it('handles an empty inventory and CSV formula injection', () => {
    expect(analyzeInventory([], undefined, NOW).totalAreaMm2).toBe(0);
    const csv = exportInventorySummaryCsv(analyzeInventory([
      mock('x', { material: '=cmd|/C calc', areaMm2: 2_000_000 })
    ], undefined, NOW));
    expect(csv).toContain('"\'=cmd|/C calc"');
    expect(csv).toContain('"2000000"');
    expect(csv).not.toContain('potvrđene_uštede');
  });
});
