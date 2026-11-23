import type {Point} from '../../types';
import type {ArucoGeometry,MaskData} from './rebble';
import {markerPromptPoints} from './rebble';

const MODEL='Xenova/slimsam-77-uniform';
let cached:Promise<{
 model:Awaited<ReturnType<(typeof import('@huggingface/transformers'))['SamModel']['from_pretrained']>>;
 processor:Awaited<ReturnType<(typeof import('@huggingface/transformers'))['AutoProcessor']['from_pretrained']>>;
}>|null=null;
async function loadModel(progress?:(message:string)=>void){
 if(!cached){
   cached=(async()=>{
     progress?.('Preuzimam SlimSAM model (prvi put potreban internet); slike ostaju u browseru...');
     const {SamModel,AutoProcessor}=await import('@huggingface/transformers');
     const [model,processor]=await Promise.all([
       SamModel.from_pretrained(MODEL,{device:'webgpu',dtype:'fp16'}),
       AutoProcessor.from_pretrained(MODEL)
     ]);
     return {model,processor};
   })().catch(error=>{cached=null;throw error});
 }
 return cached;
}
function validation(width:number,height:number,points:Point[]){
 if(!Number.isFinite(width)||!Number.isFinite(height)||!width||!height||
   points.some(p=>!Number.isFinite(p.x+p.y)))
   throw Error('Neispravan format AI upita.');
}
export async function inferMarkerSamMask(
 blob:Blob,marker:ArucoGeometry,progress?:(message:string)=>void
):Promise<MaskData>{
 if(!('gpu' in navigator))throw Error('WebGPU nije dostupan na ovom uređaju; koristi brzu lokalnu segmentaciju.');
 const bitmap=await createImageBitmap(blob);
 let src:Blob;
 try{
   const ratio=Math.min(1,768/Math.max(bitmap.width,bitmap.height));
   const w=Math.max(32,Math.round(bitmap.width*ratio)),h=Math.max(32,Math.round(bitmap.height*ratio));
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Nema Canvas podrške.');
   ctx.drawImage(bitmap,0,0,w,h);
   src=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(
     b=>b?resolve(b):reject(Error('Nije moguće pripremiti SAM fotografiju.')),'image/png'));
 }finally{bitmap.close()}
 const url=URL.createObjectURL(src);
 try{
   const {SamModel,AutoProcessor,RawImage,Tensor}=await import('@huggingface/transformers');
   // Referencing constructors above ensures compatible dynamic types; model is cached.
   void SamModel;void AutoProcessor;
   const {model,processor}=await loadModel(progress);
   progress?.('SAM prepoznaje oblik OSB ostatka...');
   const input=await RawImage.fromURL(url);
   const imageData=await processor(input);
   const embeddings=await model.get_image_embeddings(imageData);
   const resized=imageData.reshaped_input_sizes[0];
   const prompt=markerPromptPoints(marker,input.width,input.height);
   validation(input.width,input.height,prompt);
   const values=prompt.flatMap(p=>[p.x/input.width*resized[1],p.y/input.height*resized[0]]);
   const input_points=new Tensor('float32',Float32Array.from(values),[1,1,prompt.length,2]);
   const input_labels=new Tensor('int64',BigInt64Array.from(prompt.map(p=>BigInt(p.label))),[1,1,prompt.length]);
   const {pred_masks,iou_scores}=await model({...embeddings,input_points,input_labels});
   const all=await processor.post_process_masks(
     pred_masks,imageData.original_sizes,imageData.reshaped_input_sizes);
   const mask=RawImage.fromTensor(all[0][0]);
   const scores=Array.from(iou_scores.data,Number);
   let best=0;
   for(let i=1;i<scores.length;i++)if(scores[i]>scores[best])best=i;
   const n=mask.width*mask.height;
   const channels=scores.length||1;
   if(!Number.isFinite(n)||n<=0||n>3_000_000||mask.data.length<n*channels)
     throw Error('SAM je vratio neočekivane dimenzije maske.');
   const binary=new Uint8Array(n);
   for(let i=0;i<n;i++)binary[i]=Number(mask.data[i*channels+best])>0?1:0;
   return {data:binary,width:mask.width,height:mask.height,
     imageWidth:bitmap.width,imageHeight:bitmap.height};
 }finally{URL.revokeObjectURL(url)}
}
