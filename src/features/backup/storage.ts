import {db} from '../../db';
import type {ImageAsset} from '../../types';
import {BACKUP_FORMAT,MAX_ARCHIVE_BYTES,TABLE_NAMES,backupCounts,buildArchive,checksum,parseArchive} from './archive';
import type {Snapshot,TableName} from './archive';

async function getSnapshot():Promise<Snapshot>{
 return db.transaction('r',db.remnants,db.scans,db.parts,db.validation,db.edgeChecks,db.audit,db.images,
  async()=>{
   const [remnants,scans,parts,validation,edgeChecks,audit,images]=await Promise.all([
    db.remnants.toArray(),db.scans.toArray(),db.parts.toArray(),db.validation.toArray(),
    db.edgeChecks.toArray(),db.audit.toArray(),db.images.toArray()
   ]);
   return {remnants,scans,parts,validation,edgeChecks,audit,images};
  });
}
export async function createFullBackup(){
 const archive=await buildArchive(await getSnapshot());
 const json=JSON.stringify(archive);
 return {name:'meditera-osb-backup-'+new Date().toISOString().slice(0,10)+'.json',
   blob:new Blob([json],{type:'application/json'}),counts:backupCounts(await readCounts())};
}
async function readCounts():Promise<Snapshot>{
 // Kept for accurate post-export UI feedback without retaining a copy of photo blobs.
 return getSnapshot();
}
export interface RestorePlan {
 filename:string;sourceDate:string;manifestSha256:string;
 counts:Record<TableName,number>;
 missing:Record<TableName,number>;existingIdentical:Record<TableName,number>;
 conflicts:string[];
}
function eq(a:unknown,b:unknown):boolean{return JSON.stringify(a)===JSON.stringify(b)}
async function eqImage(a:ImageAsset,b:ImageAsset):Promise<boolean>{
 if(a.id!==b.id||a.mime!==b.mime||a.createdAt!==b.createdAt||
   a.blob.type!==b.blob.type||a.blob.size!==b.blob.size||
   Boolean(a.normalizedBlob)!==Boolean(b.normalizedBlob))return false;
 if(a.normalizedBlob&&b.normalizedBlob&&
   (a.normalizedBlob.type!==b.normalizedBlob.type||a.normalizedBlob.size!==b.normalizedBlob.size))return false;
 const first=await Promise.all([a.blob.arrayBuffer(),b.blob.arrayBuffer()]);
 if(await checksum(first[0])!==await checksum(first[1]))return false;
 if(a.normalizedBlob&&b.normalizedBlob){
  const pair=await Promise.all([a.normalizedBlob.arrayBuffer(),b.normalizedBlob.arrayBuffer()]);
  return await checksum(pair[0])===await checksum(pair[1]);
 }
 return true;
}
async function inspect(snapshot:Snapshot,filename:string,sourceDate:string,manifestSha256:string){
 const current=await getSnapshot();
 const missing=Object.fromEntries(TABLE_NAMES.map(n=>[n,0])) as Record<TableName,number>;
 const existingIdentical=Object.fromEntries(TABLE_NAMES.map(n=>[n,0])) as Record<TableName,number>;
 const conflicts:string[]=[];
 const missingItems:Partial<Snapshot>={};
 for(const name of TABLE_NAMES){
  const existing=new Map<string,unknown>(current[name].map(r=>[r.id,r]));
  const next:Snapshot[typeof name]=[];
  for(const item of snapshot[name]){
   const prev=existing.get(item.id);
   if(!prev)next.push(item as never);
   else {
    const identical=name==='images'
      ?await eqImage(prev as ImageAsset,item as ImageAsset):eq(prev,item);
    if(identical)existingIdentical[name]++;
    else conflicts.push(name+': '+item.id);
   }
  }
  missing[name]=next.length;
  // Type-specific arrays stored for later transactional add.
  (missingItems as Record<string,unknown>)[name]=next;
 }
 return {plan:{filename,sourceDate,manifestSha256,
   counts:backupCounts(snapshot),missing,existingIdentical,conflicts} satisfies RestorePlan,
   missingItems};
}
async function loadBackup(file:File){
 if(file.size>MAX_ARCHIVE_BYTES)throw Error('Datoteka je prevelika za siguran uvoz.');
 const {archive,snapshot}=await parseArchive(await file.text());
 return {archive,snapshot};
}
export async function previewRestore(file:File):Promise<RestorePlan>{
 const {archive,snapshot}=await loadBackup(file);
 return (await inspect(snapshot,file.name,archive.exportedAt,archive.manifestSha256)).plan;
}
export async function applyRestore(file:File,approvedManifestSha256:string){
 const {archive,snapshot}=await loadBackup(file);
 if(archive.manifestSha256!==approvedManifestSha256)
  throw Error('Izabrana datoteka se promijenila; ponovo provjeri sigurnosnu kopiju.');
 const {plan,missingItems}=await inspect(snapshot,file.name,archive.exportedAt,archive.manifestSha256);
 if(plan.conflicts.length)throw Error('Pronađeni su postojeći zapisi sa istim ID-em i drugim podacima; uvoz je otkazan.');
 const payload=missingItems as Snapshot;
 await db.transaction('rw',db.remnants,db.scans,db.parts,db.validation,db.edgeChecks,db.audit,db.images,async()=>{
  for(const r of payload.images)await db.images.add(r);
  for(const r of payload.remnants)await db.remnants.add(r);
  for(const r of payload.scans)await db.scans.add(r);
  for(const r of payload.parts)await db.parts.add(r);
  for(const r of payload.validation)await db.validation.add(r);
  for(const r of payload.edgeChecks)await db.edgeChecks.add(r);
  for(const r of payload.audit)await db.audit.add(r);
 });
 return plan;
}
export function isBackupFile(file:File){return /\.json$/i.test(file.name)&&file.size>0&&file.size<=MAX_ARCHIVE_BYTES}
export {BACKUP_FORMAT};
