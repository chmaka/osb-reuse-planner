import {test,expect} from '@playwright/test';

async function upload(page:import('@playwright/test').Page,includeMarker:boolean){
 const png=await page.evaluate(async(includeMarker)=>{
   const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;
   const ctx=canvas.getContext('2d')!;
   ctx.fillStyle='#181a1c';ctx.fillRect(0,0,800,600);
   ctx.fillStyle='#c8a67e';
   ctx.beginPath();ctx.moveTo(105,90);ctx.lineTo(715,90);ctx.lineTo(715,500);
   ctx.lineTo(490,500);ctx.lineTo(490,440);ctx.lineTo(105,440);ctx.closePath();ctx.fill();
   if(includeMarker){
     const {generateMarkerSvg}=await import('/src/features/calibration/aruco.ts');
     const svg=await generateMarkerSvg(4,80);
     const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
     try{
       const img=new Image();img.src=url;await img.decode();
       ctx.fillStyle='#fff';ctx.fillRect(345,135,270,270);
       ctx.drawImage(img,355,145,250,250);
     }finally{URL.revokeObjectURL(url)}
   }
   return canvas.toDataURL('image/png').split(',')[1];
 },includeMarker);
 await page.locator('input[type=file]').setInputFiles({
   name:'automatski-test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await expect(page.locator('svg.photo-svg')).toBeVisible();
}

test('one-photo automatic scanner recognizes ArUco marker, irregular contour and mm dimensions',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Skeniranje'}).first().click();
 await expect(page.getByRole('checkbox',{name:/Auto-skeniranje odmah/})).toBeChecked();
 await expect(page.getByLabel('Način prepoznavanja oblika')).toHaveValue('fast');
 await page.getByLabel('Stvarna veličina markera').fill('80');
 await upload(page,true);
 await expect(page.getByLabel('Automatski izmjerene dimenzije')).toBeVisible({timeout:30000});
 const readings=await page.getByLabel('Automatski izmjerene dimenzije').innerText();
 expect(readings).toContain('ArUco ID 4');
 const values=readings.match(/\d+(?:\.\d+)? mm/g)?.map(x=>parseFloat(x))||[];
 expect(values.length).toBeGreaterThanOrEqual(2);
 expect(values[0]).toBeGreaterThan(100);
 expect(values[0]).toBeLessThan(600);
 expect(values[1]).toBeGreaterThan(50);
 await expect(page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'})).toBeDisabled();
 await expect(page.getByText(/Predlog: .*% slike/)).toBeVisible();
});

test('missing marker is not allowed to produce fake measured millimeters',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Skeniranje'}).first().click();
 await upload(page,false);
 await expect(page.getByText(/ArUco marker nije pronađen/)).toBeVisible({timeout:30000});
 await expect(page.getByLabel('Automatski izmjerene dimenzije')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Sačuvaj izmjereni ostatak'})).toBeDisabled();
});
