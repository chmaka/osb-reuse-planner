import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const testStamp='2026-11-23T16:00:00.000Z';
async function seed(page:import('@playwright/test').Page){
 await page.evaluate(async stamp=>{
  const {db}=await import('/src/db.ts');
  const image=new Blob([new Uint8Array([32,50,99,14,0,255,11])],{type:'image/png'});
  await db.images.add({id:'backup-image',mime:'image/png',createdAt:stamp,blob:image,
    normalizedBlob:new Blob([new Uint8Array([0,255,2])],{type:'image/png'})});
  await db.remnants.add({
   id:'backup-remnant',label:'Ostatak za sigurnosnu kopiju',material:'OSB',thicknessMm:18,
   polygonMm:[{x:0,y:0},{x:120,y:0},{x:120,y:90},{x:0,y:90}],
   holesMm:[],defectsMm:[],areaMm2:10800,location:'Radionica',
   status:'MEASURED',imageId:'backup-image',scanId:'backup-scan',calibrationMethod:'aruco-single',
   mmPerPx:null,revision:1,createdAt:stamp,updatedAt:stamp
  });
  await db.scans.add({
   id:'backup-scan',imageId:'backup-image',status:'MEASURED',
   source:'upload',width:500,height:300,qualityWarnings:[],conversion:'native',
   originalMime:'image/png',createdAt:stamp,remnantId:'backup-remnant'
  });
  await db.validation.add({id:'backup-validation',at:stamp,remnantId:'backup-remnant',
   remnantLabel:'Ostatak za sigurnosnu kopiju',remnantRevision:1,
   calibrationMethod:'aruco-single',algorithm:'manual',predictedWidthMm:120,predictedHeightMm:90,
   actualWidthMm:121,actualHeightMm:89,toleranceMm:5,device:'Android',lighting:'LED',
   referenceMethod:'ručni metar',notes:'pilot'});
  await db.edgeChecks.add({id:'backup-edge',at:stamp,remnantId:'backup-remnant',
    remnantLabel:'Ostatak za sigurnosnu kopiju',remnantRevision:1,algorithm:'manual',
    ringKind:'outer',ringIndex:0,fromVertex:0,toVertex:1,
    from:{x:0,y:0},to:{x:120,y:0},scannedMm:120,physicalMm:121,toleranceMm:5,
    referenceMethod:'ručni metar',notes:''});
  await db.audit.add({id:'backup-audit',at:stamp,action:'SCAN_MEASURED',entityId:'backup-remnant',detail:'test'});
  await db.parts.add({id:'backup-part',name:'P',polygonMm:[{x:0,y:0},{x:30,y:0},{x:30,y:40},{x:0,y:40}],
   quantity:1,thicknessMm:18,material:'OSB',allowQuarterTurns:false});
 },testStamp);
}
test('full browser backup preserves images, measurements, inventory and idempotent restore',async({page})=>{
 await page.goto('/');
 await seed(page);
 await page.getByRole('button',{name:'Podešavanja'}).first().click();
 await expect(page.getByRole('heading',{name:'Podešavanja i sigurnosne kopije'})).toBeVisible();
 const pending=page.waitForEvent('download');
 await page.getByRole('button',{name:'Preuzmi sigurnosnu kopiju (.json)'}).click();
 const downloaded=await pending;
 expect(downloaded.suggestedFilename()).toMatch(/meditera-osb-backup.*\.json/);
 const path=await downloaded.path();if(!path)throw Error('Backup download unavailable');
 const bytes=await readFile(path);
 const archive=JSON.parse(bytes.toString('utf8'));
 expect(archive.version).toBe(1);
 expect(archive.data.images).toHaveLength(1);
 expect(archive.data.validation).toHaveLength(1);
 expect(archive.data.edgeChecks).toHaveLength(1);
 // Importing identical data is safe and must never create duplicates.
 await page.getByLabel('Datoteka prethodno napravljene kopije (.json)').setInputFiles({
  name:'backup.json',mimeType:'application/json',buffer:bytes
 });
 await expect(page.getByText('Kopija je čitljiva i kontrolni zbirovi su ispravni')).toBeVisible();
 await expect(page.getByText('0 novo').first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Vrati kopiju bez prepisivanja'})).toBeDisabled();
 await page.getByLabel(/Pregledao\/la sam kopiju/).check();
 await page.getByRole('button',{name:'Vrati kopiju bez prepisivanja'}).click();
 await expect(page.getByText(/Svi zapisi iz kopije već postoje/)).toBeVisible();
 // Simulate another empty browser database in this isolated test profile.
 await page.evaluate(async()=>{
  const {db}=await import('/src/db.ts');
  await db.transaction('rw',db.remnants,db.scans,db.parts,async()=>{
   await db.remnants.clear();await db.scans.clear();await db.parts.clear();
  });
  await db.validation.clear();await db.edgeChecks.clear();await db.audit.clear();await db.images.clear();
 });
 // Reset file input before reselecting same original archive.
 await page.getByLabel('Datoteka prethodno napravljene kopije (.json)').setInputFiles([]);
 await page.getByLabel('Datoteka prethodno napravljene kopije (.json)').setInputFiles({
  name:'backup.json',mimeType:'application/json',buffer:bytes
 });
 await expect(page.getByText('1 novo').first()).toBeVisible();
 await page.getByLabel(/Pregledao\/la sam kopiju/).check();
 await page.getByRole('button',{name:'Vrati kopiju bez prepisivanja'}).click();
 await expect(page.getByText(/Uspješno vraćeno 7 novih zapisa/)).toBeVisible();
 const restored=await page.evaluate(async()=>{
  const {db}=await import('/src/db.ts');
  const im=await db.images.get('backup-image');
  const remnant=await db.remnants.get('backup-remnant');
  return {
   remnantStatus:remnant?.status,parts:await db.parts.count(),
   dimensionEvidence:await db.validation.count(),
   edgeEvidence:await db.edgeChecks.count(),scans:await db.scans.count(),
   photo:im?Array.from(new Uint8Array(await im.blob.arrayBuffer())):null,
   normalized:im?.normalizedBlob?Array.from(new Uint8Array(await im.normalizedBlob.arrayBuffer())):null
  };
 });
 expect(restored).toEqual({
  remnantStatus:'MEASURED',parts:1,dimensionEvidence:1,edgeEvidence:1,scans:1,
  photo:[32,50,99,14,0,255,11],normalized:[0,255,2]
 });
 await page.reload();
 await page.getByRole('button',{name:'Podešavanja'}).first().click();
 await expect(page.locator('.backup-table').first().getByText('OSB ostaci')).toBeVisible();
});

test('damaged backup and ID collision block writes without silent overwrites',async({page})=>{
 await page.goto('/');await seed(page);
 await page.getByRole('button',{name:'Podešavanja'}).first().click();
 const pending=page.waitForEvent('download');
 await page.getByRole('button',{name:'Preuzmi sigurnosnu kopiju (.json)'}).click();
 const path=await (await pending).path();if(!path)throw Error('No download');
 const original=JSON.parse((await readFile(path)).toString('utf8'));
 const bad=structuredClone(original);
 bad.data.remnants[0].label='manipulated';
 await page.getByLabel('Datoteka prethodno napravljene kopije (.json)').setInputFiles({
  name:'damaged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))
 });
 await expect(page.getByRole('alert').first()).toContainText('SHA-256');
 await expect(page.getByRole('button',{name:'Vrati kopiju bez prepisivanja'})).toHaveCount(0);
 // Corrupt current state without changing backup: collision must be detected and block restore.
 await page.evaluate(async()=>{
  const {db}=await import('/src/db.ts');
  await db.remnants.update('backup-remnant',{label:'Different local label'});
 });
 await page.getByLabel('Datoteka prethodno napravljene kopije (.json)').setInputFiles([]);
 await page.getByLabel('Datoteka prethodno napravljene kopije (.json)').setInputFiles({
  name:'backup-original.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))
 });
 await expect(page.getByText('Konfliktni zapisi: 1')).toBeVisible();
 await expect(page.getByRole('button',{name:'Vrati kopiju bez prepisivanja'})).toHaveCount(0);
 const state=await page.evaluate(async()=>{
  const {db}=await import('/src/db.ts');
  return {label:(await db.remnants.get('backup-remnant'))?.label,counts:await db.remnants.count()};
 });
 expect(state).toEqual({label:'Different local label',counts:1});
});
