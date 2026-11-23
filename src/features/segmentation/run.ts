import type {Point} from '../../types';
import type {SegmentationCandidate} from './segment';

export async function proposeSegmentation(blob:Blob,threshold:number,seed?:Point):Promise<SegmentationCandidate>{
 const bmp=await createImageBitmap(blob);
 try{
   // Do not stall Android devices with full-resolution segmentation.
   const scale=Math.min(1,720/Math.max(bmp.width,bmp.height));
   const width=Math.max(32,Math.round(bmp.width*scale));
   const height=Math.max(32,Math.round(bmp.height*scale));
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)throw Error('Canvas obrada nije dostupna.');
   ctx.drawImage(bmp,0,0,width,height);
   const image=ctx.getImageData(0,0,width,height);
   return await new Promise((resolve,reject)=>{
     const worker=new Worker(new URL('../../workers/segment.worker.ts',import.meta.url),{type:'module'});
     let settled=false;
     const end=(value?:SegmentationCandidate,error?:Error)=>{
       if(settled)return;settled=true;window.clearTimeout(timeout);worker.terminate();
       if(error)reject(error);else resolve(value!);
     };
     const timeout=window.setTimeout(()=>end(undefined,Error('Segmentacija je prekoračila vrijeme. Smanji fotografiju ili nacrtaj konturu ručno.')),16000);
     worker.onmessage=(event:MessageEvent<{ok:boolean;result?:SegmentationCandidate;error?:string}>)=>{
       if(event.data.ok&&event.data.result)end(event.data.result);
       else end(undefined,Error(event.data.error||'Automatsko izdvajanje nije uspjelo.'));
     };
     worker.onerror=()=>end(undefined,Error('Worker za segmentaciju nije dostupan.'));
     const sample=seed?{x:seed.x*width/bmp.width,y:seed.y*height/bmp.height}:undefined;
     worker.postMessage({width,height,sourceWidth:bmp.width,sourceHeight:bmp.height,
       threshold,pixels:image.data,sample},[image.data.buffer]);
   });
 }finally{bmp.close()}
}
