/// <reference lib="webworker" />
import { analyzePixels } from '../features/camera/quality';
self.onmessage=(event:MessageEvent<{pixels:Uint8ClampedArray;width:number;height:number}>)=>{
  try{
    const {pixels,width,height}=event.data;
    self.postMessage({ok:true,result:analyzePixels(pixels,width,height)});
  }catch(error){self.postMessage({ok:false,error:String(error)})}
};
