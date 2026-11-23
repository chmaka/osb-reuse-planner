import {test,expect} from '@playwright/test';

async function uploadSynthetic(page:import('@playwright/test').Page,withHole:boolean){
  const data=await page.evaluate(({withHole})=>{
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=400;
    const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#191c1d';ctx.fillRect(0,0,600,400);
    ctx.fillStyle='#cbaa84';ctx.fillRect(85,62,430,285);
    if(withHole){ctx.fillStyle='#191c1d';ctx.fillRect(222,150,83,75)}
    return canvas.toDataURL('image/png').split(',')[1];
  },{withHole});
  await page.locator('input[type=file]').setInputFiles({
    name:'phase3-synthetic.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')
  });
  await expect(page.locator('svg.photo-svg')).toBeVisible();
  return async(x:number,y:number)=>{
    const svg=page.locator('svg.photo-svg');
    // Switching inspector controls may scroll the document on compact displays.
    // Never reuse viewport coordinates captured before a scroll.
    await svg.scrollIntoViewIfNeeded();
    const rect=await svg.boundingBox();
    if(!rect)throw Error('Photo editor not visible');
    await page.mouse.click(rect.x+rect.width*x,rect.y+rect.height*y);
  };
}
async function allRemnants(page:import('@playwright/test').Page){
  return page.evaluate(async()=>{
    const r=indexedDB.open('meditera-osb-reuse-lab');
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const tx=db.transaction('remnants','readonly');
    const rows=await new Promise<Array<{
      polygonMm:{x:number;y:number}[];holesMm:{x:number;y:number}[][];
      defectsMm:{x:number;y:number}[][];areaMm2:number;status:string;
      segmentation?:{reviewed:boolean;algorithm:string}
    }>>((resolve,reject)=>{
      const req=tx.objectStore('remnants').getAll();
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)
    });
    db.close();return rows;
  });
}
test('automatic local segmentation and holes: requires operator review, stores exclusions',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Skeniranje'}).first().click();
  const click=await uploadSynthetic(page,true);
  await click(.12,.08);await click(.32,.08);
  await page.getByRole('button',{name:'Predloži konturu automatski'}).click();
  await expect(page.getByText(/Predlog: .*% slike/)).toBeVisible({timeout:10000});
  await expect(page.getByText(/automatski predloženih unutrašnjih otvora/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'})).toBeDisabled();
  await page.getByRole('button',{name:'Prihvati predložene otvore'}).click();
  await expect(page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'})).toBeDisabled();
  await page.getByRole('checkbox',{name:/Pregledao sam i ispravio konturu/}).check();
  await expect(page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'})).toBeEnabled();
  await page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'}).click();
  await expect(page.getByRole('heading',{name:'Inventar ostataka'})).toBeVisible();
  const rows=await allRemnants(page);
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe('MEASURED');
  expect(rows[0].holesMm).toHaveLength(1);
  expect(rows[0].segmentation?.reviewed).toBe(true);
  expect(rows[0].segmentation?.algorithm).toBe('background-color-largest-component-v1');
  expect(rows[0].areaMm2).toBeGreaterThan(0);
});

test('manual inner hole and separate defect are preserved and subtracted from usable area',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Skeniranje'}).first().click();
  console.log('TRACE: synthetic upload');
  const click=await uploadSynthetic(page,false);
  console.log('TRACE: calibration');
  await click(.1,.1);await click(.3,.1);
  await page.getByRole('button',{name:/3\. Kontura/}).click();
  for(const [x,y] of [[.12,.15],[.88,.15],[.88,.82],[.12,.82]])await click(x,y);
  console.log('TRACE: outer contour');
  await page.getByLabel('Sloj konture').selectOption('hole');
  for(const [x,y] of [[.26,.3],[.39,.3],[.39,.46],[.26,.46]])await click(x,y);
  console.log('TRACE: hole points');
  await page.getByRole('button',{name:/Završi otvor/}).click();
  console.log('TRACE: completed hole');
  await page.getByLabel('Sloj konture').selectOption('defect');
  // Deliberately invalid defect overlaps an existing hole: must block saving.
  for(const [x,y] of [[.29,.33],[.35,.33],[.35,.41],[.29,.41]])await click(x,y);
  console.log('TRACE: completed invalid defect drawing');
  await page.getByRole('button',{name:/Završi oštećenje/}).click();
  console.log('TRACE: invalid region expected');
  await expect(page.getByText(/Otvori i oštećenja se sijeku ili dodiruju/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'})).toBeDisabled();
  console.log('TRACE: invalid region rejected, removing');
  await page.locator('.exclusion-row').filter({hasText:'Oštećenje 1'}).getByRole('button',{name:'Ukloni'}).click();
  for(const [x,y] of [[.60,.55],[.72,.55],[.72,.69],[.60,.69]])await click(x,y);
  await page.getByRole('button',{name:/Završi oštećenje/}).click();
  console.log('TRACE: valid defect drawn');
  await expect(page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'})).toBeEnabled();
  console.log('TRACE: save enabled');
  await page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'}).click();
  await expect(page.getByRole('heading',{name:'Inventar ostataka'})).toBeVisible();
  const rows=await allRemnants(page);
  expect(rows).toHaveLength(1);
  expect(rows[0].holesMm).toHaveLength(1);
  expect(rows[0].defectsMm).toHaveLength(1);
  expect(rows[0].areaMm2).toBeGreaterThan(0);
  expect(rows[0].areaMm2).toBeLessThan(110_000);
});

test('unclosed draft excludes saving and is restored after page reload',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Skeniranje'}).first().click();
  const click=await uploadSynthetic(page,false);
  await click(.1,.1);await click(.3,.1);
  await page.getByRole('button',{name:/3\. Kontura/}).click();
  for(const [x,y] of [[.12,.15],[.88,.15],[.88,.82],[.12,.82]])await click(x,y);
  await page.getByLabel('Sloj konture').selectOption('hole');
  await click(.25,.30);await click(.36,.30);
  await expect(page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'})).toBeDisabled();
  // Wait beyond debounce so the CAPTURED scan persists an editable draft.
  await page.waitForTimeout(1100);
  await page.getByTitle('Nova fotografija').click();
  await expect(page.getByRole('button',{name:/Nastavi mjerenje/})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Skeniranje'}).first().click();
  await page.getByRole('button',{name:/Nastavi mjerenje/}).click();
  await expect(page.locator('svg.photo-svg')).toBeVisible();
  await expect(page.getByLabel('Sloj konture')).toHaveValue('hole');
  await expect(page.getByRole('button',{name:/Završi otvor \(2\)/})).toBeVisible();
  await expect(page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'})).toBeDisabled();
});
