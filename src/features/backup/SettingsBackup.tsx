import {useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {AlertTriangle,Download,HardDrive,ShieldCheck,UploadCloud} from 'lucide-react';
import {db} from '../../db';
import {applyRestore,createFullBackup,isBackupFile,previewRestore} from './storage';
import type {RestorePlan} from './storage';
import {TABLE_NAMES} from './archive';
import type {TableName} from './archive';

const captions:Record<TableName,string>={
 remnants:'OSB ostaci',scans:'Skeniranja',parts:'Dijelovi',validation:'Kontrole širine/visine',
 edgeChecks:'Kontrolne dužine',audit:'Dnevnik operacija',images:'Fotografije'
};
export default function SettingsBackup(){
 const counts=useLiveQuery(async()=>({
   remnants:await db.remnants.count(),scans:await db.scans.count(),parts:await db.parts.count(),
   validation:await db.validation.count(),edgeChecks:await db.edgeChecks.count(),
   audit:await db.audit.count(),images:await db.images.count()
 }),[]);
 const [exporting,setExporting]=useState(false);
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState<RestorePlan|null>(null);
 const [scanning,setScanning]=useState(false),[restoring,setRestoring]=useState(false);
 const [agree,setAgree]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [lastSize,setLastSize]=useState<number|null>(null);
 async function exportAll(){
   if(exporting)return;
   setExporting(true);setError('');setMessage('');
   try{
     const result=await createFullBackup();
     const url=URL.createObjectURL(result.blob);
     const a=document.createElement('a');a.href=url;a.download=result.name;document.body.appendChild(a);
     a.click();a.remove();
     setTimeout(()=>URL.revokeObjectURL(url),3000);
     setLastSize(result.blob.size);
     setMessage('Pripremljena je kompletna lokalna kopija. Sačuvaj preuzetu JSON datoteku na sigurnom mjestu i provjeri je na drugom uređaju.');
   }catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setExporting(false)}
 }
 async function selectFile(input:File|undefined){
   setFile(input||null);setPreview(null);setAgree(false);
   setError('');setMessage('');setLastSize(null);
   if(!input)return;
   if(!isBackupFile(input)){setError('Izaberi podržanu .json sigurnosnu kopiju do 125 MiB.');return}
   setScanning(true);
   try{setPreview(await previewRestore(input))}
   catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setScanning(false)}
 }
 async function restore(){
   if(!file||!preview||!agree||restoring||preview.conflicts.length)return;
   setRestoring(true);setError('');setMessage('');
   try{
     const result=await applyRestore(file,preview.manifestSha256);
     const n=Object.values(result.missing).reduce((s,v)=>s+v,0);
     setMessage(n>0?'Uspješno vraćeno '+n+' novih zapisa. Postojeći identični zapisi nijesu duplirani.':
       'Svi zapisi iz kopije već postoje i identični su. Ništa nije prepisano.');
     setAgree(false);setPreview(null);setFile(null);
   }catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setRestoring(false)}
 }
 const conflictCount=preview?.conflicts.length||0;
 return <div className="backup-page">
   <header className="page-header">
     <div><div className="eyebrow">MEDITERA / OSB REUSE LAB</div>
     <h1>Podešavanja i sigurnosne kopije</h1>
     <p>Izvoz i siguran povrat inventara, originalnih fotografija i fizičkih kontrola — bez cloud naloga.</p></div>
   </header>
   <div className="backup-layout">
     <section className="panel card-padding backup-panel">
       <div className="backup-section-heading"><HardDrive size={21}/><h2>Preuzmi kompletnu kopiju</h2></div>
       <p className="muted">Kopija uključuje fotografije, digitalne konture, radne nacrte uz postojeće skenove, dijelove, sva mjerenja i dnevnik promjena. Sačuvaj je van ovog browsera.</p>
       <div className="backup-table">
         {TABLE_NAMES.map(name=><div key={name}>
           <span>{captions[name]}</span><strong>{counts?counts[name]:'—'}</strong>
         </div>)}
       </div>
       <button className="primary full" disabled={exporting} onClick={()=>void exportAll()}>
         <Download size={18}/>{exporting?'Priprema i SHA-256 provjera fotografija...':'Preuzmi sigurnosnu kopiju (.json)'}</button>
       {lastSize!==null&&<p className="small-help">Veličina posljednje kopije: {(lastSize/1048576).toFixed(2)} MiB.</p>}
       <div className="backup-caution"><AlertTriangle size={17}/>
         <p>Datoteka <strong>nije šifrovana</strong>: može sadržati fotografije i radne podatke.
           Ne šalji je javno. Trenutno je ograničena na 80 MiB izvornih fotografija, odnosno 125 MiB ukupnog arhiva,
           radi zaštite mobilnog browsera od preopterećenja.</p></div>
     </section>
     <section className="panel card-padding backup-panel">
       <div className="backup-section-heading"><UploadCloud size={21}/><h2>Provjeri i vrati kopiju</h2></div>
       <p className="muted">Možeš prenijeti datoteku na drugi telefon ili računar. Prvo se provjeravaju format, svi SHA-256 kontrolni zbirovi i konfliktni ID-jevi. Ništa se ne upisuje tokom pregleda.</p>
       <div className="form-block">
         <label className="form-label" htmlFor="backup-file">Datoteka prethodno napravljene kopije (.json)</label>
         <input id="backup-file" className="backup-file" type="file"
           accept=".json,application/json" disabled={scanning||restoring}
           onChange={e=>void selectFile(e.target.files?.[0])}/>
       </div>
       {scanning&&<p role="status" className="auto-progress">Provjera integriteta datoteke i postojećih lokalnih podataka...</p>}
       {preview&&<div className="backup-preview">
         <div className="backup-section-heading"><ShieldCheck size={18}/><h3>Kopija je čitljiva i kontrolni zbirovi su ispravni</h3></div>
         <small>Izvezena: {new Date(preview.sourceDate).toLocaleString('sr-RS')}
           {' · SHA-256: '+preview.manifestSha256.slice(0,16)+'…'}</small>
         <div className="backup-table">{TABLE_NAMES.map(name=><div key={name}>
           <span>{captions[name]}</span>
           <strong>{preview.counts[name]} ukupno · {preview.missing[name]} novo · {preview.existingIdentical[name]} isto</strong>
         </div>)}</div>
         {conflictCount>0?<div role="alert" className="backup-conflict">
           <strong>Konfliktni zapisi: {conflictCount}</strong>
           <p>Uvoz je onemogućen: postojeći ID se podudara, ali se podaci razlikuju. Ne prepisujemo lokalne snimke i mjerenja.</p>
           <small>{preview.conflicts.slice(0,8).join(', ')}</small>
         </div>:<>
           <label className="review-check"><input type="checkbox" checked={agree}
             onChange={e=>setAgree(e.target.checked)}/>
             Pregledao/la sam kopiju i razumijem da se novi zapisi dodaju lokalno, a postojeći identični preskaču.</label>
           <button className="primary full" disabled={!agree||restoring||scanning}
             onClick={()=>void restore()}>
             <UploadCloud size={18}/>{restoring?'Upisivanje u lokalnu bazu...':'Vrati kopiju bez prepisivanja'}</button>
         </>}
       </div>}
       {error&&<p role="alert" className="error-text">{error}</p>}
       {message&&<p role="status" className="pilot-success">{message}</p>}
       <div className="backup-caution"><AlertTriangle size={17}/><p>Uvoz je transakcioni: ako jedna operacija ne uspije, nijedan novi zapis ne smije ostati djelimično sačuvan. Zaštita SHA-256 otkriva slučajna oštećenja, ali nije digitalni potpis izvornog autora.</p></div>
     </section>
   </div>
   <div className="safety-note"><AlertTriangle size={18}/>
     <p>Sigurnosna kopija ne odobrava materijal za proizvodnju. Čuvaj najmanje dvije kopije na odvojenim uređajima.
       Rezultati terenskog pilota i dalje moraju biti fizički potvrđeni; softverski testovi ne dokazuju tačnost na OSB-u.</p></div>
 </div>;
}
