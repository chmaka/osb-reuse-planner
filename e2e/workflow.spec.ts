import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('photo upload, measured polygon, persistent inventory, irregular layout and reference DXF',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Skeniranje'}).first().click();
  await expect(page.getByText('Fotografija ostatka')).toBeVisible();
  const dataUrl=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=600;c.height=400;
    const ctx=c.getContext('2d')!;
    ctx.fillStyle='#303b2a';ctx.fillRect(0,0,600,400);
    ctx.fillStyle='#b9a382';ctx.fillRect(80,70,430,260);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({
    name:'geometry-test.png',mimeType:'image/png',buffer:Buffer.from(dataUrl,'base64')
  });
  const svg=page.locator('svg.photo-svg');
  await expect(svg).toBeVisible();
  const b=await svg.boundingBox();
  if(!b)throw Error('editor not visible');
  const click=async(x:number,y:number)=>page.mouse.click(b.x+b.width*x,b.y+b.height*y);
  await click(.1,.10);await click(.3,.10);
  await page.getByRole('button',{name:/3\. Kontura/}).click();
  for(const [x,y] of [[.16,.18],[.80,.18],[.80,.81],[.16,.81]])await click(x,y);
  await expect(page.getByText('Temena konture')).toBeVisible();
  await page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'}).click();
  await expect(page.getByRole('heading',{name:'Inventar ostataka'})).toBeVisible();
  await expect(page.getByText('OSB ostatak',{exact:false}).first()).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Inventar'}).first().click();
  await expect(page.locator('.inventory-row')).toHaveCount(1);
  await page.getByRole('button',{name:'Nesting'}).first().click();
  await page.getByRole('button',{name:'Izračunaj raspored'}).click();
  await expect(page.getByRole('heading',{name:'Rezultat proračuna'})).toBeVisible();
  const referenceButton=page.getByRole('button',{name:'Preuzmi referentni DXF'});
  await expect(referenceButton).toBeEnabled();
  const event=page.waitForEvent('download');
  await referenceButton.click();
  const download=await event;
  expect(download.suggestedFilename()).toMatch(/REFERENCE\.dxf$/);
  const path=await download.path();
  if(!path)throw Error('DXF download unavailable');
  const content=await readFile(path,'utf8');
  expect(content).toContain('$INSUNITS\n70\n4');
  expect(content).toContain('REFERENCE_ONLY');
  expect(content).not.toContain('PART_OUTER_CUT');
});