import type { Point, Polygon } from './types';

const EPS = 1e-7;
export function area(p: Polygon): number {
  return Math.abs(signedArea(p));
}
export function signedArea(p: Polygon): number {
  return p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a.x * b.y - b.x * a.y;
  }, 0) / 2;
}
export function box(p: Polygon) {
  return {
    minX: Math.min(...p.map(v => v.x)), maxX: Math.max(...p.map(v => v.x)),
    minY: Math.min(...p.map(v => v.y)), maxY: Math.max(...p.map(v => v.y))
  };
}
function cross(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function onSegment(p: Point, a: Point, b: Point): boolean {
  return Math.abs(cross(a, b, p)) < EPS &&
    p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS &&
    p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;
}
export function pointInPolygon(p: Point, ring: Polygon, inclusive = true): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if (onSegment(p, a, b)) return inclusive;
    if ((a.y > p.y) !== (b.y > p.y) &&
      p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function segmentsProperIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const x1 = cross(a,b,c), x2 = cross(a,b,d), y1 = cross(c,d,a), y2 = cross(c,d,b);
  return ((x1 > EPS && x2 < -EPS) || (x1 < -EPS && x2 > EPS)) &&
    ((y1 > EPS && y2 < -EPS) || (y1 < -EPS && y2 > EPS));
}
export function edges(ring: Polygon): [Point, Point][] {
  return ring.map((p, i) => [p, ring[(i + 1) % ring.length]]);
}
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const x1 = cross(a,b,c), x2 = cross(a,b,d), y1 = cross(c,d,a), y2 = cross(c,d,b);
  if ((x1 > EPS && x2 < -EPS || x1 < -EPS && x2 > EPS) &&
      (y1 > EPS && y2 < -EPS || y1 < -EPS && y2 > EPS)) return true;
  return onSegment(c,a,b) || onSegment(d,a,b) || onSegment(a,c,d) || onSegment(b,c,d);
}
function distPointSegment(p: Point, a: Point, b: Point): number {
  const dx=b.x-a.x, dy=b.y-a.y, len2=dx*dx+dy*dy;
  const t=len2 ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len2)) : 0;
  return Math.hypot(p.x-a.x-t*dx, p.y-a.y-t*dy);
}
export function segmentDistance(a: Point,b: Point,c: Point,d: Point): number {
  if (segmentsIntersect(a,b,c,d)) return 0;
  return Math.min(distPointSegment(a,c,d),distPointSegment(b,c,d),
    distPointSegment(c,a,b),distPointSegment(d,a,b));
}
export function minEdgeDistance(a: Polygon,b: Polygon): number {
  let result=Infinity;
  for(const [p,q] of edges(a)) for(const [u,v] of edges(b))
    result=Math.min(result,segmentDistance(p,q,u,v));
  return result;
}
export function isSimple(p: Polygon): boolean {
  if(p.length<3 || !p.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)) || area(p)<EPS) return false;
  for(let i=0;i<p.length;i++){
    if(Math.hypot(p[i].x-p[(i+1)%p.length].x,p[i].y-p[(i+1)%p.length].y)<EPS) return false;
    for(let j=i+1;j<p.length;j++){
      if(j===i+1 || (i===0&&j===p.length-1)) continue;
      if(segmentsIntersect(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length])) return false;
    }
  }
  return true;
}
export function polygonsOverlap(a: Polygon,b: Polygon): boolean {
  if(a.some(p=>pointInPolygon(p,b,false)) || b.some(p=>pointInPolygon(p,a,false))) return true;
  return edges(a).some(([p,q])=>edges(b).some(([u,v])=>segmentsIntersect(p,q,u,v)));
}
export function contained(part: Polygon, stock: Polygon, exclusions: Polygon[], clearanceMm: number): boolean {
  if(!isSimple(part)||!isSimple(stock)||!Number.isFinite(clearanceMm)||clearanceMm<0) return false;
  if(!part.every(p=>pointInPolygon(p,stock,true))) return false;
  // Vertex-only tests are insufficient for concave stock: crossing edges must also be rejected.
  if(edges(part).some(([a,b]) => {
    const m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    return !pointInPolygon(m,stock,true) ||
      edges(stock).some(([c,d])=>segmentsProperIntersect(a,b,c,d) ||
        (clearanceMm>0 && segmentDistance(a,b,c,d)<clearanceMm-EPS));
  })) return false;
  for(const cut of exclusions){
    if(!isSimple(cut)) return false;
    if(polygonsOverlap(part,cut)) return false;
    if(minEdgeDistance(part,cut)<clearanceMm-EPS) return false;
  }
  // With zero clearance, touching stock is allowed; positive clearance excludes touching.
  if(clearanceMm>0 && minEdgeDistance(part,stock)<clearanceMm-EPS) return false;
  return true;
}
export function validPlacement(part: Polygon, stock: Polygon, exclusions: Polygon[],
  others: Polygon[], clearanceMm: number): boolean {
  return contained(part,stock,exclusions,clearanceMm) && others.every(other =>
    !polygonsOverlap(part,other) && minEdgeDistance(part,other)>=clearanceMm-EPS);
}
export function rotateAndMove(p: Polygon, x: number, y: number, deg: number): Polygon {
  const a=deg*Math.PI/180, c=Math.cos(a),s=Math.sin(a);
  const moved=p.map(v=>({x:v.x*c-v.y*s,y:v.x*s+v.y*c}));
  const bb=box(moved);
  return moved.map(v=>({x:v.x-bb.minX+x,y:v.y-bb.minY+y}));
}
export function normalized(p: Polygon): Polygon {
  const b=box(p);
  return p.map(v=>({x:v.x-b.minX,y:v.y-b.minY}));
}
export function rectangle(w: number, h: number): Polygon {
  return [{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
}