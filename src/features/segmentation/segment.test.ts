import {describe,expect,it} from 'vitest';
import {segmentOffcut,simplifyRing,traceMask} from './segment';
import {area,isSimple,rectangle} from '../../geometry';
function make(w:number,h:number,fg:(x:number,y:number)=>boolean){
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const k=(y*w+x)*4,v=fg(x,y)?185:20;
   data[k]=v;data[k+1]=fg(x,y)?145:20;data[k+2]=fg(x,y)?94:20;data[k+3]=255;
 }
 return {width:w,height:h,pixels:data};
}
describe('local conservative segmentation',()=>{
 it('extracts a simple concave L from contrasting dark background',()=>{
   const data=make(180,160,(x,y)=>(x>=20&&x<150&&y>=20&&y<60)||
       (x>=20&&x<65&&y>=60&&y<140));
   const s=segmentOffcut(data,{threshold:65});
   expect(isSimple(s.outer)).toBe(true);
   expect(area(s.outer)).toBeGreaterThan(8000);
   expect(area(s.outer)).toBeLessThan(10500);
   expect(s.coverage).toBeGreaterThan(.25);
   expect(s.holes).toHaveLength(0);
 });
 it('retains a large internal opening as a negative-orientation ring',()=>{
   const data=make(160,160,(x,y)=>x>=20&&x<140&&y>=20&&y<140&&
      !(x>=60&&x<100&&y>=60&&y<100));
   const s=segmentOffcut(data,{threshold:65});
   expect(s.holes).toHaveLength(1);
   expect(isSimple(s.holes[0])).toBe(true);
   expect(area(s.holes[0])).toBeGreaterThan(1200);
 });
 it('rejects flat background rather than inventing an OSB region',()=>{
   expect(()=>segmentOffcut(make(100,100,()=>false),{threshold:55})).toThrow();
 });
 it('rejects full foreground touching all edges',()=>{
   expect(()=>segmentOffcut(make(100,100,()=>true),{threshold:55})).toThrow();
 });
 it('traces deterministic closed rings with a known region and holes',()=>{
   const m=new Uint8Array(16*16);
   for(let y=2;y<14;y++)for(let x=2;x<14;x++)m[y*16+x]=1;
   for(let y=6;y<10;y++)for(let x=6;x<10;x++)m[y*16+x]=0;
   const rings=traceMask(m,16,16);
   expect(rings.length).toBe(2);
   expect(rings.map(area).sort((a,b)=>b-a)).toEqual([144,16]);
 });
 it('simplifies a square into a simple four-corner ring',()=>{
   const ring=rectangle(120,80);
   const withMid=[ring[0],{x:60,y:0},ring[1],{x:120,y:40},ring[2],{x:60,y:80},ring[3],{x:0,y:40}];
   const v=simplifyRing(withMid,.5,128);
   expect(isSimple(v)).toBe(true);expect(v.length).toBe(4);
 });
});
