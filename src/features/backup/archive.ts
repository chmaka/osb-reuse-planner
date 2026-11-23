import type {AuditEvent,EdgeCheck,ImageAsset,Part,Remnant,ScanRecord,ValidationTrial} from '../../types';

export const BACKUP_FORMAT='meditera-osb-reuse-full-backup';
export const BACKUP_VERSION=1;
export const MAX_PHOTO_BYTES=80*1024*1024;
export const MAX_ARCHIVE_BYTES=125*1024*1024;

export interface ArchiveTables{
 remnants:Remnant[];
 scans:ScanRecord[];
 parts:Part[];
 validation:ValidationTrial[];
 edgeChecks:EdgeCheck[];
 audit:AuditEvent[];
}
export interface Snapshot extends ArchiveTables{images:ImageAsset[]}
export type TableName=keyof Snapshot;
export const TABLE_NAMES:TableName[]=['remnants','scans','parts','validation','edgeChecks','audit','images'];

export interface EncodedBlob{type:string;size:number;sha256:string;base64:string}
export interface EncodedImage{
 id:string;mime:string;createdAt:string;blob:EncodedBlob;normalizedBlob:EncodedBlob|null;
}
export interface BackupArchive{
 format:typeof BACKUP_FORMAT;version:typeof BACKUP_VERSION;
 exportedAt:string;appVersion:string;
 data:ArchiveTables & {images:EncodedImage[]};
 manifestSha256:string;
}

