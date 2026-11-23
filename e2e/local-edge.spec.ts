import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('physical checks of inner opening/irregular outer contour persist, preserve source geometry and remain non-CNC',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
   const {db}=await import('/src/db.ts');
   await db.remnants.add({
     id:'local-edge-osb',label:'OSB sa otvorom',material:'OSB',thicknessMm:18,
     polygonMm:[{x:0,y:0},{x:240,y:0},{x:240,y:180},{x:150,y:180},{x:150,y:130},{x:0,y:130}],
     holesMm:[[{x:20,y:20},{x:60,y:20},{x:60,y:50},{x:20,y:50}]],
     defectsMm:[[{x:180,y:20},{x:210,y:20},{x:200,y:40}]],
     areaMm2:36000,location:'Radionica',status:'MEASURED',
     calibrationMethod:'aruco-single',mmPerPx:null,revision:4,
     createdAt:'2026-11-23T00:00:00.000Z',updatedAt:'2026-11-23T00:00:00.000Z'
   });
 });
 await page.getByRole('button',{name:'Validacija'}).first().click();
 const section=page.getByRole('region',{name:'Lokalna provjera konture'});
 await expect(section.getByRole('heading',{name:/Kontrolne dužine/})).toBeVisible();
 await expect(section.getByLabel('Kontura za kontrolu')).toContainText('Otvor 1');
 await section.getByLabel('Kontura za kontrolu').selectOption('hole:0');
 await expect(section.getByText('40.00 mm')).toBeVisible();
 await expect(section.getByRole('button',{name:'Sačuvaj kontrolnu dužinu'})).toBeDisabled();
 await section.getByLabel('Fizička kontrolna dužina (mm)').fill('41');
 await expect(section.getByRole('button',{name:'Sačuvaj kontrolnu dužinu'})).toBeEnabled();
 await section.getByRole('button',{name:'Sačuvaj kontrolnu dužinu'}).click();
 await expect(section.getByRole('status')).toContainText('odstupanje -1.00 mm');
 await expect(section.locator('.edge-history .pilot-trial')).toHaveCount(1);
 const values=await page.evaluate(async()=>{
   const {db}=await import('/src/db.ts');
   return {record:await db.edgeChecks.get((await db.edgeChecks.toArray())[0].id),
     remnant:await db.remnants.get('local-edge-osb')};
 });
 expect(values.record?.ringKind).toBe('hole');
 expect(values.record?.ringIndex).toBe(0);
 expect(values.record?.remnantRevision).toBe(4);
 expect(values.record?.from).toEqual({x:20,y:20});
 expect(values.record?.to).toEqual({x:60,y:20});
 expect(values.record?.scannedMm).toBe(40);
 expect(values.record?.physicalMm).toBe(41);
 expect(values.remnant?.status).toBe('MEASURED');
 expect(values.remnant?.holesMm[0][0]).toEqual({x:20,y:20});
 await page.reload();
 await page.getByRole('button',{name:'Validacija'}).first().click();
 const section2=page.getByRole('region',{name:'Lokalna provjera konture'});
 await expect(section2.locator('.edge-history .pilot-trial')).toHaveCount(1);
 await expect(section2.getByText(/OSB sa otvorom/).first()).toBeVisible();
 await section2.getByLabel('Kontura za kontrolu').selectOption('outer:0');
 await section2.getByLabel('Teme A (indeks)').selectOption('3');
 await section2.getByLabel('Teme B (indeks)').selectOption('4');
 await expect(section2.getByText('50.00 mm')).toBeVisible();
 await section2.getByLabel('Teme B (indeks)').selectOption('3');
 await expect(section2.getByRole('button',{name:'Sačuvaj kontrolnu dužinu'})).toBeDisabled();
 const pending=page.waitForEvent('download');
 await section2.getByRole('button',{name:'CSV dužine'}).click();
 const d=await pending;expect(d.suggestedFilename()).toContain('local-edge-checks');
 const path=await d.path();if(!path)throw Error('CSV unavailable');
 const csv=await readFile(path,'utf8');
 expect(csv).toContain('ring_kind');
 expect(csv).toContain('"hole"');
 expect(csv).toContain('"40"');
});

test('no field edge checks means no invented local accuracy or download',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Validacija'}).first().click();
 const section=page.getByRole('region',{name:'Lokalna provjera konture'});
 await expect(section.getByText('Nema podataka').first()).toBeVisible();
 await expect(section.getByRole('button',{name:'CSV dužine'})).toBeDisabled();
 await expect(section.getByRole('button',{name:'JSON dužine'})).toBeDisabled();
 await expect(section.getByRole('button',{name:'Sačuvaj kontrolnu dužinu'})).toBeDisabled();
});
