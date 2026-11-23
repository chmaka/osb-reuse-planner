import type {Point,Polygon} from '../../types';
import {area,isSimple,signedArea} from '../../geometry';

export type PixelBuffer={width:number;height:number;pixels:Uint8ClampedArray};
export type SegmentationOptions={threshold:number;sample?:Point;minRegionPixels?:number};
export type SegmentationCandidate={outer:Polygon;holes:Polygon[];coverage:number;pixelStep:number;warnings:string[];algorithm:string};
const EPS=1e-7;
function key(x:number,y:number){return y*65536+x}
function hex(a:number,b:number){return Math.hypot(a,b)}
function edgeLength(a:Point,b:Point){return hex(a.x-b.x,a.y-b.y)}
function segmentError(p:Point,a:Point,b:Point){
 const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
 if(!len)return edgeLength(p,a);
 const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len));
 return hex(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}
function simplifyOpen(path:Polygon,tolerance:number):Polygon{
 if(path.length<=2)return path;
 const keep=new Uint8Array(path.length);
 keep[0]=1;keep[path.length-1]=1;
 const stack:[[number,number],...[number,number][]]=[[0,path.length-1]];
 while(stack.length){
   const [from,to]=stack.pop()!;
   let best=0,index=-1;
   for(let i=from+1;i<to;i++){
     const d=segmentError(path[i],path[from],path[to]);
     if(d>best){best=d;index=i}
   }
   if(index>=0&&best>tolerance){
     keep[index]=1;stack.push([from,index],[index,to]);
   }
 }
 return path.filter((_,i)=>keep[i]===1);
}
export function simplifyRing(input:Polygon,tolerance:number,maxVertices=256):Polygon{
 if(input.length<3)return input;
 const path=input.filter((p,i)=>i===0||edgeLength(p,input[i-1])>EPS);
 if(path.length>1&&edgeLength(path[0],path[path.length-1])<EPS)path.pop();
 if(path.length<4)return path;
 // Closed RDP: split at a deterministic farthest vertex, so corners at closure survive.
 const anchor=path[0];let cut=1,maximum=0;
 for(let i=1;i<path.length;i++){
   const d=edgeLength(anchor,path[i]);
   if(d>maximum){maximum=d;cut=i}
 }
 if(maximum<EPS)return [];
 const first=simplifyOpen(path.slice(0,cut+1),tolerance);
 const second=simplifyOpen([...path.slice(cut),path[0]],tolerance);
 let ring=[...first,...second.slice(1,-1)];
 // Remove collinear vertices without altering polygon topology.
 ring=ring.filter((v,i,a)=>{
   const before=a[(i+a.length-1)%a.length],after=a[(i+1)%a.length];
   return segmentError(v,before,after)>Math.max(0.25,tolerance*.12);
 });
 // Progressive tolerance only if polygon remains simple; never silently accept self intersections.
 let epsilon=tolerance;
 while(ring.length>maxVertices&&epsilon<64){
   epsilon=epsilon*1.4+.1;
   const one=simplifyOpen(path.slice(0,cut+1),epsilon);
   const two=simplifyOpen([...path.slice(cut),path[0]],epsilon);
   const candidate=[...one,...two.slice(1,-1)];
   if(candidate.length>=3&&isSimple(candidate))ring=candidate;
   else break;
 }
 if(!isSimple(ring))return [];
 return ring;
}
function backgroundColor({width,height,pixels}:PixelBuffer):[number,number,number]{
 const colors:[number[],number[],number[]]=[[],[],[]];
 const r=Math.max(2,Math.round(Math.min(width,height)*.025));
 for(const cy of [r,height-1-r])for(const cx of [r,width-1-r]){
   for(let y=Math.max(0,cy-r);y<=Math.min(height-1,cy+r);y+=2)
     for(let x=Math.max(0,cx-r);x<=Math.min(width-1,cx+r);x+=2){
       const i=(y*width+x)*4;
       for(let c=0;c<3;c++)colors[c].push(pixels[i+c]);
     }
 }
 return colors.map(v=>v.sort((a,b)=>a-b)[Math.floor(v.length/2)]||0) as [number,number,number];
}
function majority(mask:Uint8Array,w:number,h:number):Uint8Array{
 const out=new Uint8Array(mask);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   let count=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)
     count+=mask[(y+dy)*w+x+dx];
   out[y*w+x]=count>=5?1:0;
 }
 return out;
}
function largestComponent(mask:Uint8Array,w:number,h:number,seed?:Point):{mask:Uint8Array;size:number}{
 const visited=new Uint8Array(mask.length),queue=new Int32Array(mask.length);
 let selected:number[]=[],bestSize=0;
 const seedIndex=seed?Math.floor(seed.y)*w+Math.floor(seed.x):-1;
 const useSeed=seedIndex>=0&&seedIndex<mask.length&&!!mask[seedIndex];
 const scan=(initial:number)=>{
   let from=0,to=1;queue[0]=initial;visited[initial]=1;
   while(from<to){
     const i=queue[from++],x=i%w,y=Math.floor(i/w);
     for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1]){
       if(j>=0&&mask[j]&&!visited[j]){visited[j]=1;queue[to++]=j}
     }
   }
   return to;
 };
 if(useSeed){
   const count=scan(seedIndex);
   selected=Array.from(queue.slice(0,count));bestSize=count;
 }else{
   for(let i=0;i<mask.length;i++)if(mask[i]&&!visited[i]){
     const count=scan(i);
     if(count>bestSize){bestSize=count;selected=Array.from(queue.slice(0,count))}
   }
 }
 const result=new Uint8Array(mask.length);
 for(const i of selected)result[i]=1;
 return {mask:result,size:bestSize};
}
export function traceMask(mask:Uint8Array,w:number,h:number):Polygon[]{
 if(w<2||h<2||mask.length!==w*h||w>=65536||h>=65536)return [];
 const edgeMap=new Map<number,number[]>();
 const insert=(ax:number,ay:number,bx:number,by:number)=>{
   const a=key(ax,ay),b=key(bx,by);
   const list=edgeMap.get(a)||[];list.push(b);edgeMap.set(a,list);
 };
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const idx=y*w+x;if(!mask[idx])continue;
   if(y===0||!mask[idx-w])insert(x,y,x+1,y);
   if(x===w-1||!mask[idx+1])insert(x+1,y,x+1,y+1);
   if(y===h-1||!mask[idx+w])insert(x+1,y+1,x,y+1);
   if(x===0||!mask[idx-1])insert(x,y+1,x,y);
 }
 const result:Polygon[]=[];
 let remaining=[...edgeMap.values()].reduce((s,a)=>s+a.length,0);
 while(remaining>0){
   const start=[...edgeMap.keys()].find(k=>(edgeMap.get(k)?.length||0)>0);
   if(start===undefined)break;
   const ring:Polygon=[];let current=start,closed=false,walk=0;
   while(++walk<2_000_000){
     const ends=edgeMap.get(current);
     if(!ends?.length)break;
     ring.push({x:current%65536,y:Math.floor(current/65536)});
     const next=ends.pop()!;remaining--;current=next;
     if(current===start){closed=true;break}
   }
   if(closed&&ring.length>=4)result.push(ring);
 }
 return result;
}
export function segmentOffcut(input:PixelBuffer,options:SegmentationOptions):SegmentationCandidate{
 const {width:w,height:h,pixels}=input;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<32||h<32||w*h>1_200_000||pixels.length<w*h*4)
   throw Error('Nevažeća ili prevelika slika za lokalnu segmentaciju.');
 if(!Number.isFinite(options.threshold)||options.threshold<10||options.threshold>200)
   throw Error('Prag segmentacije mora biti 10–200.');
 const [br,bg,bb]=backgroundColor(input);
 let mask:Uint8Array=new Uint8Array(w*h);
 for(let i=0;i<mask.length;i++){
   const k=4*i,dr=pixels[k]-br,dg=pixels[k+1]-bg,db=pixels[k+2]-bb;
   const distance=Math.sqrt(.3*dr*dr+.59*dg*dg+.11*db*db);
   mask[i]=distance>=options.threshold?1:0;
 }
 mask=majority(mask,w,h);
 let {mask:main,size}=largestComponent(mask,w,h,options.sample);
 if(size<Math.max(options.minRegionPixels??200,w*h*.008))
   throw Error('Nije pronađena dovoljno velika kontura. Povećaj kontrast ili promijeni prag.');
 const coverage=size/(w*h);
 if(coverage>.92)throw Error('Skoro cijela fotografija liči na materijal. Postavi tamnu podlogu oko ostatka.');
 // Extract exposed cell edges: largest clockwise boundary and optional counterclockwise holes.
 const loops=traceMask(main,w,h).map(p=>simplifyRing(p,.75,256)).filter(p=>p.length>=3&&isSimple(p));
 if(!loops.length)throw Error('Nije dobijena ispravna kontura. Koristi ručno crtanje.');
 const outer=[...loops].sort((a,b)=>area(b)-area(a))[0];
 if(signedArea(outer)<0)outer.reverse();
 const holes=loops.filter(p=>p!==outer&&area(p)>Math.max(32,w*h*.00015)&&signedArea(p)<0)
   .filter(p=>p.every(pt=>pointInOuter(pt,outer)));
 const warnings:string[]=[
   'Automatska kontura je samo predlog. Provjeri svaki ugao, otvor i oštećenje prije čuvanja.',
   'Prag i smanjenje rezolucije ne daju garantovanu tačnost u milimetrima.'
 ];
 if(coverage>.8)warnings.push('Materijal je blizu ivice fotografije: provjeri da kontura nije odsječena.');
 if(outer.length>=250)warnings.push('Kontura je veoma složena; ručno provjeri šum i nepotrebna temena.');
 return {outer,holes:holes.slice(0,50),coverage,pixelStep:1,warnings,algorithm:'background-color-largest-component-v1'};
}
function pointInOuter(p:Point,ring:Polygon):boolean{
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const a=ring[i],b=ring[j];
   if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