const textEncoder=new TextEncoder();
function hash(buf:BufferSource):Promise<string>{
 return crypto.subtle.digest('SHA-256',buf).then(result=>
  Array.from(new Uint8Array(result),n=>n.toString(16).padStart(2,'0')).join(''));
}
export async function checksum(bytes:ArrayBuffer):Promise<string>{return hash(bytes)}
async function textHash(value:unknown):Promise<string>{return hash(textEncoder.encode(JSON.stringify(value)))}
function encodeBase64(buffer:Uint8Array):string{
 let output='';
 // Each chunk must be divisible by 3 to avoid stray '=' in the middle.
 for(let i=0;i<buffer.length;i+=12288){
  const part=buffer.subarray(i,i+12288);
  let characters='';
  for(let j=0;j<part.length;j++)characters+=String.fromCharCode(part[j]);
  output+=btoa(characters);
 }
 return output;
}
function decodeBase64(data:string,size:number):Uint8Array<ArrayBuffer>{
 if(typeof data!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)||
   data.length!==Math.ceil(size/3)*4)
  throw Error('Neispravan Base64 sadržaj slike.');
 const output=new Uint8Array(size);
 let offset=0;
 for(let i=0;i<data.length;i+=16384){
  const decoded=atob(data.slice(i,i+16384));
  if(offset+decoded.length>size)throw Error('Veličina dekodirane slike se ne poklapa.');
  for(let j=0;j<decoded.length;j++)output[offset+j]=decoded.charCodeAt(j);
  offset+=decoded.length;
 }
 if(offset!==size)throw Error('Oštećena slika u sigurnosnoj kopiji.');
 return output;
}
function assert(condition:unknown,message:string):asserts condition{
 if(!condition)throw Error(message);
}
function isObject(v:unknown):v is Record<string,unknown>{
 return typeof v==='object'&&v!==null&&!Array.isArray(v);
}
function validId(id:unknown):id is string{
 return typeof id==='string'&&id.length>0&&id.length<=128;
}
function assertArrays(data:unknown):asserts data is BackupArchive['data']{
 assert(isObject(data),'Sigurnosna kopija nema važeće kolekcije.');
 for(const name of TABLE_NAMES){
  const rows=data[name];
  assert(Array.isArray(rows)&&rows.length<=100000,'Neispravna ili prevelika tabela: '+name);
  const seen=new Set<string>();
  for(const row of rows){
   assert(isObject(row)&&validId(row.id),'Neispravan ID u tabeli '+name);
   assert(!seen.has(row.id),'Duplirani ID '+row.id+' u tabeli '+name);
   seen.add(row.id);
  }
 }
}
function blobManifest(b:EncodedBlob|null){
 return b?{type:b.type,size:b.size,sha256:b.sha256}:null;
}
function metadataOnly(data:BackupArchive['data']){
 return {...data,images:data.images.map(im=>({
  id:im.id,mime:im.mime,createdAt:im.createdAt,
  blob:blobManifest(im.blob),normalizedBlob:blobManifest(im.normalizedBlob)
 }))};
}
async function encodeBlob(blob:Blob):Promise<EncodedBlob>{
 const buffer=await blob.arrayBuffer();
 return {type:blob.type,size:blob.size,sha256:await checksum(buffer),
   base64:encodeBase64(new Uint8Array(buffer))};
}
async function decodeBlob(raw:unknown):Promise<Blob>{
 assert(isObject(raw),'Zapis fotografije nije objekat.');
 assert(typeof raw.type==='string'&&raw.type.length<=128,'Nevažeći tip slike.');
 assert(Number.isSafeInteger(raw.size)&&Number(raw.size)>=0&&Number(raw.size)<=MAX_PHOTO_BYTES,
  'Nevažeća veličina fotografije.');
 assert(typeof raw.sha256==='string'&&/^[0-9a-f]{64}$/.test(raw.sha256),'Nevažeći potpis fotografije.');
 const bytes=decodeBase64(raw.base64 as string,raw.size as number);
 const digest=await checksum(bytes.buffer);
 assert(digest===raw.sha256,'SHA-256 kontrola slike nije prošla (oštećena kopija).');
 return new Blob([bytes],{type:raw.type});
}
function validateRelations(data:BackupArchive['data']){
 const images=new Set(data.images.map(x=>x.id));
 const scans=new Set(data.scans.map(x=>x.id));
 const remnants=new Set(data.remnants.map(x=>x.id));
 for(const r of data.remnants){
  assert(typeof r.label==='string'&&Array.isArray(r.polygonMm)&&r.polygonMm.length>=3,
    'Neispravna kontura ostatka '+r.id);
  for(const pt of r.polygonMm)
   assert(pt&&Number.isFinite(pt.x)&&Number.isFinite(pt.y),'Neispravno teme ostatka '+r.id);
  if(r.imageId)assert(images.has(r.imageId),'Nedostaje fotografija ostatka '+r.id);
  if(r.scanId)assert(scans.has(r.scanId),'Nedostaje izvorno skeniranje ostatka '+r.id);
 }
 for(const s of data.scans){
  assert(images.has(s.imageId),'Nedostaje fotografija skeniranja '+s.id);
  if(s.remnantId)assert(remnants.has(s.remnantId),'Nedostaje ostatak skeniranja '+s.id);
 }
 for(const entry of [...data.validation,...data.edgeChecks]){
  assert(remnants.has(entry.remnantId),'Nedostaje ostatak fizičke kontrole '+entry.id);
 }
}
export async function buildArchive(snapshot:Snapshot,exportedAt=new Date().toISOString()):Promise<BackupArchive>{
 assertArrays(snapshot);
 let bytes=0;
 const images:EncodedImage[]=[];
 for(const im of snapshot.images){
  assert(im.blob instanceof Blob&&(!im.normalizedBlob||im.normalizedBlob instanceof Blob),
    'Fotografija nije dostupna u lokalnoj bazi.');
  bytes+=im.blob.size+(im.normalizedBlob?.size||0);
  assert(bytes<=MAX_PHOTO_BYTES,'Fotografije prelaze ograničenje kopije od 80 MiB. Potrebno je podijeliti inventar ili koristiti veći alat za arhiviranje.');
  images.push({id:im.id,mime:im.mime,createdAt:im.createdAt,
    blob:await encodeBlob(im.blob),
    normalizedBlob:im.normalizedBlob?await encodeBlob(im.normalizedBlob):null});
 }
 const data={remnants:snapshot.remnants,scans:snapshot.scans,parts:snapshot.parts,
   validation:snapshot.validation,edgeChecks:snapshot.edgeChecks,audit:snapshot.audit,images};
 validateRelations(data);
 const archive:BackupArchive={format:BACKUP_FORMAT,version:BACKUP_VERSION,exportedAt,
   appVersion:'0.6.0',data,manifestSha256:await textHash(metadataOnly(data))};
 assert(new Blob([JSON.stringify(archive)]).size<=MAX_ARCHIVE_BYTES,
   'Ukupna kopija prelazi sigurnosno ograničenje od 125 MiB.');
 return archive;
}
export async function parseArchive(raw:string):Promise<{archive:BackupArchive;snapshot:Snapshot}>{
 assert(new Blob([raw]).size<=MAX_ARCHIVE_BYTES,'Datoteka je prevelika za mobilni uvoz.');
 let parsed:unknown;
 try{parsed=JSON.parse(raw)}catch{throw Error('Ovo nije važeća JSON sigurnosna kopija.')}
 assert(isObject(parsed)&&parsed.format===BACKUP_FORMAT&&parsed.version===BACKUP_VERSION,
   'Nepodržan format ili verzija sigurnosne kopije.');
 assert(typeof parsed.manifestSha256==='string'&&/^[0-9a-f]{64}$/.test(parsed.manifestSha256),
   'Nedostaje kontrolni zbir sigurnosne kopije.');
 assert(typeof parsed.exportedAt==='string'&&!Number.isNaN(Date.parse(parsed.exportedAt)),
   'Nevažeći datum kopije.');
 assertArrays(parsed.data);
 const archive=parsed as unknown as BackupArchive;
 assert(await textHash(metadataOnly(archive.data))===archive.manifestSha256,
   'SHA-256 kontrola sadržaja kopije nije prošla; ništa nije uvezeno.');
 validateRelations(archive.data);
 let total=0;
 const images:ImageAsset[]=[];
 for(const im of archive.data.images){
  assert(isObject(im)&&typeof im.mime==='string'&&typeof im.createdAt==='string',
    'Nevažeći zapis slike u kopiji.');
  const original=await decodeBlob(im.blob);
  const normalized=im.normalizedBlob?await decodeBlob(im.normalizedBlob):undefined;
  total+=original.size+(normalized?.size||0);
  assert(total<=MAX_PHOTO_BYTES,'Fotografije prelaze ograničenje od 80 MiB.');
  images.push({id:im.id,mime:im.mime,createdAt:im.createdAt,
    blob:original,normalizedBlob:normalized});
 }
 const snapshot:Snapshot={
  remnants:archive.data.remnants,scans:archive.data.scans,parts:archive.data.parts,
  validation:archive.data.validation,edgeChecks:archive.data.edgeChecks,
  audit:archive.data.audit,images
 };
 return {archive,snapshot};
}
export function backupCounts(snapshot:Snapshot):Record<TableName,number>{
 return Object.fromEntries(TABLE_NAMES.map(n=>[n,snapshot[n].length])) as Record<TableName,number>;
}
