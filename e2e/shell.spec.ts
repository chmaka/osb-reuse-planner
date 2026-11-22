import { test,expect } from '@playwright/test';
test('app shell and scan navigation',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'OSB Reuse Lab'})).toBeVisible();
  await page.getByRole('button',{name:'Skeniranje'}).first().click();
  await expect(page.getByText('Fotografija ostatka')).toBeVisible();
});