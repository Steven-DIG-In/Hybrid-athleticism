import { test, expect } from '@playwright/test'

test('manual entry → doctor report download', async ({ page }) => {
  await page.goto('/data/health')
  await expect(page.getByRole('heading', { name: 'Health' })).toBeVisible()

  // Supplement
  await page.goto('/data/health/supplements')
  await page.getByRole('button', { name: /Add/ }).click()
  await page.getByPlaceholder(/Name/).fill('Vitamin D3')
  await page.getByPlaceholder('Dose').fill('5000')
  await page.getByPlaceholder('Unit').fill('IU')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Vitamin D3')).toBeVisible()

  // Bloodwork
  await page.goto('/data/health/bloodwork/new')
  await page.getByPlaceholder('Marker').first().fill('Ferritin')
  await page.getByPlaceholder('Value').first().fill('12')
  await page.getByPlaceholder('Unit').first().fill('ng/mL')
  await page.getByPlaceholder('Low').first().fill('30')
  await page.getByPlaceholder('High').first().fill('400')
  await page.getByRole('button', { name: 'Save panel' }).click()
  await expect(page.getByText('Ferritin')).toBeVisible()

  // Report
  await page.goto('/data/health/doctor-report')
  await expect(page.getByText('Vitamin D3')).toBeVisible()
  await expect(page.getByText('Ferritin')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download PDF' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/health-report.*\.pdf/)
})
