import type {Point, Polygon} from '../../types';
import {area,box,isSimple,pointInPolygon,signedArea} from '../../geometry';
import {simplifyRing,traceMask} from './segment';

export type ArucoGeometry={id:number;corners:[Point,Point,Point,Point];hammingDistance:number};
export type PositivePoint={x:number;y:number;label:0|1};
export type MaskData={width:number;height:number;data:Uint8Array;imageWidth:number;imageHeight:number};
export interface ReBbleContours {outer:Polygon;holes:Polygon[];pixelStep:number;coverage:number;algorithm:string;warnings:string[]}

/** Original Re:bble prompt rule: points 0.75*(corner - marker centroid) outside each marker corner.
 * This is not a learned mask or a measurement. All points remain in photo coordinates.
 */
export function markerPromptPoints(marker:ArucoGeometry,imageW:number,imageH:number,offset=.75):PositivePoint[]{
  if(!Number.isFinite(imageW)||!Number.isFinite(imageH)||imageW<=0||imageH<=0)
    throw Error('Dimenzije fotografije nijesu ispravne.');
  if(!Number.isFinite(offset)||offset<.1||offset>1.5)
    throw Error('Nevažeći razmak tačaka SAM upita.');
  const centroid={x:marker.corners.reduce((s,p)=>s+p.x,0)/4,
    y:marker.corners.reduce((s,p)=>s+p.y,0)/4};
  return marker.corners.map(p=>({
    x:Math.max(0,Math.min(imageW-1,p.x+offset*(p.x-centroid.x))),
    y:Math.max(0,Math.min(imageH-1,p.y+offset*(p.y-centroid.y))),
    label:1 as const
  }));
}
export function metricDimensions(mmContour:Polygon,holes:Polygon[]=[]){
  if(mmContour.length<3||!isSimple(mmContour))throw Error('Potrebna je ispravna kontura u mm.');
  const bounds=box(mmContour);
  const outer=area(mmContour);
  const holeArea=holes.reduce((s,p)=>s+area(p),0);
  const widthMm=bounds.maxX-bounds.minX,heightMm=bounds.maxY-bounds.minY;
  if(!Number.isFinite(widthMm+heightMm)||widthMm<=0||heightMm<=0||outer<=holeArea)
    throw Error('Nevažeće fizičke dimenzije.');
  return {widthMm,heightMm,outerAreaMm2:outer,netAreaMm2:outer-holeArea};
}
function centroid(ring:Polygon):Point{
  return {x:ring.reduce((s,p)=>s+p.x,0)/ring.length,
    y:ring.reduce((s,p)=>s+p.y,0)/ring.length};
}
/** Exclude marker-shaped apparent holes. A printed marker on top of an OSB sheet is not a cutout. */
export function removeMarkerOcclusions(holes:Polygon[],marker:ArucoGeometry,marginPx=8):Polygon[]{
  const bounds=box(marker.corners);
  const effectiveMargin=Math.max(marginPx,(bounds.maxX-bounds.minX)*.2,(bounds.maxY-bounds.minY)*.2);
  return holes.filter(ring=>{
    const middle=centroid(ring),radius=effectiveMargin;
    const inside=moleculeInsideExpandedMarker(middle,marker.corners,radius);
    const bb=box(ring);
    const covered=bb.minX>=bounds.minX-radius&&bb.maxX<=bounds.maxX+radius&&
      bb.minY>=bounds.minY-radius&&bb.maxY<=bounds.maxY+radius;
    return !(inside&&covered);
  });
}
function moleculeInsideExpandedMarker(p:Point,quad:Polygon,margin:number){
  if(pointInPolygon(p,quad))return true;
  const b=box(quad);return p.x>=b.minX-margin&&p.x<=b.maxX+margin&&
    p.y>=b.minY-margin&&p.y<=b.maxY+margin;
}
export function maskToRebbleContours(mask:MaskData,marker:ArucoGeometry):ReBbleContours{
 const {width,height,data,imageWidth,imageHeight}=mask;
 if(width<32||height<32||width*height>3_000_000||data.length<width*height)
   throw Error('Nevažeća AI segmentaciona maska.');
 const sx=imageWidth/width,sy=imageHeight/height;
 const clean=new Uint8Array(width*height);
 let active=0;
 for(let i=0;i<clean.length;i++){clean[i]=data[i]>0?1:0;active+=clean[i]}
 if(active<width*height*.008||active>width*height*.97)
   throw Error('Maska nema upotrebljivu OSB površinu. Pokušaj drugi ugao fotografisanja.');
 const loops=traceMask(clean,width,height)
   .map(r=>simplifyRing(r,.8,300)).filter(r=>r.length>=3&&isSimple(r));
 if(!loops.length)throw Error('AI maska ne sadrži važeću konturu.');
 const sorted=loops.slice().sort((a,b)=>area(b)-area(a));
 const outerSmall=sorted[0];
 if(area(outerSmall)<width*height*.008)
   throw Error('Detektovani predmet je premali.');
 const inner=sorted.slice(1).filter(p=>area(p)>=Math.max(30,width*height*.00015)&&signedArea(p)<0)
   .filter(p=>pointInPolygon(centroid(p),outerSmall));
 const scale=(ring:Polygon)=>ring.map(p=>({x:p.x*sx,y:p.y*sy}));
 const outer=scale(outerSmall);
 const holes=removeMarkerOcclusions(inner.map(scale),marker);
 if(!isSimple(outer))throw Error('Segmentirani poligon se sam presijeca.');
 const warnings=[
   'Re:bble/SAM kontura je automatski predlog, ne potvrđena proizvodna geometrija.',
   'Otvori prekriveni markerom nisu stvarni otvori; ručno pregledaj sve preostale rupe.',
   'Mjerenje pretpostavlja da su marker i OSB obod u istoj ravni.'
 ];
 const edges=outer.filter(p=>p.x<sx*3||p.y<sy*3||p.x>imageWidth-sx*3||p.y>imageHeight-sy*3);
 if(edges.length)warnings.push('Kontura dodiruje ivicu fotografije; dio OSB-a možda je odsječen.');
 return {outer,holes:holes.slice(0,50),coverage:active/(width*height),pixelStep:Math.max(sx,sy),
   algorithm:'rebble-slimsam-marker-guided-v1',warnings};
}
