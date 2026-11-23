import {test,expect} from '@playwright/test';

test('projective four-corner calibration requires independent check, then persists metric contour',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Skeniranje'}).first().click();
  // Manual regression path: the one-touch automatic workflow has its own E2E suite.
  await page.getByRole('checkbox',{name:/Auto-skeniranje odmah/}).uncheck();
 const data=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=600;c.height=400;
   const ctx=c.getContext('2d')!;ctx.fillStyle='#292d2a';ctx.fillRect(0,0,600,400);
   ctx.fillStyle='#d3b696';ctx.fillRect(50,30,520,350);
   return c.toDataURL('image/png').split(',')[1];
 });
 await page.locator('input[type=file]').setInputFiles({name:'test-card.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
 await expect(page.locator('svg.photo-svg')).toBeVisible();
 await page.getByLabel('Metoda kalibracije').selectOption('rectangle');
 await page.getByLabel('Širina reference').fill('200');
 await page.getByLabel('Visina reference').fill('300');
 const svg=page.locator('svg.photo-svg');const bounds=await svg.boundingBox();
 if(!bounds)throw Error('Missing calibration SVG');
 const click=async(x:number,y:number)=>page.mouse.click(bounds.x+x*bounds.width,bounds.y+y*bounds.height);
 for(const [x,y] of [[.1,.1],[.6,.1],[.6,.8],[.1,.8]])await click(x,y);
 await expect(page.getByRole('button',{name:/3\. Kontura/})).toBeEnabled();
 await page.getByRole('button',{name:/2\. Kontrola/}).click();
 for(const [x,y] of [[.2,.5],[.45,.5]])await click(x,y);
 await page.getByLabel('Kontrolna dužina').fill('120');
 await expect(page.getByText(/Kontrola: odstupanje/)).toBeVisible();
 await page.getByRole('button',{name:/3\. Kontura/}).click();
 for(const [x,y] of [[.14,.2],[.38,.2],[.38,.70],[.14,.70]])await click(x,y);
 await expect(page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'})).toBeDisabled();
 await page.getByLabel('Kontrolna dužina').fill('100');
 await expect(page.getByText(/Kontrola: u granici/)).toBeVisible();
 await page.getByRole('button',{name:/Prikaži ispravljenu 2D konturu/}).click();
 await expect(page.getByLabel('Ispravljena vektorska kontura u mm')).toBeVisible();
 await page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'}).click();
 await expect(page.getByRole('heading',{name:'Inventar ostataka'})).toBeVisible();
 const snapshot=await page.evaluate(async()=>{
   const req=indexedDB.open('meditera-osb-reuse-lab');
   const database=await new Promise<IDBDatabase>((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   const tx=database.transaction('remnants','readonly');
   const records=await new Promise<{calibrationMethod:string;calibration?:{independentCheck?:{passed:boolean};pixelToMm:number[]};mmPerPx:number|null}[]>((resolve,reject)=>{
     const query=tx.objectStore('remnants').getAll();query.onsuccess=()=>resolve(query.result);query.onerror=()=>reject(query.error)
   });database.close();return records;
 });
 expect(snapshot).toHaveLength(1);
 expect(snapshot[0].calibrationMethod).toBe('manual-rectangle');
 expect(snapshot[0].calibration?.independentCheck?.passed).toBe(true);
 expect(snapshot[0].calibration?.pixelToMm).toHaveLength(9);
 expect(snapshot[0].mmPerPx).toBeNull();
});

test('marker generator downloads printable SVG while preserving manual fallback',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Skeniranje'}).first().click();
  // Manual regression path: the one-touch automatic workflow has its own E2E suite.
  await page.getByRole('checkbox',{name:/Auto-skeniranje odmah/}).uncheck();
 await page.getByLabel('Metoda kalibracije').selectOption('marker');
 await page.getByLabel('Strana markera').fill('80');
 await page.getByLabel('ID markera').fill('4');
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Preuzmi SVG ArUco marker za štampu'}).click();
 const download=await downloadPromise;
 expect(download.suggestedFilename()).toContain('80mm.svg');
 const fs=await import('node:fs/promises');
 const path=await download.path();if(!path)throw Error('Marker SVG not downloaded.');
 const data=await fs.readFile(path,'utf8');
 expect(data).toContain('width="100mm"');
 expect(data).toContain('height="100mm"');
 expect(data).toContain('viewBox');
 await page.getByLabel('Metoda kalibracije').selectOption('line');
 await expect(page.getByText('Poznato rastojanje dvije tačke (mm)')).toBeVisible();
});


test('locally generated printed marker is detected from a synthetic photographed scene in worker',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Skeniranje'}).first().click();
  // Manual regression path: the one-touch automatic workflow has its own E2E suite.
  await page.getByRole('checkbox',{name:/Auto-skeniranje odmah/}).uncheck();
 const encoded=await page.evaluate(async()=>{
   const {generateMarkerSvg}=await import('/src/features/calibration/aruco.ts');
   const content=await generateMarkerSvg(4,80);
   const url=URL.createObjectURL(new Blob([content],{type:'image/svg+xml'}));
   try{
     const img=new Image();img.src=url;await img.decode();
     const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;
     const ctx=canvas.getContext('2d')!;
     ctx.fillStyle='#e4e1dc';ctx.fillRect(0,0,800,600);
     ctx.fillStyle='#a28867';ctx.fillRect(110,90,600,410);
     // Printed marker must lie on same plane as object; add a full quiet zone.
     ctx.fillStyle='white';ctx.fillRect(345,135,270,270);
     ctx.drawImage(img,355,145,250,250);
     return canvas.toDataURL('image/png').split(',')[1];
   }finally{URL.revokeObjectURL(url)}
 });
 await page.locator('input[type=file]').setInputFiles({
   name:'aruco-generated-scene.png',mimeType:'image/png',buffer:Buffer.from(encoded,'base64')
 });
 await page.getByLabel('Metoda kalibracije').selectOption('marker');
 await page.getByRole('button',{name:'Pronađi ArUco na fotografiji'}).click();
 await expect(page.getByText('Prepoznati markeri')).toBeVisible({timeout:15000});
 await expect(page.getByLabel('Prepoznati markeri')).toHaveValue('4');
 await expect(page.getByRole('button',{name:/3\. Kontura/})).toBeEnabled();
});
