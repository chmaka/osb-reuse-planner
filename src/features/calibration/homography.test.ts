import {describe,it,expect} from 'vitest';
import {area} from '../../geometry';
import {
 fitHomography,projectPoint,invertHomography,makeProjectiveCalibration,
 mapContourToMm,checkIndependentDistance,calibrationExtrapolationRatio
} from './homography';
import type {Point} from '../../types';
const p=(x:number,y:number):Point=>({x,y});
describe('projective calibration (mathematically exact synthetic data)',()=>{
 it('recovers metric rectangle from a tilted quadrilateral',()=>{
   const quad:[Point,Point,Point,Point]=[p(112,98),p(512,140),p(490,390),p(90,455)];
   const c=makeProjectiveCalibration('manual-rectangle',quad,210,297);
   const mapped=quad.map(pt=>projectPoint(c.pixelToMm,pt));
   expect(mapped[0].x).toBeCloseTo(0,7);expect(mapped[0].y).toBeCloseTo(0,7);
   expect(mapped[1].x).toBeCloseTo(210,6);expect(mapped[1].y).toBeCloseTo(0,6);
   expect(mapped[2].x).toBeCloseTo(210,6);expect(mapped[2].y).toBeCloseTo(297,6);
   expect(mapped[3].x).toBeCloseTo(0,6);expect(mapped[3].y).toBeCloseTo(297,6);
   expect(area(mapContourToMm(quad,c.pixelToMm))).toBeCloseTo(210*297,4);
 });
 it('roundtrips a perspective point through the inverse matrix',()=>{
   const src:[Point,Point,Point,Point]=[p(200,100),p(700,140),p(630,620),p(160,450)];
   const dst:[Point,Point,Point,Point]=[p(0,0),p(200,0),p(200,300),p(0,300)];
   const h=fitHomography(src,dst),inv=invertHomography(h);
   const input=p(360,280);
   const recovered=projectPoint(inv,projectPoint(h,input));
   expect(recovered.x).toBeCloseTo(input.x,6);
   expect(recovered.y).toBeCloseTo(input.y,6);
 });
 it('rejects crossed, tiny and collinear reference quads',()=>{
   expect(()=>makeProjectiveCalibration('manual-rectangle',
     [p(0,0),p(100,100),p(100,0),p(0,100)],210,297)).toThrow();
   expect(()=>makeProjectiveCalibration('manual-rectangle',
     [p(0,0),p(2,0),p(2,2),p(0,2)],210,297)).toThrow();
   expect(()=>makeProjectiveCalibration('manual-rectangle',
     [p(0,0),p(100,0),p(200,0),p(300,0)],210,297)).toThrow();
 });
 it('uses an independent length to detect a planted calibration error',()=>{
   const src:[Point,Point,Point,Point]=[p(0,0),p(200,0),p(200,300),p(0,300)];
   const h=makeProjectiveCalibration('manual-rectangle',src,200,300).pixelToMm;
   expect(checkIndependentDistance(h,p(30,90),p(130,90),100).passed).toBe(true);
   const bad=checkIndependentDistance(h,p(30,90),p(130,90),120);
   expect(bad.passed).toBe(false);expect(bad.errorMm).toBeCloseTo(-20,6);
 });
 it('rejects unstable homography horizons',()=>{
   const h=[1,0,0,0,1,0,-1/20,0,1] as const;
   expect(()=>projectPoint([...h],p(20,1))).toThrow(/horizontu/);
 });
 it('reports far extrapolation beyond the reference',()=>{
   const src:[Point,Point,Point,Point]=[p(0,0),p(100,0),p(100,100),p(0,100)];
   const h=makeProjectiveCalibration('aruco-single',src,80,80,5);
   expect(calibrationExtrapolationRatio(h.pixelToMm,[p(500,500)],src)).toBeGreaterThan(3);
   expect(h.markerId).toBe(5);
 });
});
