import {useMemo,useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {Activity,Download,ClipboardCheck,AlertTriangle,Save} from 'lucide-react';
import {db,recordValidation} from '../../db';
import {downloadText} from '../../dxf';
import type {Remnant} from '../../types';
import {evaluateTrial,exportPilotCsv,predictedBounds,summarizePilot} from './metrics';

/** Physical pilot log: scanned values are immutable snapshots of a saved outline,
 * and actual values must be measured separately by the workshop operator.
 */
export default function PilotValidation({remnants}:{remnants:Remnant[]}){
 const trials=useLiveQuery(()=>db.validation.orderBy('at').reverse().toArray(),[])||[];
 const [selected,setSelected]=useState('');
 const remnant=remnants.find(r=>r.id===(selected||remnants[0]?.id));
 const [width,setWidth]=useState(''),[height,setHeight]=useState('');
 const [tolerance,setTolerance]=useState('5');
 const [device,setDevice]=useState('Android telefon');
 const [lighting,setLighting]=useState('Dnevno svjetlo');
 const [referenceMethod,setReferenceMethod]=useState('Ručni metar');
 const [notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const summary=useMemo(()=>summarizePilot(trials),[trials]);
 const predicted=useMemo(()=>{
   if(!remnant)return null;
   try{return predictedBounds(remnant)}catch{return null}
 },[remnant]);
 const number=(n:number|null)=>n===null?'Nema podataka':n.toFixed(2)+' mm';
 const readiness=remnant&&predicted&&Number.isFinite(Number(width))&&Number(width)>0&&
   Number.isFinite(Number(height))&&Number(height)>0&&Number.isFinite(Number(tolerance))&&
   Number(tolerance)>=0&&Number(tolerance)<=1000&&referenceMethod.trim().length>0;
 async function submit(){
   if(!remnant||!readiness||busy)return;
   setBusy(true);setError('');setSuccess('');
   try{
     const trial=await recordValidation({
       remnantId:remnant.id,actualWidthMm:Number(width),actualHeightMm:Number(height),
       toleranceMm:Number(tolerance),device,lighting,referenceMethod,notes
     });
     const e=evaluateTrial(trial);
     setSuccess('Kontrola sačuvana: odstupanja '+e.deltaWidthMm.toFixed(1)+' mm širine i '+
       e.deltaHeightMm.toFixed(1)+' mm visine. Ostatak nije automatski odobren za CNC.');
     setWidth('');setHeight('');setNotes('');
   }catch(e){setError(String(e))}
   finally{setBusy(false)}
 }
 function exportCsv(){
   downloadText(exportPilotCsv(trials),'meditera-osb-pilot-physical-checks.csv','text/csv;charset=utf-8');
 }
 function exportJson(){
   downloadText(JSON.stringify({schema:'meditera-osb-pilot-validation-v1',createdAt:new Date().toISOString(),
     note:'All actualWidthMm/actualHeightMm entries are operator-provided independent physical measurements.',
     stats:summary,trials},null,2),'meditera-osb-pilot-physical-checks.json','application/json');
 }
 return <div className="pilot-page">
   <header className="page-header">
     <div><div className="eyebrow">MEDITERA / OSB REUSE LAB</div>
       <h1>Fizička validacija</h1>
       <p>Radionička provjera automatskih mjera, po stvarnom OSB ostatku i nezavisnim mjerenjima.</p></div>
   </header>
   <div className="pilot-metrics">
     <div className="metric"><div className="metric-top"><span>Različitih ostataka u pilotu</span><ClipboardCheck size={18}/></div>
       <div className="metric-value">{summary.uniqueRemnants}<small>/ {summary.targetRemnants}</small></div></div>
     <div className="metric"><div className="metric-top"><span>Broj fizičkih kontrola</span><Activity size={18}/></div>
       <div className="metric-value">{summary.trials}</div></div>
     <div className="metric"><div className="metric-top"><span>MAE, širina + visina</span><Activity size={18}/></div>
       <div className="metric-value pilot-value">{number(summary.meanAbsoluteErrorMm)}</div></div>
     <div className="metric"><div className="metric-top"><span>P95 apsolutne greške</span><Activity size={18}/></div>
       <div className="metric-value pilot-value">{number(summary.p95AbsoluteErrorMm)}</div></div>
   </div>
   <div className="pilot-layout">
     <section className="panel card-padding pilot-entry">
       <h2>Dodaj fizičku kontrolu</h2>
       <p className="muted">Potrebno je fizički izmjeriti spoljašnji obuhvat ploče. Unesi realne dimenzije, a aplikacija će sama uporediti sa sačuvanom vektorskom konturom.</p>
       <div className="form-block"><label className="form-label" htmlFor="pilot-stock">Ostatak iz inventara</label>
         <select id="pilot-stock" aria-label="Ostatak za provjeru" value={remnant?.id||''} onChange={e=>{
           setSelected(e.target.value);setWidth('');setHeight('');setError('');setSuccess('');
         }}>
           {!remnant&&<option value="">Nema izmjerenih ostataka</option>}
           {remnants.map(r=><option value={r.id} key={r.id}>{r.label} · {r.thicknessMm} mm</option>)}
         </select></div>
       {predicted&&<div className="auto-measurements">
         <strong>Iz prethodnog skeniranja</strong>
         <div><span>Digitalna širina</span><strong>{predicted.widthMm.toFixed(1)} mm</strong></div>
         <div><span>Digitalna visina</span><strong>{predicted.heightMm.toFixed(1)} mm</strong></div>
         <small>Raster obuhvata originalne konture; ovo nisu nezavisna fizička mjerenja.</small>
       </div>}
       <div className="form-grid">
         <div className="form-block"><label className="form-label" htmlFor="pilot-width">Fizička širina (mm)</label>
           <input id="pilot-width" type="number" min="0.1" max="50000" step="any"
             placeholder="npr. 1200" value={width} onChange={e=>setWidth(e.target.value)}/></div>
         <div className="form-block"><label className="form-label" htmlFor="pilot-height">Fizička visina (mm)</label>
           <input id="pilot-height" type="number" min="0.1" max="50000" step="any"
             placeholder="npr. 600" value={height} onChange={e=>setHeight(e.target.value)}/></div>
         <div className="form-block"><label className="form-label" htmlFor="pilot-tolerance">Interni prag upozorenja (mm)</label>
           <input id="pilot-tolerance" type="number" min="0" max="1000" step=".5"
             value={tolerance} onChange={e=>setTolerance(e.target.value)}/></div>
         <div className="form-block"><label className="form-label" htmlFor="pilot-reference">Nezavisni instrument</label>
           <select id="pilot-reference" value={referenceMethod} onChange={e=>setReferenceMethod(e.target.value)}>
             <option>Ručni metar</option><option>Šubler</option><option>Laser + kontrola</option><option>Drugo (opis u napomeni)</option>
           </select></div>
         <div className="form-block"><label className="form-label" htmlFor="pilot-device">Uređaj za fotografisanje</label>
           <input id="pilot-device" value={device} onChange={e=>setDevice(e.target.value)} maxLength={100}/></div>
         <div className="form-block"><label className="form-label" htmlFor="pilot-lighting">Osvjetljenje</label>
           <select id="pilot-lighting" value={lighting} onChange={e=>setLighting(e.target.value)}>
             <option>Dnevno svjetlo</option><option>LED rasvjeta</option><option>Slabije svjetlo</option>
             <option>Odsjaj / kontrastne sjenke</option><option>Drugo (opis u napomeni)</option>
           </select></div>
       </div>
       <div className="form-block"><label className="form-label" htmlFor="pilot-notes">Napomene o podlozi, uglu, ivicama</label>
         <textarea id="pilot-notes" rows={3} maxLength={1000} value={notes}
           placeholder="npr. tamna podloga, okrnjen ugao, marker 80 mm, kosa fotografija"
           onChange={e=>setNotes(e.target.value)}/></div>
       <button className="primary full" disabled={!readiness||busy} onClick={()=>void submit()}>
         <Save size={16}/>{busy?'Upisivanje...':'Sačuvaj fizičku kontrolu'}</button>
       {error&&<p className="error-text" role="alert">{error}</p>}
       {success&&<p role="status" className="pilot-success">{success}</p>}
       <p className="small-help">Prag od {tolerance||'—'} mm je radioničko podešavanje za pilot, a ne garantovana tolerancija ili CNC odobrenje. Više ponovljenih kontrola istog ostatka broji se kao jedan uzorak prema cilju od 20.</p>
     </section>
     <section className="panel card-padding pilot-results">
       <h2>Rezultati pilota</h2>
       <div className="pilot-stats-table">
         <div><span>Ukupno nezavisnih vrijednosti</span><strong>{summary.readings}</strong></div>
         <div><span>RMSE</span><strong>{number(summary.rmseMm)}</strong></div>
         <div><span>Najveća apsolutna greška</span><strong>{number(summary.maxErrorMm)}</strong></div>
         <div><span>Unutar zadatog praga</span><strong>{summary.withinTolerance} / {summary.trials}</strong></div>
         <div><span>Sa većim odstupanjem</span><strong>{summary.failedTolerance}</strong></div>
       </div>
       {summary.uniqueRemnants<summary.targetRemnants&&<div className="pilot-caution">
         <AlertTriangle size={18}/><p>Preostalo je <strong>{summary.remainingRemnants} različitih OSB ostataka</strong> za predloženi pilot.
           Nije moguće zaključiti stvarnu proizvodnu tačnost samo iz softverskih testova.</p>
       </div>}
       <h3>Prema načinu segmentacije</h3>
       {summary.byMethod.length?<div className="pilot-groups">{summary.byMethod.map(m=><div key={m.method}>
         <strong>{m.method}</strong>
         <span>{m.count} kontrola · MAE {m.meanAbsoluteErrorMm.toFixed(2)} mm · P95 {m.p95AbsoluteErrorMm.toFixed(2)} mm</span>
       </div>)}</div>:<p className="muted">Još nema fizičkih rezultata.</p>}
       <div className="pilot-export-actions">
         <button className="secondary" disabled={!trials.length} onClick={exportCsv}><Download size={16}/> CSV rezultati</button>
         <button className="secondary" disabled={!trials.length} onClick={exportJson}><Download size={16}/> JSON rezultati</button>
       </div>
       <h3>Sačuvane provjere</h3>
       {trials.length?<div className="pilot-entries">{trials.map(t=>{
         const e=evaluateTrial(t);
         return <article key={t.id} className="pilot-trial">
           <div className="pilot-trial-heading"><strong>{t.remnantLabel}</strong>
             <span className={e.withinTolerance?'pilot-pass':'pilot-fail'}>
               {e.withinTolerance?'Unutar internog praga':'Odstupanje iznad praga'}
             </span></div>
           <small>{new Date(t.at).toLocaleString('sr-RS')} · {t.device} · {t.lighting}</small>
           <div className="pilot-stats-table">
             <div><span>Širina: digitalno / fizički</span><strong>{t.predictedWidthMm.toFixed(1)} / {t.actualWidthMm.toFixed(1)} mm</strong></div>
             <div><span>Greška širine</span><strong>{e.deltaWidthMm.toFixed(2)} mm</strong></div>
             <div><span>Visina: digitalno / fizički</span><strong>{t.predictedHeightMm.toFixed(1)} / {t.actualHeightMm.toFixed(1)} mm</strong></div>
             <div><span>Greška visine</span><strong>{e.deltaHeightMm.toFixed(2)} mm</strong></div>
           </div>
           {t.notes&&<p>{t.notes}</p>}
         </article>;
       })}</div>:<p className="muted">Podaci će se prikazati nakon prve stvarne fizičke kontrole.</p>}
       <div className="safety-note"><AlertTriangle size={17}/><p>Ove kontrole porede samo širinu i visinu spoljašnjeg obuhvata.
         Ne dokazuju tačnost zubaca, uskih otvora, konkavnih segmenata ili CNC putanje.
         Nijedan zapis automatski ne mijenja status u VERIFIED.</p></div>
     </section>
   </div>
 </div>;
}
