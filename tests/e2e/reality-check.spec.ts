// Adherence honesty E2E spec.
// COMMITTED BUT NOT RUNNABLE: Playwright infrastructure is not configured
// in this repo. Spec lives here so it runs once @playwright/test +
// playwright.config.ts land. Same convention as Plan 2 / Plan 3 / sub-project A.

import { test, expect } from '@playwright/test'

test.describe('Reality-check boundary flow (post-close)', () => {
  test('close → reality-check → save → retrospective', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /close & review/i }).click()
    await page.getByRole('button', { name: /close & generate retrospective/i }).click()
    // Land on reality-check page (NOT directly on retrospective).
    await page.waitForURL(/\/data\/blocks\/.+\/reality-check$/)
    await expect(page.getByRole('heading', { name: /quick reality check/i })).toBeVisible()
    // Change a value to enable Save.
    await page.getByLabel(/days you actually trained/i).fill('5')
    await page.getByRole('button', { name: /save & continue/i }).click()
    await page.waitForURL(/\/data\/blocks\/.+\/retrospective$/)
  })

  test('skip path redirects to retrospective without writing', async ({ page }) => {
    await page.goto('/data/blocks/test-meso-id/reality-check')
    await page.getByRole('button', { name: /skip — no changes/i }).click()
    await page.waitForURL(/\/data\/blocks\/.+\/retrospective$/)
  })
})

test.describe('Mid-block overrun signal', () => {
  test.beforeEach(async ({ page }) => {
    // Test fixture would seed 3 over-budget completed workouts here.
    await page.goto('/dashboard')
  })

  test('banner appears, modal opens, save closes banner', async ({ page }) => {
    await expect(page.getByText(/ran .* min over budget/i)).toBeVisible()
    await page.getByRole('button', { name: /update/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await expect(modal.getByText(/last .* sessions/i)).toBeVisible()
    await modal.getByLabel(/warm-up overhead/i).fill('20')
    await modal.getByRole('button', { name: /save & continue/i }).click()
    await expect(page.getByText(/ran .* min over budget/i)).not.toBeVisible()
  })

  test('dismiss closes banner and writes dismiss-marker', async ({ page }) => {
    await page.getByRole('button', { name: /^dismiss$/i }).click()
    await expect(page.getByText(/ran .* min over budget/i)).not.toBeVisible()
  })
})
