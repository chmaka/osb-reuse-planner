import type { NestingResult, Polygon, Remnant } from './types';

function poly(ring: Polygon, layer: string): string[] {
  const out=['0','LWPOLYLINE','8',layer,'90',String(ring.length),'70','1'];
  for(const v of ring) out.push('10',String(v.x),'20',String(v.y));
  return out;
}
/** Deliberately REFERENCE_ONLY for Phase 0. No manufacturing cut entities or G-code. */
export function referenceDxf(stock: Remnant, layout: NestingResult): string {
  if(layout.remnantId!==stock.id || !layout.valid) throw new Error('Nije odobrena geometrija.');
  const lines=[
    '0','SECTION','2','HEADER','9','$ACADVER','1','AC1015',
    '9','$INSUNITS','70','4','0','ENDSEC',
    '0','SECTION','2','TABLES','0','TABLE','2','LAYER','70','2',
    '0','LAYER','2','REFERENCE_ONLY','70','0','62','7','6','CONTINUOUS',
    '0','LAYER','2','DEFECT_REFERENCE','70','0','62','1','6','CONTINUOUS',
    '0','ENDTAB','0','ENDSEC',
    '0','SECTION','2','ENTITIES',
    ...poly(stock.polygonMm,'REFERENCE_ONLY'),
    ...stock.holesMm.flatMap(h=>poly(h,'DEFECT_REFERENCE')),
    ...stock.defectsMm.flatMap(h=>poly(h,'DEFECT_REFERENCE')),
    ...layout.placements.flatMap(p=>poly(p.polygonMm,'REFERENCE_ONLY')),
    '0','ENDSEC','0','EOF'
  ];
  return lines.join('\n')+'\n';
}
export function downloadText(content:string,filename:string,mime:string):void {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}