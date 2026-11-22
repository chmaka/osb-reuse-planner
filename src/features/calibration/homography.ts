import type { Point, Polygon } from '../../types';
import { area, box, isSimple } from '../../geometry';

export type Matrix3 = [number,number,number,number,number,number,number,number,number];
export type Quad = [Point,Point,Point,Point];
export interface ProjectiveCalibration {
  method:'manual-rectangle'|'aruco-single';
  sourceCorners:Quad;
  widthMm:number;
  heightMm:number;
  pixelToMm:Matrix3;
  markerId?:number;
  dictionary?:string;
  qualityWarnings:string[];
}
const subtract=(a:Point,b:Point):Point=>({x:a.x-b.x,y:a.y-b.y});
const norm=(p:Point)=>Math.hypot(p.x,p.y);
function matmul(a:Matrix3,b:Matrix3):Matrix3{
  const c=new Array<number>(9);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)
    c[i*3+j]=a[i*3]*b[j]+a[i*3+1]*b[j+3]+a[i*3+2]*b[j+6];
  return c as Matrix3;
}
export function invertHomography(a:Matrix3):Matrix3{
  const [A,B,C,D,E,F,G,H,I]=a;
  const adj=[E*I-F*H,C*H-B*I,B*F-C*E,F*G-D*I,A*I-C*G,C*D-A*F,D*H-E*G,B*G-A*H,A*E-B*D];
  const determinant=A*adj[0]+B*adj[3]+C*adj[6];
  if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-14)
    throw Error('Nedegenerisana projektivna matrica nije dostupna.');
  return adj.map(v=>v/determinant) as Matrix3;
}
export function projectPoint(h:Matrix3,p:Point):Point{
  const w=h[6]*p.x+h[7]*p.y+h[8];
  if(!Number.isFinite(w)||Math.abs(w)<1e-10)throw Error('Tačka je na projektivnom horizontu; promijeni referencu.');
  const x=(h[0]*p.x+h[1]*p.y+h[2])/w;
  const y=(h[3]*p.x+h[4]*p.y+h[5])/w;
  if(!Number.isFinite(x)||!Number.isFinite(y)||Math.max(Math.abs(x),Math.abs(y))>2_000_000)
    throw Error('Projektivna transformacija je nestabilna izvan referentnog područja.');
  return {x,y};
}
function normalizePoints(points:Point[]){
  const mid={x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length};
  const average=points.reduce((s,p)=>s+norm(subtract(p,mid)),0)/points.length;
  if(!Number.isFinite(average)||average<1e-8)throw Error('Referentne tačke su previše blizu jedna drugoj.');
  const s=Math.SQRT2/average;
  const matrix:Matrix3=[s,0,-s*mid.x,0,s,-s*mid.y,0,0,1];
  return {matrix,points:points.map(p=>projectPoint(matrix,p))};
}
function solve8(matrix:number[][],rhs:number[]):number[]{
  const a=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let j=0;j<8;j++){
    let best=j;
    for(let k=j+1;k<8;k++)if(Math.abs(a[k][j])>Math.abs(a[best][j]))best=k;
    if(!Number.isFinite(a[best][j])||Math.abs(a[best][j])<1e-10)
      throw Error('Referentni uglovi ne daju stabilnu perspektivnu kalibraciju.');
    [a[best],a[j]]=[a[j],a[best]];
    const v=a[j][j];
    for(let c=j;c<=8;c++)a[j][c]/=v;
    for(let k=0;k<8;k++){
      if(k===j)continue;
      const factor=a[k][j];
      for(let c=j;c<=8;c++)a[k][c]-=factor*a[j][c];
    }
  }
  return a.map(row=>row[8]);
}
function cross(a:Point,b:Point):number{return a.x*b.y-a.y*b.x}
function isConvexQuad(q:Quad):boolean{
  if(!isSimple(q))return false;
  const signs=q.map((p,i)=>{
    const a=subtract(q[(i+1)%4],p),b=subtract(q[(i+2)%4],q[(i+1)%4]);
    return cross(a,b);
  });
  return signs.every(v=>v>1e-5)||signs.every(v=>v< -1e-5);
}
export function fitHomography(src:Quad,dst:Quad):Matrix3{
  if(!isConvexQuad(src)||!isConvexQuad(dst))
    throw Error('Postavi četiri ugla u pravilnom redosljedu, bez ukrštanja.');
  const ns=normalizePoints(src),nd=normalizePoints(dst);
  const A:number[][]=[],b:number[]=[];
  for(let i=0;i<4;i++){
    const {x,y}=ns.points[i],{x:u,y:v}=nd.points[i];
    A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);
    A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);
  }
  const n=solve8(A,b);
  const hn=[...n,1] as Matrix3;
  const h=matmul(invertHomography(nd.matrix),matmul(hn,ns.matrix));
  const scale=h[8];
  if(!Number.isFinite(scale)||Math.abs(scale)<1e-12)
    throw Error('Kalibracija je numerički nestabilna.');
  const result=h.map(v=>v/scale) as Matrix3;
  if(src.some((p,i)=>norm(subtract(projectPoint(result,p),dst[i]))>1e-4))
    throw Error('Kalibracija nije uspjela; provjeri referentne tačke.');
  return result;
}
export function makeProjectiveCalibration(method:ProjectiveCalibration['method'],
    corners:Quad,widthMm:number,heightMm:number,markerId?:number):ProjectiveCalibration{
  if(!Number.isFinite(widthMm)||!Number.isFinite(heightMm)||widthMm<=0||heightMm<=0||
    widthMm>10_000||heightMm>10_000)throw Error('Referentne dimenzije moraju biti 0–10000 mm.');
  if(!isConvexQuad(corners))throw Error('Potrebna su četiri redom odabrana ugla konveksnog pravougaonika.');
  const lens=corners.map((p,i)=>norm(subtract(corners[(i+1)%4],p)));
  if(Math.min(...lens)<20)throw Error('Referenca je premala na fotografiji (min. 20 px po stranici).');
  const target:Quad=[{x:0,y:0},{x:widthMm,y:0},{x:widthMm,y:heightMm},{x:0,y:heightMm}];
  const h=fitHomography(corners,target);
  const warnings:string[]=[];
  if(Math.min(...lens)<55)warnings.push('Referenca je mala u pikselima; rezultat osjetljiv na grešku odabira ugla.');
  if(Math.max(...lens)/Math.min(...lens)>4)
    warnings.push('Izrazita perspektiva; položaj kamere može smanjiti tačnost.');
  if(method==='aruco-single')
    warnings.push('Jedan marker ne provjerava deformacije daleko od reference; koristi nezavisnu kontrolnu dužinu.');
  return {method,sourceCorners:corners,widthMm,heightMm,pixelToMm:h,
    markerId,dictionary:method==='aruco-single'?'ARUCO_MIP_36h12':undefined,qualityWarnings:warnings};
}
export function mapContourToMm(points:Polygon,h:Matrix3):Polygon{
  const mapped=points.map(p=>projectPoint(h,p));
  if(mapped.length>=3&&(!isSimple(mapped)||area(mapped)<1))
    throw Error('Ispravljena kontura nije važeći poligon.');
  return mapped.length?mapped.map(p=>({
    x:p.x-box(mapped).minX,y:p.y-box(mapped).minY
  })):[];
}
export function checkIndependentDistance(h:Matrix3,a:Point,b:Point,expectedMm:number){
  if(!Number.isFinite(expectedMm)||expectedMm<=0)
    throw Error('Kontrolna dužina mora biti pozitivna.');
  const measuredMm=norm(subtract(projectPoint(h,a),projectPoint(h,b)));
  const errorMm=measuredMm-expectedMm;
  return {measuredMm,errorMm,relativeError:Math.abs(errorMm)/expectedMm,
    passed:Math.abs(errorMm)<=Math.max(2,expectedMm*.02)};
}
export function calibrationExtrapolationRatio(h:Matrix3,contour:Polygon,reference:Quad):number{
  if(!contour.length)return 0;
  const cp=contour.map(p=>projectPoint(h,p));
  const rp=reference.map(p=>projectPoint(h,p));
  const refRadius=Math.max(...rp.map(p=>norm(subtract(p,{x:(rp[0].x+rp[2].x)/2,y:(rp[0].y+rp[2].y)/2}))));
  const mid={x:rp.reduce((s,p)=>s+p.x,0)/4,y:rp.reduce((s,p)=>s+p.y,0)/4};
  return Math.max(...cp.map(p=>norm(subtract(p,mid))))/Math.max(1,refRadius);
}
// Used by the visual rectification preview; no claim of lens-undistortion.
export function rectifiedContourView(points:Polygon,h:Matrix3){
  const poly=mapContourToMm(points,h);
  const bb=poly.length?box(poly):null;
  return {poly,widthMm:bb?bb.maxX-bb.minX:0,heightMm:bb?bb.maxY-bb.minY:0};
}
