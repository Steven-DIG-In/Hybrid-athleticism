// Block retrospective E2E spec.
// COMMITTED BUT NOT RUNNABLE: Playwright infrastructure is not configured
// in this repo. Spec lives here so it runs once @playwright/test +
// playwright.config.ts land. Same convention as Plan 2 / Plan 3.

import { test, expect } from '@playwright/test'

test.describe('Block retrospective close-out flow', () => {
  test.beforeEach(async ({ page }) => {
    // Auth fixture would log in as test user here.
    await page.goto('/dashboard')
  })

  test('close button appears once any session completed', async ({ page }) => {
    await expect(page.getByRole('button', { name: /close block/i })).toBeVisible()
  })

  test('nudge banner appears when end_date has passed', async ({ page }) => {
    // Pre-condition: test fixture seeded an active block past its end_date.
    await expect(page.getByText(/wrapped \d+ days? ago/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /close & review/i })).toBeVisible()
  })

  test('confirm modal previews snapshot, then closes block', async ({ page }) => {
    await page.getByRole('button', { name: /close & review/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await expect(modal.getByText(/prescribed/i)).toBeVisible()
    await expect(modal.getByText(/completed/i)).toBeVisible()
    await modal.getByRole('button', { name: /close & generate retrospective/i }).click()
    await page.waitForURL(/\/data\/blocks\/.+\/retrospective$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('dashboard shows empty state with "Review last block" after close', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/no active block/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /review last block/i })).toBeVisible()
  })
})
