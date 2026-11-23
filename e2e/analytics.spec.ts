import { test, expect } from '@playwright/test';

test('analytics reads local inventory with filters, grouping and aggregate CSV', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { db } = await import('/src/db.ts');
    const now = new Date().toISOString();
    const seed = (id: string, thicknessMm: number, areaMm2: number, status: string, material: string) => ({
      id, label: 'UI test ' + id, material, thicknessMm,
      polygonMm: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }],
      holesMm: [], defectsMm: [], areaMm2, location: 'Test',
      status, calibrationMethod: 'two-point-manual', mmPerPx: 1,
      revision: 1, createdAt: now, updatedAt: now
    });
    await db.remnants.bulkPut([
      seed('a', 18, 400_000, 'MEASURED', 'OSB'),
      seed('b', 21, 600_000, 'AVAILABLE', 'Šperploča')
    ]);
  });
  await page.getByRole('button', { name: 'Analitika' }).first().click();
  await expect(page.getByRole('heading', { name: 'Analitika' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Analitika inventara' })).toContainText('Broj zapisa');
  await expect(page.locator('.inventory-insight-metric-value').first()).toContainText('2');
  await expect(page.locator('.inventory-insight-status[data-status="MEASURED"] b')).toHaveText('1');
  await page.screenshot({ path: 'test-results/analytics-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Materijal', exact: true }).click();
  await expect(page.locator('.inventory-insight-bar-row')).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Debljina materijala' }).selectOption('18');
  await expect(page.locator('.inventory-insight-metric-value').first()).toContainText('1');
  await expect(page.locator('.inventory-insight-bar-row')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV agregati' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('osb-inventar-agregati.csv');
  await expect(page.getByText(/nije prikaz ostvarenih ušteda/)).toBeVisible();
});

test('analytics is accessible on mobile, no fabricated savings and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Otvori meni' }).click();
  await page.getByRole('button', { name: 'Analitika' }).click();
  await expect(page.getByRole('heading', { name: 'Analitika' })).toBeVisible();
  await expect(page.getByText('Nema sačuvanih ostataka za izabrane filtere.')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.locator('.inventory-insight-metric-value').first()).toContainText('0');
  // Allow the existing responsive sidebar transition to finish before visual capture.
  await page.locator('.sidebar').evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined)));
  });
  await page.screenshot({ path: 'test-results/analytics-mobile.png', fullPage: true });
});
