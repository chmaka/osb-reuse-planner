import {describe,it,expect} from 'vitest';
import {buildArchive,parseArchive,backupCounts,BACKUP_FORMAT} from './archive';
import type {Snapshot} from './archive';
function fixture():Snapshot{
 const stamp='2026-11-23T16:00:00.000Z';
 return {
  remnants:[{
   id:'remnant1',label:'OSB segment',material:'OSB',thicknessMm:18,
   polygonMm:[{x:0,y:0},{x:120,y:0},{x:120,y:90},{x:0,y:90}],
   holesMm:[],defectsMm:[],areaMm2:10800,location:'Radionica',
   status:'MEASURED',imageId:'image1',scanId:'scan1',calibrationMethod:'aruco-single',
   mmPerPx:null,revision:1,createdAt:stamp,updatedAt:stamp
  }],
  scans:[{id:'scan1',imageId:'image1',status:'MEASURED',source:'upload',
   width:500,height:300,qualityWarnings:[],conversion:'native',
   originalMime:'image/png',createdAt:stamp,remnantId:'remnant1'}],
  parts:[{id:'part1',name:'P',polygonMm:[{x:0,y:0},{x:20,y:0},{x:20,y:40},{x:0,y:40}],
   quantity:1,thicknessMm:18,material:'OSB',allowQuarterTurns:true}],
  validation:[{id:'validation1',at:stamp,remnantId:'remnant1',remnantLabel:'OSB segment',
    remnantRevision:1,calibrationMethod:'aruco-single',algorithm:'manual',
    predictedWidthMm:120,predictedHeightMm:90,actualWidthMm:121,actualHeightMm:91,
    toleranceMm:5,device:'Android',lighting:'LED',referenceMethod:'ručni metar',notes:'test'}],
  edgeChecks:[{id:'edge1',at:stamp,remnantId:'remnant1',remnantLabel:'OSB segment',
    remnantRevision:1,algorithm:'manual',ringKind:'outer',ringIndex:0,fromVertex:0,toVertex:1,
    from:{x:0,y:0},to:{x:120,y:0},scannedMm:120,physicalMm:121,
    toleranceMm:5,referenceMethod:'ručni metar',notes:''}],
  audit:[{id:'audit1',at:stamp,action:'SCAN_MEASURED',entityId:'remnant1',detail:'measured'}],
  images:[{id:'image1',mime:'image/png',createdAt:stamp,
    blob:new Blob([new Uint8Array([0,1,2,3,255])],{type:'image/png'}),
    normalizedBlob:new Blob([new Uint8Array([255,2,1,0])],{type:'image/png'})}]
 };
}
const date='2026-11-23T16:00:00.000Z';
describe('full local-first OSB backup archive',()=>{
 it('roundtrips all seven tables and two independent photo blobs',async()=>{
  const backup=await buildArchive(fixture(),date);
  expect(backup.format).toBe(BACKUP_FORMAT);
  expect(backup.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
  const {snapshot}=await parseArchive(JSON.stringify(backup));
  expect(backupCounts(snapshot)).toEqual({
   remnants:1,scans:1,parts:1,validation:1,edgeChecks:1,audit:1,images:1});
  expect(snapshot.remnants[0].status).toBe('MEASURED');
  expect(snapshot.validation[0].actualWidthMm).toBe(121);
  expect(snapshot.edgeChecks[0].fromVertex).toBe(0);
  expect(Array.from(new Uint8Array(await snapshot.images[0].blob.arrayBuffer())))
   .toEqual([0,1,2,3,255]);
  expect(Array.from(new Uint8Array(await snapshot.images[0].normalizedBlob!.arrayBuffer())))
   .toEqual([255,2,1,0]);
 });
 it('handles image with no normalized representation',async()=>{
  const s=fixture();
  s.images[0].normalizedBlob=undefined;
  const {snapshot}=await parseArchive(JSON.stringify(await buildArchive(s,date)));
  expect(snapshot.images[0].normalizedBlob).toBe(undefined);
 });
 it('rejects structured data corruption without writing anything',async()=>{
  const a=await buildArchive(fixture(),date);
  a.data.remnants[0].label='CORRUPTED';
  await expect(parseArchive(JSON.stringify(a))).rejects.toThrow(/SHA-256/);
 });
 it('rejects photo corruption even with unchanged metadata manifest',async()=>{
  const a=await buildArchive(fixture(),date);
  const b64=a.data.images[0].blob.base64;
  a.data.images[0].blob.base64=(b64[0]==='A'?'B':'A')+b64.slice(1);
  await expect(parseArchive(JSON.stringify(a))).rejects.toThrow(/SHA-256/);
 });
 it('rejects duplicate keys and missing referenced photo',async()=>{
  const s=fixture();s.remnants.push({...s.remnants[0]});
  await expect(buildArchive(s,date)).rejects.toThrow(/Duplirani ID/);
  const missing=fixture();missing.images=[];
  await expect(buildArchive(missing,date)).rejects.toThrow(/Nedostaje fotografija/);
 });
 it('rejects missing source scan and measurements referring to absent remnants',async()=>{
  const s=fixture();s.scans=[];
  await expect(buildArchive(s,date)).rejects.toThrow(/Nedostaje izvorno skeniranje/);
  const other=fixture();other.edgeChecks[0].remnantId='missing';
  await expect(buildArchive(other,date)).rejects.toThrow(/Nedostaje ostatak/);
 });
 it('rejects unsupported versions, invalid JSON and missing digest',async()=>{
  const a=await buildArchive(fixture(),date);
  await expect(parseArchive('not json')).rejects.toThrow(/JSON/);
  await expect(parseArchive(JSON.stringify({...a,version:999}))).rejects.toThrow(/Nepodržan/);
  await expect(parseArchive(JSON.stringify({...a,manifestSha256:'bad'}))).rejects.toThrow(/kontrolni zbir/);
 });
 it('rejects invalid geometry before calculating any backup',async()=>{
  const s=fixture();s.remnants[0].polygonMm[0].x=Infinity;
  await expect(buildArchive(s,date)).rejects.toThrow(/Neispravno teme/);
 });
 it('supports empty fresh inventory without claiming recorded physical evidence',async()=>{
  const s=fixture();
  for(const name of Object.keys(s) as (keyof Snapshot)[])(s[name] as unknown[]).splice(0);
  const a=await buildArchive(s,date);
  const parsed=await parseArchive(JSON.stringify(a));
  expect(parsed.snapshot.images).toHaveLength(0);
  expect(parsed.snapshot.validation).toHaveLength(0);
 });
});
