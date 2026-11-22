import type {Point} from '../../types';
export interface DetectedMarker {id:number;hammingDistance:number;corners:[Point,Point,Point,Point]}
export async function detectAruco(blob:Blob):Promise<DetectedMarker[]>{
  const bmp=await createImageBitmap(blob);
  try{
    const ratio=Math.min(1,1400/Math.max(bmp.width,bmp.height));
    const w=Math.max(64,Math.round(bmp.width*ratio)),h=Math.max(64,Math.round(bmp.height*ratio));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true,alpha:false});
    if(!ctx)throw Error('Canvas obrada nije dostupna.');
    ctx.drawImage(bmp,0,0,w,h);
    const pixels=ctx.getImageData(0,0,w,h).data;
    return await new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('../../workers/aruco.worker.ts',import.meta.url),{type:'module'});
      let finished=false;
      const done=(error?:Error,markers?:DetectedMarker[])=>{
        if(finished)return;finished=true;window.clearTimeout(timeout);worker.terminate();
        if(error)reject(error);else resolve(markers||[]);
      };
      const timeout=window.setTimeout(()=>done(Error('Detekcija markera je predugo trajala.')),12000);
      worker.onmessage=(event:MessageEvent<{ok:boolean;markers?:DetectedMarker[];error?:string}>)=>{
        if(event.data.ok)done(undefined,event.data.markers);
        else done(Error(event.data.error||'Marker nije prepoznat.'));
      };
      worker.onerror=()=>done(Error('ArUco detektor nije mogao da se učita. Koristi ručnu referencu.'));
      worker.postMessage({width:w,height:h,scaleX:bmp.width/w,scaleY:bmp.height/h,pixels},[pixels.buffer]);
    });
  }finally{bmp.close()}
}
export async function generateMarkerSvg(id:number,blackSquareMm:number):Promise<string>{
  if(!Number.isInteger(id)||id<0||id>249)throw Error('ID markera mora biti 0–249.');
  if(!Number.isFinite(blackSquareMm)||blackSquareMm<20||blackSquareMm>400)
    throw Error('Stranica markera mora biti između 20 i 400 mm.');
  const {AR}=await import('js-aruco2');
  const svg=new AR.Dictionary('ARUCO_MIP_36h12').generateSVG(id);
  // MIP_36h12 has 8x8 black square including its border, plus one white module
  // of quiet-zone on each side. Thus printable image is 10 modules square.
  const printMm=blackSquareMm*10/8;
  return svg.replace('<svg ','<svg width="'+printMm+'mm" height="'+printMm+'mm" ');
}
