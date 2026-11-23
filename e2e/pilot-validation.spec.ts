import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('physical pilot stores measurements but not CNC approval, tracks unique offcuts and exports results',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
   const {db}=await import('/src/db.ts');
   await db.remnants.add({
     id:'pilot-osb-01',label:'Pilot OSB 01',material:'OSB',thicknessMm:18,
     polygonMm:[{x:0,y:0},{x:1200,y:0},{x:1200,y:600},{x:0,y:600}],
     holesMm:[],defectsMm:[],areaMm2:720000,location:'Radionica',status:'MEASURED',
     calibrationMethod:'aruco-single',mmPerPx:null,revision:1,
     createdAt:'2026-11-23T00:00:00.000Z',updatedAt:'2026-11-23T00:00:00.000Z'
   });
 });
 await page.getByRole('button',{name:'Validacija'}).first().click();
 await expect(page.getByRole('heading',{name:'Fizička validacija'})).toBeVisible();
 await expect(page.getByText('Nema podataka').first()).toBeVisible();
 await expect(page.getByText('1200.0 mm')).toBeVisible();
 await expect(page.getByText('600.0 mm')).toBeVisible();
 await expect(page.getByRole('button',{name:'Sačuvaj fizičku kontrolu'})).toBeDisabled();
 await page.getByLabel('Fizička širina (mm)').fill('1198');
 await page.getByLabel('Fizička visina (mm)').fill('604');
 await page.getByRole('button',{name:'Sačuvaj fizičku kontrolu'}).click();
 await expect(page.getByText(/Kontrola sačuvana: odstupanja 2\.0 mm širine i -4\.0 mm visine/)).toBeVisible();
 await expect(page.locator('.pilot-trial')).toHaveCount(1);
 await expect(page.locator('.pilot-metrics .metric-value').first()).toContainText('1');
 await expect(page.getByText(/Preostalo je/)).toContainText('19 različitih');
 const saved=await page.evaluate(async()=>{
   const {db}=await import('/src/db.ts');
   return {count:await db.validation.count(),status:(await db.remnants.get('pilot-osb-01'))?.status};
 });
 expect(saved).toEqual({count:1,status:'MEASURED'});
 await page.reload();
 await page.getByRole('button',{name:'Validacija'}).first().click();
 await expect(page.locator('.pilot-trial')).toHaveCount(1);
 await page.getByLabel('Fizička širina (mm)').fill('1210');
 await page.getByLabel('Fizička visina (mm)').fill('599');
 await page.getByRole('button',{name:'Sačuvaj fizičku kontrolu'}).click();
 await expect(page.locator('.pilot-trial')).toHaveCount(2);
 // Repeated trials of the same physical item should never inflate 20-item target.
 await expect(page.locator('.pilot-metrics .metric-value').first()).toContainText('1');
 await expect(page.locator('.pilot-metrics .metric-value').nth(1)).toContainText('2');
 await expect(page.getByText('Odstupanje iznad praga')).toBeVisible();
 const pending=page.waitForEvent('download');
 await page.getByRole('button',{name:'CSV rezultati'}).click();
 const download=await pending;
 expect(download.suggestedFilename()).toBe('meditera-osb-pilot-physical-checks.csv');
 const path=await download.path();
 if(!path)throw Error('CSV download missing');
 const csv=await readFile(path,'utf8');
 expect(csv).toContain('scanned_width_mm');
 expect(csv).toContain('Pilot OSB 01');
 expect(csv).toContain('1210');
});
test('no field measurements: no fake accuracy claim or export',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Validacija'}).first().click();
 await expect(page.getByText('Nema podataka').first()).toBeVisible();
 await expect(page.getByRole('button',{name:'CSV rezultati'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'JSON rezultati'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Sačuvaj fizičku kontrolu'})).toBeDisabled();
});
