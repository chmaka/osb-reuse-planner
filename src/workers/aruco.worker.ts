/// <reference lib="webworker" />
import {AR} from 'js-aruco2';
const detector=new AR.Detector({dictionaryName:'ARUCO_MIP_36h12',maxHammingDistance:2});
self.onmessage=(event:MessageEvent<{width:number;height:number;pixels:Uint8ClampedArray;scaleX:number;scaleY:number}>)=>{
  try{
    const {width,height,pixels,scaleX,scaleY}=event.data;
    if(width<64||height<64||width*height>2_500_000||pixels.byteLength<width*height*4)
      throw Error('Nevažeća ili prevelika fotografija za detekciju.');
    const markers=detector.detect({width,height,data:pixels})
      .filter(m=>m.corners.length===4&&m.hammingDistance<=2)
      .map(m=>({id:m.id,hammingDistance:m.hammingDistance,
        corners:m.corners.map(p=>({x:p.x*scaleX,y:p.y*scaleY}))}));
    self.postMessage({ok:true,markers});
  }catch(error){self.postMessage({ok:false,error:String(error)})}
};
