/** Advisory photo diagnostics. Not a calibrated metric or contour detector. */
export type PhotoIssue = 'BLUR' | 'GLARE' | 'LOW_CONTRAST' | 'FRAME_RISK';
export interface PhotoQuality {
  issues: PhotoIssue[];
  notes: string[];
}
export const issueMessage: Record<PhotoIssue, string> = {
  BLUR: 'Fotografija može biti zamućena. Stabilizuj telefon, dodirni fokus i snimi ponovo.',
  GLARE: 'Mogući jaki odsjaji. Promijeni ugao osvjetljenja ili položaj ostatka.',
  LOW_CONTRAST: 'Nizak kontrast. Postavi OSB na tamniju jednobojnu podlogu.',
  FRAME_RISK: 'Detalji dopiru do ivica kadra. Provjeri da je cijela kontura vidljiva.'
};
export function analyzePixels(data: Uint8ClampedArray, width: number, height: number): PhotoQuality {
  if(width<8||height<8||data.length<width*height*4)
    return {issues:[],notes:['Analiza nije moguća na datoj rezoluciji.']};
  const lum=new Float32Array(width*height);
  const hist=new Uint32Array(256);
  let clipped=0, count=0;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    const i=y*width+x, j=i*4;
    const r=data[j],g=data[j+1],b=data[j+2];
    const v=.2126*r+.7152*g+.0722*b;
    lum[i]=v;
    hist[Math.min(255,Math.floor(v))]++;
    if(r>247&&g>247&&b>247)clipped++;
    count++;
  }
  const percentile=(f:number)=>{
    let k=0;const target=count*f;
    for(let v=0;v<256;v++){k+=hist[v];if(k>=target)return v}
    return 255;
  };
  let sum=0,sumSq=0,n=0;
  for(let y=2;y<height-2;y+=2)for(let x=2;x<width-2;x+=2){
    const i=y*width+x;
    const lap=4*lum[i]-lum[i-width]-lum[i+width]-lum[i-1]-lum[i+1];
    sum+=lap;sumSq+=lap*lap;n++;
  }
  const variance=n?sumSq/n-(sum/n)**2:0;
  // Check visual structure along the outer 2% of the frame as a cautious cue,
  // never classify an object as cropped with certainty.
  let border=0,sharpBorder=0;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    if(x>width*.025&&x<width*.975&&y>height*.025&&y<height*.975)continue;
    const i=y*width+x;
    const gradient=Math.abs(lum[i+1]-lum[i-1])+Math.abs(lum[i+width]-lum[i-width]);
    if(gradient>65)sharpBorder++;
    border++;
  }
  const issues:PhotoIssue[]=[];
  if(variance<70)issues.push('BLUR');
  if(clipped/count>.035)issues.push('GLARE');
  if(percentile(.95)-percentile(.05)<65)issues.push('LOW_CONTRAST');
  if(border&&sharpBorder/border>.14)issues.push('FRAME_RISK');
  return {issues,notes:issues.map(k=>issueMessage[k])};
}
