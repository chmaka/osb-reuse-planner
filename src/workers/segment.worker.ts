/// <reference lib="webworker" />
import {segmentOffcut} from '../features/segmentation/segment';
self.onmessage=(event:MessageEvent<{
 width:number;height:number;pixels:Uint8ClampedArray;threshold:number;
 sourceWidth:number;sourceHeight:number;sample?:{x:number;y:number}
}>)=>{
 try{
   const {width,height,pixels,threshold,sourceWidth,sourceHeight,sample}=event.data;
   const result=segmentOffcut({width,height,pixels},{threshold,sample});
   const scale=(ring:{x:number;y:number}[])=>
     ring.map(p=>({x:p.x*sourceWidth/width,y:p.y*sourceHeight/height}));
   self.postMessage({ok:true,result:{...result,outer:scale(result.outer),
     holes:result.holes.map(scale),pixelStep:Math.max(sourceWidth/width,sourceHeight/height)}});
 }catch(error){self.postMessage({ok:false,error:String(error)})}
};
