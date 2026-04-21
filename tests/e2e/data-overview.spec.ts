import { test, expect } from '@playwright/test'

/**
 * Smoke test for the /data overview page.
 *
 * NOTE: Playwright is not installed in this repo yet. This spec is committed as
 * documentation/scaffolding for when Playwright infra is set up. Running
 * `npx playwright test` today will fail — install @playwright/test and add
 * a playwright.config.ts first. See Lane B's matching spec at
 * tests/e2e/doctor-report.spec.ts for the same pattern.
 *
 * The `Health` tile assertion is intentionally excluded here — it ships in
 * Lane B's branch (feat/metrics-health-core). Add it after both lanes merge.
 */

test('data overview renders 4 adherence tiles', async ({ page }) => {
  await page.goto('/data')
  // Four adherence tiles — headings match the tile components.
  await expect(page.getByText('Block Adherence')).toBeVisible()
  await expect(page.getByText('Coach inbox')).toBeVisible()
  await expect(page.getByText('Coach bias')).toBeVisible()
  await expect(page.getByText('Off-plan sessions')).toBeVisible()
})

test('adherence drill-down navigates from tile', async ({ page }) => {
  await page.goto('/data')
  await page.getByText('Block Adherence').click()
  await expect(page).toHaveURL(/\/data\/overview\/adherence/)
  await expect(page.getByRole('heading', { name: 'Block adherence' })).toBeVisible()
})
