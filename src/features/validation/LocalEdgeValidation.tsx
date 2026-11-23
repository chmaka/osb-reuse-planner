import {useMemo,useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {Download,Save,AlertTriangle} from 'lucide-react';
import {db,recordEdgeCheck} from '../../db';
import {downloadText} from '../../dxf';
import {box} from '../../geometry';
import type {EdgeCheck,Point,Polygon,Remnant} from '../../types';
import {checkEdgeLength,exportEdgeChecksCsv,getRing,measuredSpan,summarizeEdgeChecks} from './edge-check';

type PickedRing={key:string;kind:EdgeCheck['ringKind'];index:number;title:string};
function ringOptions(remnant?:Remnant):PickedRing[]{
 if(!remnant)return [];
 return [
  {key:'outer:0',kind:'outer',index:0,title:'Spoljašnja kontura'},
  ...remnant.holesMm.map((_,i)=>({key:'hole:'+i,kind:'hole' as const,index:i,title:'Otvor '+(i+1)})),
  ...remnant.defectsMm.map((_,i)=>({key:'defect:'+i,kind:'defect' as const,index:i,title:'Oštećenje '+(i+1)}))
 ];
}
function svgPoints(points:Polygon){return points.map(p=>p.x+','+p.y).join(' ')}
function ContourSpanPreview({remnant,ring,fromVertex,toVertex,onPick}:{
 remnant:Remnant;ring:Polygon;fromVertex:number;toVertex:number;onPick:(index:number)=>void
}){
 const bounds=box(remnant.polygonMm);
 const side=Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY);
 const pad=Math.max(15,side*.075);
 const radius=Math.max(3,side*.018);
 const a=ring[fromVertex],b=ring[toVertex];
 const cx=bounds.minX-pad,cy=bounds.minY-pad;
 return <svg className="edge-preview" role="img" aria-label="Vektorski obod za izbor temena"
   viewBox={cx+' '+cy+' '+(bounds.maxX-bounds.minX+pad*2)+' '+(bounds.maxY-bounds.minY+pad*2)}>
   <polygon points={svgPoints(remnant.polygonMm)} fill="#d9e8c9" stroke="#41654b" strokeWidth={Math.max(1,side*.004)}/>
   {remnant.holesMm.map((p,i)=><polygon key={'h'+i} points={svgPoints(p)} fill="#fff"
     stroke="#bd6b43" strokeWidth={Math.max(1,side*.004)}/>)}
   {remnant.defectsMm.map((p,i)=><polygon key={'d'+i} points={svgPoints(p)} fill="#e5bcb6"
     stroke="#a34747" strokeWidth={Math.max(1,side*.004)}/>)}
   <polygon points={svgPoints(ring)} fill="none" stroke="#326897" strokeWidth={Math.max(1,side*.005)}
     strokeDasharray={side*.01+' '+side*.009}/>
   {a&&b&&<line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
     stroke="#d36619" strokeWidth={Math.max(2,side*.005)}/>}
   {ring.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={radius}
      fill={i===fromVertex?'#207e63':i===toVertex?'#d36619':'rgba(255,255,255,.78)'}
      stroke={i===fromVertex||i===toVertex?'#143e31':'#5b788a'}
      strokeWidth={Math.max(1,side*.002)}
      onClick={()=>onPick(i)}>
      <title>{'Teme '+i+'; dodirni za izbor'}</title>
     </circle>)}
   {[{p:a,label:'A'},{p:b,label:'B'}].filter((v):v is {p:Point;label:string}=>!!v.p)
     .map(v=><text key={v.label} x={v.p.x+radius*1.3} y={v.p.y-radius*1.3}
       fontSize={radius*1.7} fontWeight="bold" fill="#173a38">{v.label}</text>)}
 </svg>;
}
export default function LocalEdgeValidation({remnant}:{remnant?:Remnant}){
 const checks=useLiveQuery(()=>db.edgeChecks.orderBy('at').reverse().toArray(),[])||[];
 const [ringKey,setRingKey]=useState('outer:0');
 const [fromVertex,setFromVertex]=useState(0),[toVertex,setToVertex]=useState(1);
 const [nextPoint,setNextPoint]=useState<'from'|'to'>('from');
 const [physical,setPhysical]=useState(''),[threshold,setThreshold]=useState('5');
 const [instrument,setInstrument]=useState('Ručni metar'),[notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const rings=useMemo(()=>ringOptions(remnant),[remnant]);
 const selected=rings.find(x=>x.key===ringKey)||rings[0];
 const ring=remnant&&selected?getRing(remnant,selected.kind,selected.index):[];
 const span=useMemo(()=>{
   if(!remnant||!selected)return null;
   try{return measuredSpan(remnant,selected.kind,selected.index,fromVertex,toVertex)}
   catch{return null}
 },[remnant,selected,fromVertex,toVertex]);
 const stats=useMemo(()=>summarizeEdgeChecks(checks),[checks]);
 const number=(v:number|null)=>v===null?'Nema podataka':v.toFixed(2)+' mm';
 const actual=physical.trim()===''?NaN:Number(physical);
 const tol=threshold.trim()===''?NaN:Number(threshold);
 const ready=span&&Number.isFinite(actual)&&actual>0&&actual<=50000&&
   Number.isFinite(tol)&&tol>=0&&tol<=1000&&instrument.trim().length>0;
 function changeRing(key:string){
   setRingKey(key);setFromVertex(0);setToVertex(1);setNextPoint('from');
   setPhysical('');setError('');setSuccess('');
 }
 function pickPoint(index:number){
   if(nextPoint==='from'){setFromVertex(index);setNextPoint('to');}
   else {setToVertex(index);setNextPoint('from');}
   setError('');setSuccess('');
 }
 async function save(){
   if(!ready||!remnant||!selected||busy)return;
   setBusy(true);setError('');setSuccess('');
   try{
     const record=await recordEdgeCheck({
       remnantId:remnant.id,ringKind:selected.kind,ringIndex:selected.index,
       fromVertex,toVertex,physicalMm:actual,toleranceMm:tol,
       referenceMethod:instrument,notes
     });
     const result=checkEdgeLength(record);
     setSuccess('Zabilježena dužina: digitalno '+record.scannedMm.toFixed(2)+
       ' mm, fizički '+record.physicalMm.toFixed(2)+' mm, odstupanje '+result.signedMm.toFixed(2)+
       ' mm. Ovo nije CNC odobrenje.');
     setPhysical('');setNotes('');
   }catch(e){setError(String(e))}
   finally{setBusy(false)}
 }
 const visible=checks.filter(c=>!remnant||c.remnantId===remnant.id);
 function exportJson(){
   downloadText(JSON.stringify({
     schema:'meditera-osb-local-edge-checks-v1',at:new Date().toISOString(),
     scope:'physical vertex-to-vertex line checks, not local contour edge displacement or CNC approval',
     stats,checks
   },null,2),'meditera-osb-local-edge-checks.json','application/json');
 }
 return <section className="panel card-padding edge-check-workflow" aria-label="Lokalna provjera konture">
  <div className="edge-intro">
    <h2>Kontrolne dužine — nepravilne ivice i otvori</h2>
    <p className="muted">Izaberi dva prepoznatljiva temena na <strong>spoljašnjem obodu, otvoru ili oštećenju</strong>,
      fizički izmjeri rastojanje između istih tačaka i uporedi ga sa digitalnom konturom.
      To je dodatna kontrola uz spoljašnju širinu/visinu, ne mjerenje svake nepravilnosti ruba.</p>
  </div>
  <div className="pilot-layout edge-layout">
   <div className="edge-inputs">
     <div className="form-block">
       <label htmlFor="edge-ring" className="form-label">Kontura za kontrolu</label>
       <select id="edge-ring" aria-label="Kontura za kontrolu" disabled={!remnant}
         value={selected?.key||''} onChange={e=>changeRing(e.target.value)}>
         {!remnant&&<option value="">Nema ostatka</option>}
         {rings.map(r=><option key={r.key} value={r.key}>{r.title}</option>)}
       </select>
     </div>
     <div className="form-grid">
       <div className="form-block"><label className="form-label" htmlFor="edge-from">Teme A (indeks)</label>
         <select id="edge-from" disabled={!remnant} value={fromVertex} onChange={e=>setFromVertex(Number(e.target.value))}>
           {ring.map((_,i)=><option key={i} value={i}>{'Teme '+i}</option>)}
         </select></div>
       <div className="form-block"><label className="form-label" htmlFor="edge-to">Teme B (indeks)</label>
         <select id="edge-to" disabled={!remnant} value={toVertex} onChange={e=>setToVertex(Number(e.target.value))}>
           {ring.map((_,i)=><option key={i} value={i}>{'Teme '+i}</option>)}
         </select></div>
     </div>
     <p className="small-help">Na crtežu dodirni tačku za A, zatim B; dalje se odabir smjenjuje. Ako kontura ima mnogo sitnih temena, koristi liste iznad. Odaberi samo dvije fizički prepoznatljive i mjerljive tačke.</p>
     <div className="auto-measurements">
       <strong>Rastojanje iz digitalne konture</strong>
       <div><span>A → B, direktna dužina</span><strong>{span?span.scannedMm.toFixed(2)+' mm':'Izaberi dva različita temena'}</strong></div>
       <small>Za zakrivljenu ili stepenastu ivicu ovo je prava linija između krajnjih tačaka, a ne dužina po konturi.</small>
     </div>
     <div className="form-grid">
       <div className="form-block"><label htmlFor="edge-actual" className="form-label">Fizička kontrolna dužina (mm)</label>
         <input id="edge-actual" type="number" min="0.1" max="50000" step="any" value={physical}
           onChange={e=>setPhysical(e.target.value)} placeholder="npr. 200"/></div>
       <div className="form-block"><label htmlFor="edge-tolerance" className="form-label">Interni prag (mm)</label>
         <input id="edge-tolerance" type="number" min="0" max="1000" step=".5" value={threshold}
           onChange={e=>setThreshold(e.target.value)}/></div>
     </div>
     <div className="form-block"><label htmlFor="edge-instrument" className="form-label">Nezavisni instrument</label>
       <select id="edge-instrument" value={instrument} onChange={e=>setInstrument(e.target.value)}>
         <option>Ručni metar</option><option>Šubler</option><option>Laser + kontrola</option><option>Drugo (opis u napomeni)</option>
       </select></div>
     <div className="form-block"><label htmlFor="edge-notes" className="form-label">Napomena o uglu, otvoru ili oštećenju</label>
       <textarea id="edge-notes" rows={2} maxLength={1000} value={notes}
         onChange={e=>setNotes(e.target.value)} placeholder="npr. unutrašnji ugao usjeka; dvije jasno označene tačke"/></div>
     <button className="primary full" disabled={!ready||busy} onClick={()=>void save()}>
       <Save size={16}/>{busy?'Upisivanje...':'Sačuvaj kontrolnu dužinu'}</button>
     {error&&<p role="alert" className="error-text">{error}</p>}
     {success&&<p role="status" className="pilot-success">{success}</p>}
   </div>
   <div className="edge-preview-column">
     {remnant&&ring.length>=3?<ContourSpanPreview remnant={remnant} ring={ring}
       fromVertex={fromVertex} toVertex={toVertex} onPick={pickPoint}/>:
       <p className="muted">Sačuvaj digitalnu konturu u inventaru da bi se prikazala.</p>}
     <div className="edge-legend"><span><b>A</b> početna tačka</span><span><b>B</b> završna tačka</span></div>
     <div className="pilot-stats-table">
       <div><span>Zabilježene kontrolne dužine</span><strong>{stats.count}</strong></div>
       <div><span>OSB ostataka sa dužinama</span><strong>{stats.distinctRemnants}</strong></div>
       <div><span>MAE lokalnih dužina</span><strong>{number(stats.meanAbsoluteErrorMm)}</strong></div>
       <div><span>P95 lokalnih dužina</span><strong>{number(stats.p95Mm)}</strong></div>
       <div><span>Preko internog praga</span><strong>{stats.exceedingTolerance}</strong></div>
     </div>
     <div className="pilot-export-actions">
       <button className="secondary" disabled={!checks.length}
         onClick={()=>downloadText(exportEdgeChecksCsv(checks),'meditera-osb-local-edge-checks.csv','text/csv;charset=utf-8')}>
         <Download size={16}/> CSV dužine</button>
       <button className="secondary" disabled={!checks.length} onClick={exportJson}>
         <Download size={16}/> JSON dužine</button>
     </div>
   </div>
  </div>
  <h3>Sačuvane lokalne kontrole{remnant?' za '+remnant.label:''}</h3>
  {visible.length?<div className="edge-history">{visible.slice(0,30).map(c=>{
    const e=checkEdgeLength(c);
    return <article className="pilot-trial" key={c.id}>
      <div className="pilot-trial-heading">
       <strong>{c.ringKind==='outer'?'Spoljašnja kontura':c.ringKind==='hole'?'Otvor':'Oštećenje'} {c.ringIndex+1}: teme {c.fromVertex} → {c.toVertex}</strong>
       <span className={e.withinTolerance?'pilot-pass':'pilot-fail'}>
         {e.withinTolerance?'U internom pragu':'Prekoračen prag'}</span>
      </div>
      <small>{new Date(c.at).toLocaleString('sr-RS')} · revizija {c.remnantRevision} · {c.referenceMethod}</small>
      <div className="pilot-stats-table">
        <div><span>Digitalno / fizički</span><strong>{c.scannedMm.toFixed(2)} / {c.physicalMm.toFixed(2)} mm</strong></div>
        <div><span>Odstupanje</span><strong>{e.signedMm.toFixed(2)} mm</strong></div>
      </div>
      {c.notes&&<p>{c.notes}</p>}
    </article>;
  })}</div>:<p className="muted">Nema unesenih lokalnih kontrolnih dužina.</p>}
  <div className="safety-note"><AlertTriangle size={17}/>
    <p>Kontrola rastojanja između dvije označene tačke ne potvrđuje profil čitavog ruba,
      radijuse, mikrooštećenja, širinu reza ni poziciju stezanja. Geometrija ostaje samo <strong>MEASURED</strong>.
      Za CNC je potrebna zasebna fizička i tehnološka provjera.</p></div>
 </section>;
}
