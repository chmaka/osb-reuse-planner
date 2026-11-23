import {describe,it,expect} from 'vitest';
import {evaluateTrial,summarizePilot,predictedBounds,exportPilotCsv} from './metrics';
import type {ValidationTrial,Remnant} from '../../types';
const base={
 id:'sample-1',remnantId:'r-1',remnantLabel:'OSB-01',remnantRevision:1,
 at:'2026-11-23T00:00:00.000Z',algorithm:'rebble-auto-contrast-v1',
 calibrationMethod:'aruco-single',device:'Android',lighting:'dan',
 referenceMethod:'ručni metar',notes:'',predictedWidthMm:1200,predictedHeightMm:600,
 actualWidthMm:1197,actualHeightMm:602,toleranceMm:5
} satisfies ValidationTrial;
describe('independent physical dimensional pilot',()=>{
 it('computes signed and absolute errors and tolerance independently',()=>{
   expect(evaluateTrial(base)).toEqual({deltaWidthMm:3,deltaHeightMm:-2,
     absoluteWidthMm:3,absoluteHeightMm:2,worstMm:3,withinTolerance:true});
   expect(evaluateTrial({...base,toleranceMm:2}).withinTolerance).toBe(false);
 });
 it('rejects impossible measurements and non-finite tolerances',()=>{
   expect(()=>evaluateTrial({...base,actualWidthMm:0})).toThrow();
   expect(()=>evaluateTrial({...base,actualWidthMm:Infinity})).toThrow();
   expect(()=>evaluateTrial({...base,toleranceMm:-1})).toThrow();
   expect(()=>evaluateTrial({...base,toleranceMm:NaN})).toThrow();
 });
 it('counts distinct physical remnants instead of inflating by repeated photos',()=>{
   const t=[base,{...base,id:'sample-2',predictedWidthMm:1201},{
     ...base,id:'sample-3',remnantId:'r-2',actualWidthMm:1190,actualHeightMm:590}];
   const s=summarizePilot(t);
   expect(s.trials).toBe(3);
   expect(s.uniqueRemnants).toBe(2);expect(s.remainingRemnants).toBe(18);
   expect(s.readings).toBe(6);expect(s.failedTolerance).toBe(1);
   expect(s.maxErrorMm).toBe(10);
 });
 it('uses nearest-rank 95th percentile and RMSE on both axes',()=>{
   const s=summarizePilot([base]);
   expect(s.meanAbsoluteErrorMm).toBe(2.5);
   expect(s.rmseMm).toBeCloseTo(Math.sqrt(6.5));
   expect(s.p95AbsoluteErrorMm).toBe(3);
 });
 it('reports empty evidence as null rather than zero precision',()=>{
   const s=summarizePilot([]);
   expect(s.uniqueRemnants).toBe(0);
   expect(s.rmseMm).toBe(null);
   expect(s.p95AbsoluteErrorMm).toBe(null);
 });
 it('snapshots the rectangle bounds from original measured geometry',()=>{
   const remnant={polygonMm:[{x:17,y:20},{x:110,y:20},{x:110,y:62},{x:17,y:62}]} as Remnant;
   expect(predictedBounds(remnant)).toEqual({widthMm:93,heightMm:42});
 });
 it('CSV escapes formula-like labels and user comments',()=>{
   const csv=exportPilotCsv([{...base,remnantLabel:'=BAD()',notes:'@danger,"x"'}]);
   expect(csv).toContain('"'+"'=BAD()"+'"');
   expect(csv).toContain('"'+"'@danger,"+'"'+ '"x' +'"'+ '"'+'"');
   expect(csv.split('\r\n')).toHaveLength(3);
 });
});
