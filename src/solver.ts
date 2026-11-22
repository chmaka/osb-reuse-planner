import { box, validPlacement, rotateAndMove, rectangle, area } from './geometry';
import type { NestingResult, Point, Polygon, Remnant } from './types';

export interface SolveInput {
  stock: Pick<Remnant,'id'|'polygonMm'|'holesMm'|'defectsMm'>;
  widthMm: number; heightMm: number; quantity: number;
  clearanceMm: number; stepMm: number; allowRotation: boolean;
}
export function solvePreview(input: SolveInput): NestingResult {
  const {stock,widthMm,heightMm,quantity,clearanceMm,stepMm,allowRotation}=input;
  if([widthMm,heightMm,clearanceMm,stepMm,quantity].some(v=>!Number.isFinite(v)) ||
    widthMm<=0 || heightMm<=0 || stepMm<=0 || quantity<1 || quantity>40 || clearanceMm<0)
    throw new Error('Neispravni numerički parametri.');
  const part=rectangle(widthMm,heightMm), occupied: Polygon[]=[];
  const placements: NestingResult['placements']=[], unplaced: string[]=[];
  let checkedCandidates=0;
  const bounds=box(stock.polygonMm), rotations=allowRotation?[0,90]:[0];
  const exclusions: Polygon[]=[...stock.holesMm,...stock.defectsMm];
  for(let i=0;i<Math.floor(quantity);i++){
    let chosen: {x:number;y:number;rot:number;poly:Point[]}|undefined;
    search: for(const rot of rotations){
      const probe=rotateAndMove(part,0,0,rot), dims=box(probe);
      const right=bounds.maxX-(dims.maxX-dims.minX), bottom=bounds.maxY-(dims.maxY-dims.minY);
      for(let y=bounds.minY;y<=bottom+1e-6;y+=stepMm)
        for(let x=bounds.minX;x<=right+1e-6;x+=stepMm){
          // Deterministic finite scan, exact polygon feasibility check; not a production optimizer.
          if(++checkedCandidates>200000) break search;
          const poly=rotateAndMove(part,x,y,rot);
          if(validPlacement(poly,stock.polygonMm,exclusions,occupied,clearanceMm)){
            chosen={x,y,rot,poly};break search;
          }
        }
    }
    if(chosen){
      occupied.push(chosen.poly);
      placements.push({partId:'part-'+(i+1),x:chosen.x,y:chosen.y,
        rotation:chosen.rot,polygonMm:chosen.poly});
    }else unplaced.push('part-'+(i+1));
  }
  const valid=placements.every((p,i)=>validPlacement(p.polygonMm,stock.polygonMm,
    exclusions,placements.filter((_,j)=>j!==i).map(v=>v.polygonMm),clearanceMm));
  // Area results are geometry only, not actual manufacturing yield.
  if(placements.reduce((s,p)=>s+area(p.polygonMm),0)>area(stock.polygonMm)+1e-6) return {
    remnantId:stock.id,placements:[],unplaced:Array.from({length:quantity},(_,i)=>'part-'+(i+1)),
    clearanceMm,checkedCandidates,algorithm:'deterministic-grid-0.1',valid:false,createdAt:new Date().toISOString()
  };
  return {remnantId:stock.id,placements,unplaced,clearanceMm,checkedCandidates,
    algorithm:'deterministic-grid-0.1',valid,createdAt:new Date().toISOString()};
}