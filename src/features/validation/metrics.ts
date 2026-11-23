import {box} from '../../geometry';
import type {Remnant,ValidationTrial} from '../../types';

export type DimensionalError={
  deltaWidthMm:number;deltaHeightMm:number;
  absoluteWidthMm:number;absoluteHeightMm:number;
  worstMm:number;withinTolerance:boolean
};
export function predictedBounds(remnant:Pick<Remnant,'polygonMm'>){
  if(remnant.polygonMm.length<3)throw Error('Ostatak nema izmjerenu konturu.');
  const b=box(remnant.polygonMm);
  const widthMm=b.maxX-b.minX,heightMm=b.maxY-b.minY;
  if(!Number.isFinite(widthMm)||!Number.isFinite(heightMm)||widthMm<=0||heightMm<=0)
    throw Error('Neispravne digitalne dimenzije ostatka.');
  return {widthMm,heightMm};
}
export function evaluateTrial(trial:Pick<ValidationTrial,'predictedWidthMm'|'predictedHeightMm'|'actualWidthMm'|'actualHeightMm'|'toleranceMm'>):DimensionalError{
  const numbers=[trial.predictedWidthMm,trial.predictedHeightMm,trial.actualWidthMm,trial.actualHeightMm,trial.toleranceMm];
  if(numbers.some((v,i)=>!Number.isFinite(v)||(i<4?v<=0:v<0)))
    throw Error('Širina, visina i tolerancija moraju biti ispravni pozitivni brojevi.');
  if(numbers.slice(0,4).some(v=>v>50000)||trial.toleranceMm>1000)
    throw Error('Unesene dimenzije/tolerancija su izvan dozvoljenog raspona.');
  const deltaWidthMm=trial.predictedWidthMm-trial.actualWidthMm;
  const deltaHeightMm=trial.predictedHeightMm-trial.actualHeightMm;
  const absoluteWidthMm=Math.abs(deltaWidthMm),absoluteHeightMm=Math.abs(deltaHeightMm);
  const worstMm=Math.max(absoluteWidthMm,absoluteHeightMm);
  return {deltaWidthMm,deltaHeightMm,absoluteWidthMm,absoluteHeightMm,
    worstMm,withinTolerance:worstMm<=trial.toleranceMm};
}
function quantileNearestRank(values:number[],fraction:number):number|null{
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.max(0,Math.ceil(fraction*sorted.length)-1)];
}
export interface PilotStats{
  trials:number;uniqueRemnants:number;targetRemnants:number;remainingRemnants:number;
  readings:number;meanAbsoluteErrorMm:number|null;rmseMm:number|null;p95AbsoluteErrorMm:number|null;
  maxErrorMm:number|null;withinTolerance:number;failedTolerance:number;
  byMethod:{method:string;count:number;meanAbsoluteErrorMm:number;p95AbsoluteErrorMm:number}[];
}
export function summarizePilot(trials:ValidationTrial[],target=20):PilotStats{
  if(!Number.isInteger(target)||target<1)throw Error('Cilj validacije mora biti pozitivan cio broj.');
  const all=trials.flatMap(t=>{const e=evaluateTrial(t);return [e.absoluteWidthMm,e.absoluteHeightMm]});
  const total=all.reduce((s,v)=>s+v,0);
  const groups=new Map<string,number[]>();
  for(const t of trials){
    const method=t.algorithm||t.calibrationMethod||'manual';
    const g=groups.get(method)||[];
    const e=evaluateTrial(t);
    g.push(e.absoluteWidthMm,e.absoluteHeightMm);groups.set(method,g);
  }
  const uniqueRemnants=new Set(trials.map(t=>t.remnantId)).size;
  return {
    trials:trials.length,uniqueRemnants,targetRemnants:target,
    remainingRemnants:Math.max(0,target-uniqueRemnants),readings:all.length,
    meanAbsoluteErrorMm:all.length?total/all.length:null,
    rmseMm:all.length?Math.sqrt(all.reduce((s,v)=>s+v*v,0)/all.length):null,
    p95AbsoluteErrorMm:quantileNearestRank(all,.95),
    maxErrorMm:all.length?Math.max(...all):null,
    withinTolerance:trials.filter(t=>evaluateTrial(t).withinTolerance).length,
    failedTolerance:trials.filter(t=>!evaluateTrial(t).withinTolerance).length,
    byMethod:[...groups.entries()].map(([method,v])=>({
      method,count:v.length/2,meanAbsoluteErrorMm:v.reduce((s,n)=>s+n,0)/v.length,
      p95AbsoluteErrorMm:quantileNearestRank(v,.95)!
    })).sort((a,b)=>a.method.localeCompare(b.method))
  };
}
function cell(value:string|number):string{
  const text=String(value);
  if(typeof value==='number')return '"'+text+'"';
  // Spreadsheet formula-injection protection for untrusted labels, device descriptions and notes.
  const safe=/^[\s]*[=+@\-]/.test(text)?"'"+text:text;
  return '"'+safe.replaceAll('"','""')+'"';
}
export function exportPilotCsv(trials:ValidationTrial[]):string{
  const header=['id','timestamp','remnant_id','label','algorithm','calibration','revision','device','lighting','reference_method',
    'scanned_width_mm','physical_width_mm','delta_width_mm','scanned_height_mm','physical_height_mm','delta_height_mm',
    'worst_absolute_error_mm','workshop_tolerance_mm','within_workshop_tolerance','notes'];
  const rows=trials.map(t=>{
    const result=evaluateTrial(t);
    return [t.id,t.at,t.remnantId,t.remnantLabel,t.algorithm,t.calibrationMethod,t.remnantRevision,
      t.device,t.lighting,t.referenceMethod,t.predictedWidthMm,t.actualWidthMm,result.deltaWidthMm,
      t.predictedHeightMm,t.actualHeightMm,result.deltaHeightMm,result.worstMm,t.toleranceMm,
      result.withinTolerance?'YES':'NO',t.notes].map(cell).join(',');
  });
  return [header.map(cell).join(','),...rows].join('\r\n')+'\r\n';
}
