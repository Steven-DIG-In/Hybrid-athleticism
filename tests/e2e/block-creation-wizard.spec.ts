import { test, expect } from '@playwright/test'

// NOTE: Not runnable — Playwright infra not configured in this repo.
// Committed as scaffolding for when @playwright/test + playwright.config land.
// Same convention as tests/e2e/block-retrospective.spec.ts and reality-check.spec.ts.

test.describe('Block creation wizard', () => {
  test('first-block flow from onboarding', async ({ page }) => {
    // Athlete completes onboarding, lands on wizard with first-block mode.
    // Pick hypertrophy + 6 weeks, generate plan, approve.
    await page.goto('/onboarding')

    // ... step through onboarding ... (specifics depend on the existing flow;
    // when this spec becomes runnable, the onboarding harness fills these in)

    // Final onboarding step's Finish button should redirect to /data/blocks/new
    await expect(page).toHaveURL('/data/blocks/new')

    // Mode-specific: availability form visible, retrospective tile NOT visible
    await expect(page.getByText(/Set up your first block/i)).toBeVisible()
    await expect(page.getByText(/Your availability/i)).toBeVisible()
    await expect(page.getByText(/From Block/i)).not.toBeVisible()

    // Pick archetype + duration
    await page.getByRole('button', { name: /Hypertrophy/i }).first().click()
    await page.getByRole('button', { name: /6 weeks/i }).click()

    // Generate plan
    await page.getByRole('button', { name: /Generate plan/i }).click()

    // Wait for AI generation (head-coach + week 1 inventory)
    await expect(page.getByText(/Head coach strategy/i)).toBeVisible({ timeout: 60000 })

    // Approve
    await page.getByRole('button', { name: /Approve & start/i }).click()

    // Land on dashboard with active block
    await expect(page).toHaveURL('/dashboard')
  })

  test('post-block flow from dashboard CTA', async ({ page }) => {
    // Pre-condition: a closed Block 1 retrospective + pending_planner_notes captured
    // via the post-close reality-check.

    await page.goto('/dashboard')

    // Empty-state CTA (rendered when no active block)
    await page.getByRole('link', { name: /Start next block/i }).click()
    await expect(page).toHaveURL('/data/blocks/new')

    // Mode-specific: retrospective tile + carryover summary visible
    await expect(page.getByText(/From Block/i)).toBeVisible()
    await expect(page.getByText(/Your reality \(from reality-check\)/i)).toBeVisible()
    await expect(page.getByText(/Plan next block/i)).toBeVisible()

    // Pick archetype + leave 6 weeks default
    await page.getByRole('button', { name: /Hypertrophy/i }).first().click()

    // Generate
    await page.getByRole('button', { name: /Generate plan/i }).click()
    await expect(page.getByText(/Head coach strategy/i)).toBeVisible({ timeout: 60000 })

    // Confirm narrative references reality-check values (e.g. session minutes)
    const narrative = await page.locator('blockquote').first().textContent()
    expect(narrative).toMatch(/min|minutes/)

    // Approve
    await page.getByRole('button', { name: /Approve & start/i }).click()
    await expect(page).toHaveURL('/dashboard')
  })

  test('resume flow', async ({ page }) => {
    // Athlete creates a shell, abandons mid-generation, returns later.
    await page.goto('/data/blocks/new')

    // Pick archetype + start generation, then bail
    await page.getByRole('button', { name: /Hypertrophy/i }).first().click()
    await page.getByRole('button', { name: /Generate plan/i }).click()

    // Cancel mid-generation
    await page.getByRole('button', { name: /Cancel and edit plan/i }).click({ timeout: 60000 })

    // Navigate away
    await page.goto('/dashboard')

    // Return — resume prompt should appear
    await page.goto('/data/blocks/new')
    await expect(page.getByText(/You started planning/i)).toBeVisible()

    // Discard and start fresh
    await page.getByRole('button', { name: /Discard and start fresh/i }).click()

    // Resume prompt gone; fresh wizard visible
    await expect(page.getByText(/You started planning/i)).not.toBeVisible()
  })
})
