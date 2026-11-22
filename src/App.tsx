import { useEffect, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Activity, AlertTriangle, ArrowRight, Box, Camera, CheckCircle2,
  ChevronRight, ClipboardCheck, Download, Focus, Grid2x2, HardDrive,
  Layers3, Menu, Package, Play, Plus, RotateCcw, Ruler, Save, Search, Settings2,
  ShieldAlert, Trash2, WifiOff
} from 'lucide-react';
import { db, storeCapturedPhoto, storeScan } from './db';
import { area, box, isSimple, normalized } from './geometry';
import { referenceDxf, downloadText } from './dxf';
import type { NestingResult, Point, Remnant, ScanRecord } from './types';
import CapturePanel, { type PhotoSource } from './features/camera/CapturePanel';
import { preparePhoto } from './features/camera/photo';
import type { PhotoQuality } from './features/camera/quality';
import { detectAruco, generateMarkerSvg } from './features/calibration/aruco';
import type { DetectedMarker } from './features/calibration/aruco';
import { makeProjectiveCalibration, mapContourToMm, checkIndependentDistance, calibrationExtrapolationRatio, rectifiedContourView } from './features/calibration/homography';
import type { ProjectiveCalibration, Quad } from './features/calibration/homography';
import type { SolveInput } from './solver';

