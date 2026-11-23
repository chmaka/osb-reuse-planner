import type {Point, Polygon, Remnant, EdgeCheck} from '../../types';

export type RingKind = EdgeCheck['ringKind'];
export interface SelectedSpan {
 ringKind:RingKind;ringIndex:number;fromVertex:number;toVertex:number;
 points:[Point,Point];scannedMm:number;
}
export function getRing(remnant:Pick<Remnant,'polygonMm'|'holesMm'|'defectsMm'>,kind:RingKind,index:number):Polygon {
 if(!Number.isInteger(index)||index<0)throw Error('Nevažeći indeks konture.');
 if(kind==='outer'){
   if(index!==0)throw Error('Spoljna kontura ima samo indeks 0.');
   return remnant.polygonMm;
 }
 const items=kind==='hole'?remnant.holesMm:remnant.defectsMm;
 const selected=items[index];
 if(!selected)throw Error('Izabrani otvor/oštećenje ne postoji.');
 return selected;
}
export function measuredSpan(remnant:Pick<Remnant,'polygonMm'|'holesMm'|'defectsMm'>,
 kind:RingKind,index:number,fromVertex:number,toVertex:number):SelectedSpan{
 const ring=getRing(remnant,kind,index);
 if(!Number.isInteger(fromVertex)||!Number.isInteger(toVertex)||fromVertex===toVertex||
    Math.min(fromVertex,toVertex)<0||Math.max(fromVertex,toVertex)>=ring.length)
   throw Error('Izaberi dva različita, postojeća temena iste konture.');
 const a=ring[fromVertex],b=ring[toVertex];
 if(![a.x,a.y,b.x,b.y].every(Number.isFinite))
   throw Error('Temena nemaju ispravne koordinate.');
 const length=Math.hypot(a.x-b.x,a.y-b.y);
 if(!Number.isFinite(length)||length<1||length>50000)
   throw Error('Dužina između temena mora biti od 1 do 50000 mm.');
 return {ringKind:kind,ringIndex:index,fromVertex,toVertex,
   points:[{...a},{...b}],scannedMm:length};
}
export function checkEdgeLength(t:Pick<EdgeCheck,'scannedMm'|'physicalMm'|'toleranceMm'>){
 const v=[t.scannedMm,t.physicalMm,t.toleranceMm];
 if(v.some((n,i)=>!Number.isFinite(n)||(i===2?n<0:n<=0))||
    t.scannedMm>50000||t.physicalMm>50000||t.toleranceMm>1000)
   throw Error('Izmjerena i stvarna dužina moraju biti pozitivne, a prag nenegativan.');
 const signedMm=t.scannedMm-t.physicalMm;
 return {signedMm,absoluteMm:Math.abs(signedMm),withinTolerance:Math.abs(signedMm)<=t.toleranceMm};
}
function quantile(vals:number[],p:number){
 if(!vals.length)return null;
 const sorted=[...vals].sort((a,b)=>a-b);
 return sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];
}
export function summarizeEdgeChecks(checks:EdgeCheck[]){
 const errs=checks.map(c=>checkEdgeLength(c).absoluteMm);
 const distinctRemnants=new Set(checks.map(c=>c.remnantId)).size;
 const meanMm=errs.length?errs.reduce((s,n)=>s+n,0)/errs.length:null;
 return {
  count:checks.length,
  distinctRemnants,readings:errs.length,
  meanAbsoluteErrorMm:meanMm,
  rmseMm:errs.length?Math.sqrt(errs.reduce((s,n)=>s+n*n,0)/errs.length):null,
  p95Mm:quantile(errs,.95),
  worstMm:errs.length?Math.max(...errs):null,
  exceedingTolerance:checks.filter(c=>!checkEdgeLength(c).withinTolerance).length,
  byRingKind:(['outer','hole','defect'] as const).map(kind=>{
    const arr=checks.filter(c=>c.ringKind===kind);
    const a=arr.map(c=>checkEdgeLength(c).absoluteMm);
    return {kind,count:a.length,maeMm:a.length?a.reduce((s,n)=>s+n,0)/a.length:null};
  })
 };
}
function quote(v:string|number){
 const s=String(v);
 const protectedValue=typeof v==='string'&&/^\s*[=+\-@\t\r]/.test(s)?"'"+s:s;
 return '"'+protectedValue.replaceAll('"','""')+'"';
}
export function exportEdgeChecksCsv(checks:EdgeCheck[]):string{
 const header=[
  'id','at','remnant_id','remnant_label','revision','segmentation_algorithm','ring_kind','ring_index',
  'from_vertex','to_vertex','from_x_mm','from_y_mm','to_x_mm','to_y_mm','scanned_mm',
  'physical_mm','signed_error_mm','absolute_error_mm','tolerance_mm','within_warning_threshold','reference_tool','notes'
 ];
 const rows=checks.map(c=>{
  const e=checkEdgeLength(c);
  return [
   c.id,c.at,c.remnantId,c.remnantLabel,c.remnantRevision,c.algorithm,c.ringKind,c.ringIndex,
   c.fromVertex,c.toVertex,c.from.x,c.from.y,c.to.x,c.to.y,c.scannedMm,
   c.physicalMm,e.signedMm,e.absoluteMm,c.toleranceMm,e.withinTolerance?'YES':'NO',c.referenceMethod,c.notes
  ].map(quote).join(',');
 });
 return [header.map(quote).join(','),...rows].join('\r\n')+'\r\n';
}
