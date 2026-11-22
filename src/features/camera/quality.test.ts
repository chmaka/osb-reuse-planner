import { describe,expect,it } from 'vitest';
import { analyzePixels } from './quality';
function image(w:number,h:number,get:(x:number,y:number)=>number){
  const data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4,v=get(x,y);data[p]=data[p+1]=data[p+2]=v;data[p+3]=255;}
  return data;
}
describe('advisory capture diagnostics',()=>{
  it('reports featureless flat photo as potential blur and low contrast',()=>{
    const q=analyzePixels(image(64,64,()=>120),64,64);
    expect(q.issues).toContain('BLUR');expect(q.issues).toContain('LOW_CONTRAST');
  });
  it('flags saturated white highlights as possible glare',()=>{
    const q=analyzePixels(image(64,64,(x,y)=>(x+y)%4===0?255:60),64,64);
    expect(q.issues).toContain('GLARE');
  });
  it('flags a high-contrast object crossing the frame',()=>{
    const q=analyzePixels(image(96,96,(x,y)=>(x%2===0||y%2===0)?250:15),96,96);
    expect(q.issues).toContain('FRAME_RISK');
  });
  it('guards invalid buffers without inventing a score',()=>{
    const q=analyzePixels(new Uint8ClampedArray(4),640,640);
    expect(q.notes.length).toBeGreaterThan(0);
  });
});
