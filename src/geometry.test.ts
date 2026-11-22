import { describe,it,expect } from 'vitest';
import { area, contained, isSimple, normalized, pointInPolygon, rectangle, validPlacement } from './geometry';
import { solvePreview } from './solver';
import { referenceDxf } from './dxf';
import type { Remnant } from './types';
const L=[{x:0,y:0},{x:100,y:0},{x:100,y:40},{x:40,y:40},{x:40,y:100},{x:0,y:100}];
const base:Remnant={id:'r',label:'Test',material:'OSB',thicknessMm:18,polygonMm:L,
  holesMm:[],defectsMm:[],areaMm2:6400,location:'Test',status:'MEASURED',
  calibrationMethod:'two-point-manual',mmPerPx:1,revision:1,createdAt:'',updatedAt:''};
describe('geometry and conservative layout',()=>{
  it('area for concave L stock',()=>expect(area(L)).toBe(6400));
  it('rejects diagonal outside concave stock even when both endpoints lie in it',()=>{
    const triangle=[{x:20,y:80},{x:80,y:20},{x:20,y:20}];
    expect(contained(triangle,L,[],0)).toBe(false);
  });
  it('rejects self intersection',()=>expect(isSimple([{x:0,y:0},{x:2,y:2},{x:0,y:2},{x:2,y:0}])).toBe(false));
  it('detects boundary as included',()=>expect(pointInPolygon({x:0,y:10},L)).toBe(true));
  it('does not allow part to overlap a hole',()=>{
    const stock=rectangle(150,150),hole=[{x:50,y:50},{x:70,y:50},{x:70,y:70},{x:50,y:70}];
    expect(validPlacement(rectangle(100,100),stock,[hole],[],0)).toBe(false);
  });
  it('rejects 2mm edge distance when clearance is 3mm',()=>{
    expect(validPlacement(rectangle(30,30),rectangle(100,100),[],[],3)).toBe(false);
  });
  it('normalizes negative coordinates',()=>expect(normalized([{x:-3,y:-7},{x:1,y:-7},{x:1,y:0}])[0]).toEqual({x:0,y:0}));
  it('produces nonoverlapping contained placements on irregular stock',()=>{
    const solution=solvePreview({stock:base,widthMm:20,heightMm:20,quantity:4,
      clearanceMm:2,stepMm:5,allowRotation:true});
    expect(solution.valid).toBe(true);expect(solution.placements.length).toBeGreaterThan(0);
    expect(solution.checkedCandidates).toBeGreaterThan(0);
  });
  it('exports mm INSUNITS and closed polylines as reference only',()=>{
    const layout=solvePreview({stock:base,widthMm:15,heightMm:15,quantity:1,
      clearanceMm:2,stepMm:5,allowRotation:false});
    const dxf=referenceDxf(base,layout);
    expect(dxf).toContain('$INSUNITS\n70\n4');expect(dxf).toContain('LWPOLYLINE');
    expect(dxf).toContain('REFERENCE_ONLY');expect(dxf).not.toContain('PART_OUTER_CUT');
  });
});