import type { PhotoQuality } from './quality';

export interface PreparedPhoto {
  original:Blob;
  preview:Blob;
  width:number;
  height:number;
  quality:PhotoQuality;
  conversion:'native'|'heic-converted';
}
const isHeic=(blob:Blob)=>/heic|heif/i.test(blob.type)||(
  blob instanceof File&&/\.hei[cf]$/i.test(blob.name));
function toBlob(canvas:HTMLCanvasElement,type:string,quality=0.94):Promise<Blob>{
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):
    reject(new Error('Nije moguće kodirati fotografiju.')),type,quality));
}
async function renderBitmap(blob:Blob):Promise<HTMLCanvasElement>{
  const canvas=document.createElement('canvas');
  if(typeof createImageBitmap==='function'){
    try{
      const bmp=await createImageBitmap(blob,{imageOrientation:'from-image'});
      canvas.width=bmp.width;canvas.height=bmp.height;
      canvas.getContext('2d',{alpha:false})?.drawImage(bmp,0,0);
      bmp.close();return canvas;
    }catch { /* Safari / unsupported codec fallback below */ }
  }
  const src=URL.createObjectURL(blob);
  try{
    const image=new Image();
    image.src=src;
    await image.decode();
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    canvas.getContext('2d',{alpha:false})?.drawImage(image,0,0);
    return canvas;
  }finally{URL.revokeObjectURL(src)}
}
export async function runQuality(canvas:HTMLCanvasElement):Promise<PhotoQuality>{
  const factor=Math.min(1,640/Math.max(canvas.width,canvas.height));
  const sampled=document.createElement('canvas');
  sampled.width=Math.max(1,Math.round(canvas.width*factor));
  sampled.height=Math.max(1,Math.round(canvas.height*factor));
  const ctx=sampled.getContext('2d',{willReadFrequently:true});
  if(!ctx)return {issues:[],notes:['Kvalitet slike nije moguće analizirati na ovom uređaju.']};
  ctx.drawImage(canvas,0,0,sampled.width,sampled.height);
  const data=ctx.getImageData(0,0,sampled.width,sampled.height);
  return await new Promise<PhotoQuality>(resolve=>{
    const worker=new Worker(new URL('../../workers/quality.worker.ts',import.meta.url),{type:'module'});
    const timeout=window.setTimeout(()=>{
      worker.terminate();resolve({issues:[],notes:['Analiza fotografije nije završena; ručno provjeri oštrinu i kadar.']});
    },9000);
    worker.onmessage=(event:MessageEvent<{ok:boolean;result?:PhotoQuality}>)=>{
      clearTimeout(timeout);worker.terminate();
      resolve(event.data.ok&&event.data.result?event.data.result:
        {issues:[],notes:['Analiza kvaliteta nije dostupna.']});
    };
    worker.onerror=()=>{
      clearTimeout(timeout);worker.terminate();
      resolve({issues:[],notes:['Analiza kvaliteta nije dostupna.']});
    };
    worker.postMessage({pixels:data.data,width:sampled.width,height:sampled.height},[data.data.buffer]);
  });
}
export async function preparePhoto(original:Blob):Promise<PreparedPhoto>{
  if(original.size>75*1024*1024)throw Error('Fotografija prelazi 75 MB; koristi manju datoteku.');
  let canvas:HTMLCanvasElement;
  let conversion:PreparedPhoto['conversion']='native';
  try{
    canvas=await renderBitmap(original);
  }catch(error){
    if(!isHeic(original))throw error;
    // Lazy CSP-compatible LGPL decoder: imported only if native HEIC is unsupported.
    const {heicTo}=await import('heic-to/csp');
    const converted=await heicTo({blob:original,type:'image/jpeg',quality:0.95});
    canvas=await renderBitmap(converted);
    conversion='heic-converted';
  }
  if(canvas.width<80||canvas.height<80)throw Error('Fotografija je premala (minimum 80 px).');
  if(canvas.width*canvas.height>80_000_000)throw Error('Slika je prevelika za sigurno dekodiranje.');
  // Canvas redraw applies EXIF orientation and normalizes display pixel coordinates;
  // original source bytes are kept separately in IndexedDB for future corrections.
  const [preview,quality]=await Promise.all([toBlob(canvas,'image/jpeg'),runQuality(canvas)]);
  return {original,preview,width:canvas.width,height:canvas.height,quality,conversion};
}
