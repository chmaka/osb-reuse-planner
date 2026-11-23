import {describe,it,expect} from 'vitest';
import {getRing,measuredSpan,checkEdgeLength,summarizeEdgeChecks,exportEdgeChecksCsv} from './edge-check';
import type {EdgeCheck,Remnant} from '../../types';
const remnant={
 polygonMm:[{x:0,y:0},{x:200,y:0},{x:200,y:100},{x:120,y:100},{x:120,y:80},{x:0,y:80}],
 holesMm:[[{x:30,y:15},{x:60,y:15},{x:60,y:45},{x:30,y:45}]],
 defectsMm:[[{x:150,y:15},{x:170,y:15},{x:165,y:30}]]
} as Remnant;
const c:EdgeCheck={
 id:'sample',at:'2026-11-23T10:00:00Z',remnantId:'r',remnantLabel:'OSB',
 remnantRevision:1,algorithm:'rebble-auto-contrast-v1',
 ringKind:'hole',ringIndex:0,fromVertex:0,toVertex:1,
 from:{x:30,y:15},to:{x:60,y:15},scannedMm:30,
 physicalMm:29,toleranceMm:2,referenceMethod:'metar',notes:'test'
};
describe('local edge / opening checks',()=>{
 it('derives lengths for outer edge, concave lip and inner opening',()=>{
  expect(measuredSpan(remnant,'outer',0,0,1).scannedMm).toBe(200);
  expect(measuredSpan(remnant,'outer',0,3,4).scannedMm).toBe(20);
  expect(measuredSpan(remnant,'hole',0,0,1).scannedMm).toBe(30);
  expect(measuredSpan(remnant,'defect',0,0,1).scannedMm).toBe(20);
 });
 it('persists exact source vertices in frozen selection, without modifying geometry',()=>{
  const s=measuredSpan(remnant,'hole',0,0,2);
  expect(s.points).toEqual([{x:30,y:15},{x:60,y:45}]);
  expect(s.scannedMm).toBeCloseTo(Math.sqrt(1800));
  s.points[0].x=500;
  expect(getRing(remnant,'hole',0)[0].x).toBe(30);
 });
 it('rejects missing hole, cross-ring, duplicate, out-of-range and nonfinite vertices',()=>{
  expect(()=>getRing(remnant,'hole',4)).toThrow();
  expect(()=>getRing(remnant,'outer',1)).toThrow();
  expect(()=>measuredSpan(remnant,'outer',0,1,1)).toThrow();
  expect(()=>measuredSpan(remnant,'outer',0,-1,1)).toThrow();
  expect(()=>measuredSpan(remnant,'hole',0,0,4)).toThrow();
  expect(()=>measuredSpan({...remnant,polygonMm:[{x:NaN,y:0},{x:10,y:0}]},'outer',0,0,1)).toThrow();
 });
 it('calculates signed error and accepts equality with internal tolerance',()=>{
  expect(checkEdgeLength(c)).toEqual({signedMm:1,absoluteMm:1,withinTolerance:true});
  expect(checkEdgeLength({...c,physicalMm:27,toleranceMm:2}).withinTolerance).toBe(false);
  expect(checkEdgeLength({...c,physicalMm:28,toleranceMm:2}).withinTolerance).toBe(true);
 });
 it('rejects zero, NaN, negative threshold or oversized length',()=>{
  expect(()=>checkEdgeLength({...c,physicalMm:0})).toThrow();
  expect(()=>checkEdgeLength({...c,physicalMm:NaN})).toThrow();
  expect(()=>checkEdgeLength({...c,toleranceMm:-1})).toThrow();
  expect(()=>checkEdgeLength({...c,scannedMm:50001})).toThrow();
 });
 it('reports independent local errors; no readings is not 0mm quality',()=>{
  expect(summarizeEdgeChecks([]).p95Mm).toBe(null);
  const stats=summarizeEdgeChecks([c,{...c,id:'2',physicalMm:25,ringKind:'outer'}]);
  expect(stats.count).toBe(2);
  expect(stats.distinctRemnants).toBe(1);
  expect(stats.meanAbsoluteErrorMm).toBe(3);
  expect(stats.p95Mm).toBe(5);
  expect(stats.exceedingTolerance).toBe(1);
  expect(stats.byRingKind.find(x=>x.kind==='hole')?.count).toBe(1);
 });
 it('exports dimension provenance and protects CSV from injected formulas',()=>{
  const csv=exportEdgeChecksCsv([{...c,remnantLabel:'=SUM(A1:A2)',notes:'@cmd'}]);
  expect(csv).toContain('"'+"'=SUM(A1:A2)"+'"');
  expect(csv).toContain('"'+"'@cmd"+'"');
  expect(csv).toContain('"signed_error_mm"');
  expect(csv.split('\r\n')).toHaveLength(3);
 });
});
