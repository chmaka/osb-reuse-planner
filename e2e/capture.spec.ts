import { test, expect } from '@playwright/test';

test('denied camera permission offers upload and stores resumable capture offline',async({page})=>{
  await page.addInitScript(()=>{
    const devices=navigator.mediaDevices;
    if(devices)Object.defineProperty(devices,'getUserMedia',{
      configurable:true,value:async()=>{throw new DOMException('Denied','NotAllowedError')}
    });
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Skeniranje'}).first().click();
  await page.getByRole('button',{name:'Otvori kameru'}).click();
  await expect(page.getByText(/Kamera je odbijena/)).toBeVisible();
  const buffer=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=200;c.height=200;
    const ctx=c.getContext('2d')!;
    ctx.fillStyle='#303';ctx.fillRect(0,0,200,200);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({
    name:'photo-test.png',mimeType:'image/png',buffer:Buffer.from(buffer,'base64')
  });
  await expect(page.getByText('Provjera fotografije')).toBeVisible();
  await page.getByTitle('Nova fotografija').click();
  await expect(page.getByText('Nedovršeni snimci · sačuvani offline')).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Skeniranje'}).first().click();
  await expect(page.getByRole('button',{name:/Nastavi mjerenje/})).toBeVisible();
  await page.getByRole('button',{name:/Nastavi mjerenje/}).click();
  await expect(page.locator('svg.photo-svg')).toBeVisible();
});

test('mocked browser camera shows video acquisition controls and close path',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,
      value:async()=>{
        const c=document.createElement('canvas');c.width=640;c.height=480;
        return c.captureStream(10);
      }
    });
    Object.defineProperty(navigator.mediaDevices,'enumerateDevices',{configurable:true,
      value:async()=>[{kind:'videoinput',deviceId:'mock-1',label:'Test camera 1',groupId:'g1'},
        {kind:'videoinput',deviceId:'mock-2',label:'Test camera 2',groupId:'g2'}]
    });
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Skeniranje'}).first().click();
  await page.getByRole('button',{name:'Otvori kameru'}).click();
  await expect(page.getByRole('button',{name:'Fotografiši'})).toBeVisible();
  await expect(page.getByLabel('Izaberi kameru')).toBeVisible();
  await page.getByRole('button',{name:/Zatvori/}).click();
  await expect(page.getByRole('button',{name:'Učitaj sliku'})).toBeVisible();
});