type Page = 'dashboard'|'scan'|'inventory'|'nesting'|'production'|'analytics'|'settings';
const pages:{id:Page;title:string;Icon:typeof Box}[]=[
  {id:'dashboard',title:'Pregled',Icon:Grid2x2},
  {id:'scan',title:'Skeniranje',Icon:Camera},
  {id:'inventory',title:'Inventar',Icon:Package},
  {id:'nesting',title:'Nesting',Icon:Layers3},
  {id:'production',title:'Proizvodnja',Icon:ClipboardCheck},
  {id:'analytics',title:'Analitika',Icon:Activity},
  {id:'settings',title:'Podešavanja',Icon:Settings2}
];
function FormLabel({children}: {children:ReactNode}) {return <label className="form-label">{children}</label>}
function Metric({title,value,unit,Icon}: {title:string;value:string;unit?:string;Icon:typeof Box}) {
  return <div className="metric"><div className="metric-top"><span>{title}</span><Icon size={18}/></div>
    <div className="metric-value">{value}<small>{unit}</small></div></div>
}
function formatArea(mm2:number){return (mm2/1_000_000).toLocaleString('sr-RS',{maximumFractionDigits:3})}
function coords(p:Point[]){return p.map(v=>v.x+','+v.y).join(' ')}
function fromPointer(e:ReactPointerEvent<SVGSVGElement>):Point {
  const ctm=e.currentTarget.getScreenCTM();
  if(!ctm) return {x:0,y:0};
  const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(ctm.inverse());
  return {x:p.x,y:p.y};
}
function PhotoThumbnail({imageId}:{imageId?:string}){
  const [src,setSrc]=useState('');
  useEffect(()=>{
    let url='';
    if(imageId) db.images.get(imageId).then(img=>{
      if(img){url=URL.createObjectURL(img.normalizedBlob||img.blob);setSrc(url)}
    });
    return ()=>{if(url)URL.revokeObjectURL(url)};
  },[imageId]);
  return src?<img className="thumb" src={src} alt="Fotografija ostatka"/>:
    <div className="thumb empty-thumb"><Package size={22}/></div>;
}
function Header({title,subtitle,action}:{title:string;subtitle:string;action?:ReactNode}){
  return <header className="page-header"><div><div className="eyebrow">MEDITERA / OSB REUSE LAB</div>
    <h1>{title}</h1><p>{subtitle}</p></div>{action}</header>;
}
function Notice({children}:{children:ReactNode}){
  return <div className="notice"><AlertTriangle size={18}/><span>{children}</span></div>;
}
function Dashboard({remnants,onNavigate}:{remnants:Remnant[];onNavigate:(p:Page)=>void}){
  const total=remnants.reduce((a,r)=>a+r.areaMm2,0);
  const recent=remnants.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,4);
  return <>
    <Header title="OSB Reuse Lab" subtitle="Digitalni inventar OSB ostataka. Ponovna upotreba počinje preciznim mjerenjem."
      action={<button className="primary header-action" onClick={()=>onNavigate('scan')}><Plus size={17}/> Novi ostatak</button>}/>
    <div className="metrics"><Metric title="Evidentirani ostaci" value={String(remnants.length)} Icon={Package}/>
      <Metric title="Izmjerena površina" value={formatArea(total)} unit="m²" Icon={Grid2x2}/>
      <Metric title="Za fizičku provjeru" value={String(remnants.filter(r=>r.status==='MEASURED').length)} Icon={Ruler}/>
    </div>
    <section className="dashboard-grid">
      <div className="panel hero-panel"><div className="eyebrow pale">RADNI PROCES · FAZA 1</div>
        <h2>Od fotografije do digitalne konture.</h2>
        <p>Fotografiši ostatak, definiši dvije referentne tačke, unesi njihovo rastojanje u milimetrima i nacrtaj obod. Podaci se čuvaju lokalno.</p>
        <button className="light-button" onClick={()=>onNavigate('scan')}>Pokreni skeniranje <ArrowRight size={17}/></button>
        <div className="hero-figure"><div className="fragment f-one"/><div className="fragment f-two"/><div className="fragment f-three"/></div>
      </div>
      <div className="panel card-padding"><div className="section-title"><h2>Posljednji ostaci</h2>
        <button className="text-button" onClick={()=>onNavigate('inventory')}>Sav inventar <ChevronRight size={16}/></button></div>
        {recent.length===0?<div className="empty-state small"><Package/><h3>Nema sačuvanih ostataka</h3><p>Prvi ostatak unesi preko Skeniranje.</p></div>:
          recent.map(r=><div className="recent-row" key={r.id}><PhotoThumbnail imageId={r.imageId}/>
            <div><strong>{r.label}</strong><small>{r.material} {r.thicknessMm} mm · {formatArea(r.areaMm2)} m²</small></div>
            <span className="status-pill">Izmjereno</span></div>)}
      </div>
    </section>
    <Notice>Izmjerena kontura nije automatski verifikovana za CNC. Trenutni DXF služi samo kao referenca, ne kao putanja rezanja.</Notice>
  </>;
}
function Scan({onSaved}:{onSaved:()=>void}){
  const [image,setImage]=useState<Blob|null>(null);
  const [imageUrl,setImageUrl]=useState('');
  const [dimensions,setDimensions]=useState({w:0,h:0});
  const [processing,setProcessing]=useState(false);
  const [quality,setQuality]=useState<PhotoQuality|null>(null);
  const [scanRef,setScanRef]=useState<{id:string;imageId:string}|null>(null);
  const capturedScans=useLiveQuery(()=>db.scans.where('status').equals('CAPTURED').toArray(),[])||[];
  const [captureError,setCaptureError]=useState('');
  const [mode,setMode]=useState<'scale'|'trace'|'check'>('scale');
  const [calMode,setCalMode]=useState<'line'|'rectangle'|'marker'>('line');
  const [quadPoints,setQuadPoints]=useState<Point[]>([]);
  const [cardWidth,setCardWidth]=useState('210');
  const [cardHeight,setCardHeight]=useState('297');
  const [markerSize,setMarkerSize]=useState('80');
  const [markerId,setMarkerId]=useState('0');
  const [markers,setMarkers]=useState<DetectedMarker[]>([]);
  const [chosenMarker,setChosenMarker]=useState<number|null>(null);
  const [detecting,setDetecting]=useState(false);
  const [checkPoints,setCheckPoints]=useState<Point[]>([]);
  const [checkDistance,setCheckDistance]=useState('100');
  const [showCorrected,setShowCorrected]=useState(false);
  const [refPoints,setRefPoints]=useState<Point[]>([]);
  const [contour,setContour]=useState<Point[]>([]);
  const [knownDistance,setKnownDistance]=useState('100');
  const [name,setName]=useState('');
  const [location,setLocation]=useState('Radionica');
  const [thickness,setThickness]=useState('18');
  const [busy,setBusy]=useState(false);
  const scaleDistance=refPoints.length===2?Math.hypot(refPoints[0].x-refPoints[1].x,refPoints[0].y-refPoints[1].y):0;
  const mmPerPx=scaleDistance>0?Number(knownDistance)/scaleDistance:0;
  const selectedMarker=markers.find(m=>m.id===chosenMarker);
  const activeCorners=calMode==='rectangle'?quadPoints:calMode==='marker'?selectedMarker?.corners:undefined;
  const calibrationState=useMemo(()=>{
    if(calMode==='line')return {value:null as ProjectiveCalibration|null,error:''};
    if(!activeCorners||activeCorners.length!==4)return {value:null as ProjectiveCalibration|null,error:''};
    try {
      const w=Number(calMode==='rectangle'?cardWidth:markerSize);
      const h=Number(calMode==='rectangle'?cardHeight:markerSize);
      return {value:makeProjectiveCalibration(
        calMode==='rectangle'?'manual-rectangle':'aruco-single',
        activeCorners as Quad,w,h,calMode==='marker'?chosenMarker??undefined:undefined),error:''};
    } catch(e){return {value:null as ProjectiveCalibration|null,error:String(e)}}
  },[calMode,quadPoints,chosenMarker,markers,cardWidth,cardHeight,markerSize]);
  const calibration=calibrationState.value;
  const calibrated=calMode==='line'?mmPerPx>0&&Number.isFinite(mmPerPx):!!calibration;
  const transformed=useMemo(()=>{
    try {
      if(!calibrated||!contour.length)return {points:[] as Point[],error:''};
      const points=calibration?mapContourToMm(contour,calibration.pixelToMm):
        normalized(contour.map(p=>({x:p.x*mmPerPx,y:p.y*mmPerPx})));
      return {points,error:''};
    } catch(e){return {points:[] as Point[],error:String(e)}}
  },[calibrated,contour,calibration,mmPerPx]);
  const polyMm=transformed.points;
  const polyBounds=polyMm.length>=3?box(polyMm):null;
  const traceValid=contour.length>=3 && isSimple(polyMm) && !transformed.error;
  const validation=useMemo(()=>{
    if(!calibration||checkPoints.length!==2)return null;
    try{return checkIndependentDistance(calibration.pixelToMm,checkPoints[0],checkPoints[1],Number(checkDistance))}
    catch{return null}
  },[calibration,checkPoints,checkDistance]);
  const extrapolation=useMemo(()=>{
    if(!calibration||!contour.length)return 0;
    try{return calibrationExtrapolationRatio(calibration.pixelToMm,contour,calibration.sourceCorners)}
    catch{return Infinity}
  },[calibration,contour]);
  const readyForSave=calibrated&&traceValid&&(calMode==='line'||validation?.passed===true)&&extrapolation<12;
  const correctedView=calibration&&traceValid?rectifiedContourView(contour,calibration.pixelToMm):null;
  useEffect(()=>{
    if(!image){setImageUrl('');return}
    const url=URL.createObjectURL(image);setImageUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[image]);
  async function acceptImage(raw:Blob, source:PhotoSource):Promise<void>{
    setCaptureError('');setProcessing(true);
    try{
      const prepared=await preparePhoto(raw);
      const saved=await storeCapturedPhoto(prepared.original,prepared.preview,{
        source,width:prepared.width,height:prepared.height,
        qualityWarnings:prepared.quality.notes,conversion:prepared.conversion,
        originalName:raw instanceof File?raw.name:undefined
      });
      setDimensions({w:prepared.width,h:prepared.height});
      setImage(prepared.preview);setQuality(prepared.quality);
      setScanRef(saved);setRefPoints([]);setQuadPoints([]);setCheckPoints([]);setMarkers([]);setChosenMarker(null);
      setContour([]);setMode('scale');setShowCorrected(false);
    }catch(error){
      setCaptureError('Fotografija nije obrađena: '+String(error));
      throw error;
    }finally{setProcessing(false)}
  }
  async function resumeCaptured(record:ScanRecord):Promise<void>{
    setCaptureError('');setProcessing(true);
    try{
      const asset=await db.images.get(record.imageId);
      if(!asset)throw new Error('Nedostaje originalna fotografija.');
      setImage(asset.normalizedBlob||asset.blob);
      setDimensions({w:record.width,h:record.height});
      setScanRef({id:record.id,imageId:record.imageId});
      setQuality({issues:[],notes:record.qualityWarnings});
      setRefPoints([]);setQuadPoints([]);setCheckPoints([]);setMarkers([]);setChosenMarker(null);
      setContour([]);setMode('scale');setShowCorrected(false);
    }catch(error){setCaptureError(String(error))}
    finally{setProcessing(false)}
  }
  function addPoint(e:ReactPointerEvent<SVGSVGElement>){
    if(!image||!dimensions.w)return;
    const p=fromPointer(e);
    if(p.x<0||p.y<0||p.x>dimensions.w||p.y>dimensions.h)return;
    if(mode==='scale'){
      if(calMode==='line')setRefPoints(points=>points.length<2?[...points,p]:[p]);
      else if(calMode==='rectangle')setQuadPoints(points=>points.length<4?[...points,p]:[p]);
    }else if(mode==='check')setCheckPoints(points=>points.length<2?[...points,p]:[p]);
    else setContour(points=>[...points,p]);
  }
  async function findMarkers(){
    if(!image)return;
    setDetecting(true);setCaptureError('');
    try{
      const found=await detectAruco(image);
      const filtered=found.slice().sort((a,b)=>a.hammingDistance-b.hammingDistance);
      setMarkers(filtered);setChosenMarker(filtered[0]?.id??null);
      if(!filtered.length)setCaptureError('Marker nije prepoznat. Provjeri štampu, osvjetljenje i potpun kadar. Možeš koristiti četiri ručne tačke.');
    }catch(error){setCaptureError('Detekcija nije uspjela: '+String(error))}
    finally{setDetecting(false)}
  }
  async function downloadMarker(){
    try{
      const svg=await generateMarkerSvg(Number(markerId),Number(markerSize));
      downloadText(svg,'MEDITERA_ARUCO_MIP36h12_ID'+markerId+'_'+markerSize+'mm.svg','image/svg+xml');
    }catch(error){setCaptureError('Marker nije generisan: '+String(error))}
  }
  function changeCalibration(next:'line'|'rectangle'|'marker'){
    setCalMode(next);setRefPoints([]);setQuadPoints([]);setMarkers([]);setChosenMarker(null);
    setContour([]);setCheckPoints([]);setMode('scale');setShowCorrected(false);setCaptureError('');
  }
  async function save(){
    if(!image||!readyForSave||Number(thickness)<=0)return;
    setBusy(true);setCaptureError('');
    try{
      const now=new Date().toISOString(),id=crypto.randomUUID(),imageId=scanRef?.imageId||crypto.randomUUID();
      await storeScan({id,label:name.trim()||'OSB ostatak '+id.slice(0,6),material:'OSB',
        thicknessMm:Number(thickness),polygonMm:polyMm,holesMm:[],defectsMm:[],
        areaMm2:area(polyMm),location:location.trim()||'Nepoznato',status:'MEASURED',
        calibrationMethod:calibration?.method||'two-point-manual',
        mmPerPx:calibration?null:mmPerPx,calibration:calibration?{
          ...calibration,
          independentCheck:validation?{...validation,expectedMm:Number(checkDistance)}:undefined
        }:undefined,
        revision:1,imageId,
        scanId:scanRef?.id,createdAt:now,updatedAt:now},scanRef?undefined:image);
      onSaved();
    }catch(e){setCaptureError('Nije sačuvano: '+String(e))}
    finally{setBusy(false)}
  }
  return <>
    <Header title="Skeniranje" subtitle="Fotografija → kalibracija mjerila/perspektive → kontrola → kontura u milimetrima."/>
    <div className="scan-layout">
      <div className="panel canvas-panel">
        <div className="canvas-top"><h2>Fotografija ostatka</h2><span className="tag">Samo lokalni podaci</span></div>
        {!imageUrl&&<CapturePanel onCapture={acceptImage} onError={setCaptureError}/>}
        {imageUrl?<div className="image-editor">
          <div className="editor-toolbar"><div className="tabs">
            <button className={mode==='scale'?'tab active':'tab'} onClick={()=>setMode('scale')}><Ruler size={15}/> 1. Mjerilo</button>
            <button className={mode==='check'?'tab active':'tab'} onClick={()=>setMode('check')} disabled={!calibration}><CheckCircle2 size={15}/> 2. Kontrola</button>
            <button className={mode==='trace'?'tab active':'tab'} onClick={()=>setMode('trace')} disabled={!calibrated}><Focus size={15}/> 3. Kontura</button>
          </div><div className="toolbar-right">
            <button title="Poništi posljednju tačku" className="icon-btn" onClick={()=>mode==='scale'?(calMode==='line'?setRefPoints(p=>p.slice(0,-1)):setQuadPoints(p=>p.slice(0,-1))):mode==='check'?setCheckPoints(p=>p.slice(0,-1)):setContour(p=>p.slice(0,-1))}><RotateCcw size={17}/></button>
            <button title="Nova fotografija" className="icon-btn" onClick={()=>{setImage(null);setContour([]);setRefPoints([]);setQuadPoints([]);setCheckPoints([]);setMarkers([]);setChosenMarker(null);setScanRef(null);setQuality(null)}}><Trash2 size={17}/></button>
          </div></div>
          <div className="editor-stage">
            <svg viewBox={'0 0 '+dimensions.w+' '+dimensions.h} className="photo-svg" onPointerDown={addPoint}>
              <image href={imageUrl} width={dimensions.w} height={dimensions.h} preserveAspectRatio="none" pointerEvents="none"/>
              {mode==='scale'&&calMode==='line'&&refPoints.length===2&&<line x1={refPoints[0].x} y1={refPoints[0].y} x2={refPoints[1].x} y2={refPoints[1].y} stroke="#ffdb84" strokeWidth={Math.max(3,dimensions.w/180)} strokeDasharray="10 8" pointerEvents="none"/>}
              {calMode==='rectangle'&&quadPoints.length>1&&
                <polyline points={coords(quadPoints)} fill="none" stroke="#ffda78" strokeWidth={Math.max(3,dimensions.w/220)} pointerEvents="none"/>}
              {calMode==='marker'&&selectedMarker&&
                <polygon points={coords(selectedMarker.corners)} fill="none" stroke="#ffdd8a" strokeWidth={Math.max(3,dimensions.w/200)} pointerEvents="none"/>}
              {mode==='check'&&checkPoints.length===2&&
                <line x1={checkPoints[0].x} y1={checkPoints[0].y} x2={checkPoints[1].x} y2={checkPoints[1].y} stroke="#69e7fc"
                  strokeWidth={Math.max(3,dimensions.w/180)} pointerEvents="none"/>}
              {contour.length>1&&<polyline points={coords(contour)} fill="none" stroke="#dfff9e" strokeWidth={Math.max(3,dimensions.w/200)} pointerEvents="none"/>}
              {contour.length>=3&&<polygon points={coords(contour)} fill="#b9e398" fillOpacity=".18" stroke="#dbffb1" strokeWidth={Math.max(2,dimensions.w/240)} pointerEvents="none"/>}
              {(mode==='scale'?(calMode==='line'?refPoints:calMode==='rectangle'?quadPoints:selectedMarker?.corners||[]):mode==='check'?checkPoints:contour).map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={Math.max(5,dimensions.w/110)} fill="#ffce6e" stroke="#182925" strokeWidth={Math.max(2,dimensions.w/500)} pointerEvents="none"/>)}
            </svg>
          </div>
          <div className="editor-hint">{mode==='scale'?
            calMode==='line'?'Dodirni dvije tačke na referentnoj dužini poznate veličine.':
            calMode==='rectangle'?'Klikni 4 ugla pravougaone reference redom: gore lijevo → gore desno → dolje desno → dolje lijevo.':
            'Pronađi marker dugmetom u panelu i izaberi prepoznati ID.':
            mode==='check'?'Dodirni dvije kontrolne tačke sa poznatom nezavisnom dužinom na površini OSB-a.':
            'Dodiruj uglove redom duž oboda ostatka. Kontura se zatvara automatski.'}</div>
          {showCorrected&&correctedView&&correctedView.poly.length>=3&&
            <div className="rectified-preview" aria-label="Ispravljena vektorska kontura u mm">
              <h3>Perspektivno ispravljena vektorska kontura</h3>
              <svg viewBox={`-12 -12 ${Math.max(1,correctedView.widthMm)+24} ${Math.max(1,correctedView.heightMm)+24}`} role="img" aria-label="Kontura transformisana u milimetre">
                <polygon points={coords(correctedView.poly)} fill="#bcdcc5" stroke="#285b40" strokeWidth={Math.max(1,correctedView.widthMm/350)}/>
              </svg>
              <small>{Math.round(correctedView.widthMm)} × {Math.round(correctedView.heightMm)} mm. Ispravljena je geometrija; fotografija nije optički odizobličena.</small>
            </div>}
          {calibration&&traceValid&&<button className="secondary rectified-toggle" onClick={()=>setShowCorrected(v=>!v)}>
            {showCorrected?'Sakrij':'Prikaži'} ispravljenu 2D konturu</button>}
        </div>:null}
        {processing&&<div className="scan-progress" role="status">Dekodiranje, provjera kvaliteta i lokalno čuvanje fotografije...</div>}
        {!imageUrl&&capturedScans.length>0&&<section className="recovery-list">
          <h3>Nedovršeni snimci · sačuvani offline</h3>
          {capturedScans.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,6).map(s=>
            <button key={s.id} className="recovery-row" disabled={processing}
              onClick={()=>void resumeCaptured(s)}>
              <span>{new Date(s.createdAt).toLocaleString('sr-RS')} · {s.width} × {s.height} px</span>
              <strong>Nastavi mjerenje</strong>
            </button>)}
        </section>}
        {imageUrl&&quality&&<div className="quality-panel" aria-label="Provjera kvaliteta fotografije">
          <strong>Provjera fotografije</strong>
          {quality.notes.length>0?quality.notes.map((note,i)=><p key={i}>⚠ {note}</p>):
            <p>Nema prepoznatih očiglednih problema. Ipak ručno provjeri oštrinu, obod i mjerilo.</p>}
          <small>Indikatori su upozorenja, ne izmjerena tačnost niti automatska potvrda.</small>
        </div>}
      </div>
      <aside className="panel properties-panel">
        <h2>Parametri skeniranja</h2><p className="muted">Faza 2 · kalibracija u ravni, bez korekcije optičkog izobličenja objektiva</p>
        <div className="form-block"><FormLabel>Metoda kalibracije</FormLabel>
          <select aria-label="Metoda kalibracije" value={calMode} onChange={e=>changeCalibration(e.target.value as 'line'|'rectangle'|'marker')}>
            <option value="line">Dvije tačke · bez perspektive</option>
            <option value="rectangle">4 ugla · pravougaona referenca</option>
            <option value="marker">ArUco · automatsko prepoznavanje</option>
          </select>
        </div>
        {calMode==='line'&&<div className="form-block"><FormLabel>Poznato rastojanje dvije tačke (mm)</FormLabel>
          <input type="number" min="0.001" step="any" value={knownDistance} onChange={e=>setKnownDistance(e.target.value)}/>
          <p className="small-help">{refPoints.length}/2 tačke · {mmPerPx>0?'1 px = '+mmPerPx.toFixed(3)+' mm':'Odredi dvije tačke na fotografiji'}</p>
        </div>}
        {calMode==='rectangle'&&<div className="calibration-settings">
          <div className="form-grid">
            <div className="form-block"><FormLabel>Širina reference (mm)</FormLabel>
              <input aria-label="Širina reference" type="number" min="1" value={cardWidth} onChange={e=>setCardWidth(e.target.value)}/></div>
            <div className="form-block"><FormLabel>Visina reference (mm)</FormLabel>
              <input aria-label="Visina reference" type="number" min="1" value={cardHeight} onChange={e=>setCardHeight(e.target.value)}/></div>
          </div>
          <p className="small-help">{quadPoints.length}/4 ugla · dimenzije 210×297 mm su samo početna A4 pretpostavka; izmjeri stvarnu referencu.</p>
        </div>}
        {calMode==='marker'&&<div className="calibration-settings">
          <div className="form-grid">
            <div className="form-block"><FormLabel>Strana crnog kvadrata (mm)</FormLabel>
              <input aria-label="Strana markera" type="number" min="20" max="400" step="any"
                value={markerSize} onChange={e=>setMarkerSize(e.target.value)}/></div>
            <div className="form-block"><FormLabel>ID za štampanje</FormLabel>
              <input aria-label="ID markera" type="number" min="0" max="249" step="1" value={markerId} onChange={e=>setMarkerId(e.target.value)}/></div>
          </div>
          <button className="secondary full" onClick={()=>void downloadMarker()}>Preuzmi SVG ArUco marker za štampu</button>
          <button className="primary full" disabled={!image||detecting} onClick={()=>void findMarkers()}>
            {detecting?'Tražim markere...':'Pronađi ArUco na fotografiji'}
          </button>
          {markers.length>0&&<div className="form-block"><FormLabel>Prepoznati markeri</FormLabel>
            <select aria-label="Prepoznati markeri" value={chosenMarker??''} onChange={e=>{setChosenMarker(Number(e.target.value));setContour([]);setCheckPoints([]);}}>
              {markers.map((m,i)=><option key={i} value={m.id}>ID {m.id} · Hamming {m.hammingDistance}</option>)}
            </select>
          </div>}
          <p className="small-help">Rječnik ARUCO_MIP_36h12. Štampaj 100% (bez „fit to page”), izmjeri stvarnu stranicu crnog kvadrata, postavi marker u ravni OSB-a.</p>
        </div>}
        {calibrationState.error&&<p className="error-text">{calibrationState.error}</p>}
        {calibration?.qualityWarnings.map((msg,i)=><p key={i} className="small-help">⚠ {msg}</p>)}
        {calMode!=='line'&&<div className="form-block verification-block">
          <FormLabel>Nezavisna kontrolna dužina (mm)</FormLabel>
          <input type="number" aria-label="Kontrolna dužina" min="0.001" step="any" value={checkDistance} onChange={e=>setCheckDistance(e.target.value)}/>
          <p className="small-help">Klikni „2. Kontrola”, pa dvije tačke na fotografiji. Bez uspješne kontrole zapis se neće sačuvati.</p>
          {validation&&<p role="status" className={validation.passed?'verify-pass':'verify-fail'}>
            {validation.passed?'Kontrola: u granici':'Kontrola: odstupanje'} · {validation.measuredMm.toFixed(1)} mm · Δ {validation.errorMm.toFixed(1)} mm.
            {validation.passed?'':' Ispravi referencu ili ponovi fotografiju.'}
          </p>}
        </div>}
        <div className="divider-line"/>
        <div className="form-block"><FormLabel>Naziv ostatka</FormLabel><input placeholder="npr. OSB L-12" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="form-grid"><div className="form-block"><FormLabel>Debljina (mm)</FormLabel><input type="number" min="1" step="any" value={thickness} onChange={e=>setThickness(e.target.value)}/></div>
          <div className="form-block"><FormLabel>Lokacija</FormLabel><input value={location} onChange={e=>setLocation(e.target.value)}/></div></div>
        <div className="measurement-card">
          <div><span>Temena konture</span><strong>{contour.length}</strong></div>
          <div><span>Površina</span><strong>{traceValid?formatArea(area(polyMm)):'—'} <small>m²</small></strong></div>
          <div><span>Dimenzije obuhvata</span><strong>{polyBounds?Math.round(polyBounds.maxX)+' × '+Math.round(polyBounds.maxY):'—'} <small>mm</small></strong></div>
        </div>
        {!traceValid&&contour.length>=3&&<p className="error-text">Kontura je neispravna ili se presijeca. {transformed.error||'Poništi posljednje tačke.'}</p>}
        {extrapolation>=4&&<p className="error-text">Kontura je {extrapolation.toFixed(1)}× dalje od centra nego referentni poluprečnik. Greška jedne reference raste pri ekstrapolaciji; potvrdi dimenzije.</p>}
        {extrapolation>=12&&<p className="error-text">Prevelika ekstrapolacija (više od 12×). Premjesti ili uvećaj referencu.</p>}
        <button className="primary full" disabled={!image||!readyForSave||busy||Number(thickness)<=0} onClick={()=>void save()}>
          {busy?'Čuvanje...':<><Save size={17}/> Sačuvaj izmjereni ostatak</>}</button>
        {captureError&&<p role="alert" className="error-text">{captureError}</p>}
        <div className="safety-note"><ShieldAlert size={17}/><p>Projektivna kalibracija pretpostavlja da su referenca i OSB obod <strong>u istoj ravni</strong>.
          Nema korekcije distorzije objektiva niti garancije tačnosti. Zapis je samo <strong>IZMJEREN</strong> — nikada automatski CNC verifikovan.</p></div>
      </aside>
    </div>
  </>;
}
function Inventory({remnants,onNavigate}:{remnants:Remnant[];onNavigate:(p:Page)=>void}){
  const [query,setQuery]=useState(''),[thickness,setThickness]=useState('all');
  const filtered=remnants.filter(r=>(r.label+' '+r.id+' '+r.location).toLowerCase().includes(query.toLowerCase())&&
    (thickness==='all'||String(r.thicknessMm)===thickness));
  return <>
    <Header title="Inventar ostataka" subtitle="Svi zapisi ostaju u IndexedDB ovog uređaja."
      action={<button className="primary header-action" onClick={()=>onNavigate('scan')}><Plus size={17}/> Novi ostatak</button>}/>
    <div className="panel card-padding"><div className="filter-row">
      <div className="search-box"><Search size={18}/><input aria-label="Pretraži inventar" placeholder="Pretraži naziv, ID ili lokaciju..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <select aria-label="Debljina materijala" value={thickness} onChange={e=>setThickness(e.target.value)}>
        <option value="all">Sve debljine</option>{[...new Set(remnants.map(r=>r.thicknessMm))].map(n=><option value={n} key={n}>{n} mm</option>)}
      </select></div>
      {filtered.length===0?<div className="empty-state"><Package size={36}/><h3>Nema odgovarajućih ostataka</h3><p>Unesi fotografiju i sačuvaj vektorsku konturu.</p></div>:
        <div className="inventory-list">{filtered.map(r=>{
          const b=box(r.polygonMm);
          return <div className="inventory-row" key={r.id}>
            <PhotoThumbnail imageId={r.imageId}/><div className="inventory-main"><strong>{r.label}</strong>
              <small>{r.location} · {new Date(r.createdAt).toLocaleDateString('sr-RS')}</small></div>
            <span className="pill">OSB {r.thicknessMm} mm</span>
            <span className="inventory-size">{Math.round(b.maxX-b.minX)} × {Math.round(b.maxY-b.minY)} mm</span>
            <span className="inventory-area">{formatArea(r.areaMm2)} m²</span>
            <span className="status-pill">Izmjereno</span>
          </div>
        })}</div>}
    </div><Notice>Za proizvodnju je potrebna nezavisna fizička provjera; zapisi nisu automatski dostupni kao odobreni materijal.</Notice>
  </>;
}
function Nesting({remnants}:{remnants:Remnant[]}){
  const [selected,setSelected]=useState(''),[width,setWidth]=useState('120'),[height,setHeight]=useState('80');
  const [count,setCount]=useState('3'),[gap,setGap]=useState('8'),[step,setStep]=useState('10');
  const [rotate,setRotate]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [result,setResult]=useState<NestingResult|null>(null);
  const stock=remnants.find(r=>r.id===(selected||remnants[0]?.id));
  function run(){
    if(!stock)return;
    setBusy(true);setError('');setResult(null);
    const input:SolveInput={stock,widthMm:Number(width),heightMm:Number(height),quantity:Number(count),
      clearanceMm:Number(gap),stepMm:Number(step),allowRotation:rotate};
    const worker=new Worker(new URL('./workers/nesting.worker.ts',import.meta.url),{type:'module'});
    worker.onmessage=(e:MessageEvent<{ok:boolean;value?:NestingResult;error?:string}>)=>{
      setBusy(false);worker.terminate();
      if(e.data.ok&&e.data.value)setResult(e.data.value);else setError(e.data.error||'Greška proračuna');
    };
    worker.onerror=()=>{setBusy(false);setError('Web Worker nije uspio.');worker.terminate()};
    worker.postMessage(input);
  }
  const b=stock?box(stock.polygonMm):null;
  const changed=()=>{setResult(null);setError('')};
  const used=result?.placements.reduce((s,p)=>s+area(p.polygonMm),0)||0;
  return <>
    <Header title="Nesting Studio" subtitle="Eksperimentalni pregled rasporeda u stvarnoj nepravilnoj konturi."/>
    <div className="nesting-layout">
      <div className="panel card-padding">
        <h2>Materijal i dio</h2><p className="muted">Deterministička pretraga pozicija · 2D preview</p>
        <div className="form-block"><FormLabel>Ostatak iz inventara</FormLabel><select value={stock?.id||''} onChange={e=>{setSelected(e.target.value);changed()}}>
          {!stock&&<option value="">Nema ostataka</option>}
          {remnants.map(r=><option key={r.id} value={r.id}>{r.label} · {r.thicknessMm} mm</option>)}</select></div>
        <div className="form-grid"><div className="form-block"><FormLabel>Širina dijela (mm)</FormLabel><input type="number" min="1" value={width} onChange={e=>{setWidth(e.target.value);changed()}}/></div>
          <div className="form-block"><FormLabel>Visina dijela (mm)</FormLabel><input type="number" min="1" value={height} onChange={e=>{setHeight(e.target.value);changed()}}/></div>
          <div className="form-block"><FormLabel>Količina</FormLabel><input type="number" min="1" max="40" value={count} onChange={e=>{setCount(e.target.value);changed()}}/></div>
          <div className="form-block"><FormLabel>Razmak (mm)</FormLabel><input type="number" min="0" step="0.5" value={gap} onChange={e=>{setGap(e.target.value);changed()}}/></div>
          <div className="form-block"><FormLabel>Korak pretrage (mm)</FormLabel><input type="number" min="1" value={step} onChange={e=>{setStep(e.target.value);changed()}}/></div>
        </div>
        <label className="check-row"><input type="checkbox" checked={rotate} onChange={e=>{setRotate(e.target.checked);changed()}}/> Dozvoli rotaciju 90°</label>
        <button className="primary full" onClick={run} disabled={!stock||busy}>{busy?'Računanje...':<><Play size={17}/> Izračunaj raspored</>}</button>
        {error&&<p className="error-text">{error}</p>}
        {result&&<div className="results"><h3>Rezultat proračuna</h3>
          <div><span>Postavljeno</span><strong>{result.placements.length} / {result.placements.length+result.unplaced.length}</strong></div>
          <div><span>Površina dijelova</span><strong>{formatArea(used)} m²</strong></div>
          <div><span>Provjera geometrije</span><strong>{result.valid?'Prošla':'NIJE PROŠLA'}</strong></div>
          <div><span>Testirane pozicije</span><strong>{result.checkedCandidates.toLocaleString('sr-RS')}</strong></div>
          <div className="divider-line"/>
          <button className="secondary full" disabled={!result.valid} onClick={()=>stock&&downloadText(referenceDxf(stock,result),stock.label.replace(/[^a-zA-Z0-9-]/g,'_')+'-REFERENCE.dxf','application/dxf')}><Download size={16}/> Preuzmi referentni DXF</button>
          <button className="secondary full" onClick={()=>downloadText(JSON.stringify({stock,result},null,2),'osb-layout.json','application/json')}><Download size={16}/> JSON plan</button>
          </div>}
      </div>
      <div className="panel nesting-board"><div className="board-top"><div><h2>2D raspored</h2><p>Geometrija u mm · bez generisanja putanja</p></div>
        <span className="tag">REFERENCE ONLY</span></div>
        {!stock||!b?<div className="empty-state"><Layers3/><h3>Unesi ostatak u inventar</h3></div>:
          <svg className="nest-svg" viewBox={(b.minX-30)+' '+(b.minY-30)+' '+(b.maxX-b.minX+60)+' '+(b.maxY-b.minY+60)}>
            <defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#cbd3c7"/></pattern></defs>
            <rect x={b.minX-30} y={b.minY-30} width={b.maxX-b.minX+60} height={b.maxY-b.minY+60} fill="url(#dots)"/>
            <polygon points={coords(stock.polygonMm)} fill="#c7ddae" stroke="#345b3b" strokeWidth="2"/>
            {stock.holesMm.map((p,i)=><polygon key={i} points={coords(p)} fill="#fff" stroke="#b85448" strokeWidth="2"/>)}
            {result?.placements.map((p,i)=><g key={i}>
              <polygon points={coords(p.polygonMm)} fill={['#a6cdd1','#f0bc7a','#bcbaec','#d8a6b8'][i%4]} stroke="#23433b" strokeWidth="1"/>
              <text x={p.x+Math.min(Number(width),Number(height))/2} y={p.y+Math.min(Number(width),Number(height))/2} fontSize="13" fill="#233a32" textAnchor="middle">P{i+1}</text>
            </g>)}
          </svg>}
        <div className="board-footer"><span><span className="legend-dot green"/> OSB kontura</span><span><span className="legend-dot blue"/> Dijelovi</span><span>Mjere u milimetrima</span></div>
        <Notice>Ovo nije industrijski optimizator: trenutno podržava samo pravougaone dijelove u jednom nepravilnom ostatku, bez uređenih rupa, fiksiranja ili Cut2D provjere.</Notice>
      </div>
    </div>
  </>;
}
function Planned({title,description,items}:{title:string;description:string;items:string[]}){
  return <><Header title={title} subtitle={description}/><div className="panel planned-panel">
    <div className="planned-icon"><HardDrive size={28}/></div><h2>U planu narednih faza</h2>
    <p>Ovaj modul još nije aktivan. Nijedno dugme ne simulira gotovu proizvodnu funkciju.</p>
    <div className="planned-list">{items.map(i=><div key={i}><CheckCircle2 size={16}/>{i}</div>)}</div></div></>;
}
function Analytics({remnants}:{remnants:Remnant[]}){
  const total=remnants.reduce((s,r)=>s+r.areaMm2,0);
  return <><Header title="Analitika" subtitle="Samo direktno evidenirana geometrija, bez izmišljenih ušteda."/>
    <div className="metrics"><Metric title="Broj zapisa" value={String(remnants.length)} Icon={Box}/>
      <Metric title="Izmjerena površina" value={formatArea(total)} unit="m²" Icon={Grid2x2}/>
      <Metric title="Potvrđene uštede" value="—" Icon={Activity}/></div>
    <Notice>Ušteda materijala se ne može izračunati dok operater ne potvrdi fizički izveden rez i stvarne troškove.</Notice></>;
}
function SettingsPage(){
  return <Planned title="Podešavanja" description="Lokalna konfiguracija, kopije i profili mjerenja."
    items={['Kalibraciona tabla sa tačno definisanim razmjerama','Backup izvornog materijala i geometrije','Profili mašina i materijala','Opciona sinhronizacija više uređaja']}/>;
}
export default function App(){
  const [page,setPage]=useState<Page>('dashboard'),[menu,setMenu]=useState(false);
  const remnants=useLiveQuery(()=>db.remnants.toArray(),[])||[];
  useEffect(()=>{const f=()=>{if(location.hash.slice(1)!==page)location.hash=page};
    f();},[page]);
  function go(p:Page){setPage(p);setMenu(false);window.scrollTo({top:0,behavior:'instant'})}
  return <div className="app-shell">
    <aside className={'sidebar '+(menu?'open':'')}>
      <div className="brand"><div className="brand-symbol"><Layers3 size={23}/></div><div>
        <strong>meditera<span className="brand-point">.</span></strong><small>WORKSHOP SYSTEMS</small></div></div>
      <div className="nav-caption">RADNI PROSTOR</div>
      <nav>{pages.map(({id,title,Icon})=><button key={id} className={'nav-item '+(page===id?'selected':'')} onClick={()=>go(id)}><Icon size={20}/><span>{title}</span>{page===id&&<span className="nav-mark"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="offline-icon"><WifiOff size={18}/></div><div><strong>Local-first</strong><small>Podaci ostaju na uređaju</small></div></div>
    </aside>
    {menu&&<button aria-label="Zatvori meni" className="menu-backdrop" onClick={()=>setMenu(false)}/>}
    <div className="main-area">
      <div className="topbar"><button className="menu-toggle" aria-label="Otvori meni" onClick={()=>setMenu(!menu)}><Menu size={21}/></button>
        <div className="breadcrumb">MEDITERA <ChevronRight size={13}/> OSB REUSE LAB <ChevronRight size={13}/> <strong>{pages.find(p=>p.id===page)?.title}</strong></div>
        <span className="version-pill">FAZA 1 · PILOT</span></div>
      <main className="main-content">
        {page==='dashboard'&&<Dashboard remnants={remnants} onNavigate={go}/>}
        {page==='scan'&&<Scan onSaved={()=>go('inventory')}/>}
        {page==='inventory'&&<Inventory remnants={remnants} onNavigate={go}/>}
        {page==='nesting'&&<Nesting remnants={remnants}/>}
        {page==='production'&&<Planned title="Proizvodnja" description="Priprema radnih naloga i stvarna evidencija reza." items={['Povezivanje odobrenih ostataka i radnih naloga','Fizička provjera stezanja i koordinatnog početka','Potvrda izvršenog rezanja i preostalih ostataka','Potvrđen Cut2D DXF workflow']}/>}
        {page==='analytics'&&<Analytics remnants={remnants}/>}
        {page==='settings'&&<SettingsPage/>}
      </main>
    </div>
    <nav className="mobile-nav">{pages.filter(p=>['scan','inventory','nesting','production'].includes(p.id)).map(({id,title,Icon})=>
      <button key={id} className={page===id?'selected':''} onClick={()=>go(id)}><Icon size={21}/><small>{title}</small></button>)}</nav>
  </div>;
}