import { test, expect, type Page } from '@playwright/test'

// Helper to generate unique test user email
const generateTestEmail = () => `test-${Date.now()}@example.com`

// Helper to sign in via magic link (for dev/test environments)
async function signInWithMagicLink(page: Page, email: string) {
  // Go to signup page and request magic link
  await page.goto('/app/signup')
  await page.fill('input[id="email"]', email)
  await page.click('button[type="submit"]')

  // Wait for email sent confirmation
  await expect(page.locator('text=Check your email')).toBeVisible({ timeout: 10000 })

  // In dev/test mode, fetch the magic link from the dev endpoint
  const response = await page.request.get(`/api/dev/magic-link/${encodeURIComponent(email)}`)

  if (!response.ok()) {
    throw new Error(`Failed to get magic link: ${response.status()}`)
  }

  const data = await response.json()
  if (!data.url) {
    throw new Error('No magic link URL returned')
  }

  // Navigate to the magic link to complete sign-in
  await page.goto(data.url)

  // Should redirect to /app after successful auth
  await page.waitForURL(/\/app/, { timeout: 10000 })
}

test.describe('Transcriber App - Core Workflow', () => {
  let testEmail: string

  test.beforeEach(() => {
    testEmail = generateTestEmail()
  })

  test('complete workflow: signup → dashboard → navigate', async ({ page }) => {
    // Step 1: Sign up via magic link
    await test.step('Sign up new user via magic link', async () => {
      await signInWithMagicLink(page, testEmail)
      console.log('✓ User signed up successfully via magic link')
    })

    // Step 2: Verify dashboard loads
    await test.step('Verify dashboard', async () => {
      // Should be on /app or /app/dashboard
      await expect(page).toHaveURL(/\/app/)

      // Look for dashboard content
      const mainContent = page.locator('main')
      await expect(mainContent).toBeVisible({ timeout: 5000 })

      console.log('✓ Dashboard loaded')
    })

    // Step 3: Navigate to different sections
    await test.step('Navigate app sections', async () => {
      // Navigate to Record page
      await page.click('text=Record')
      await page.waitForURL('**/app/record')
      await expect(page.locator('main')).toBeVisible()
      console.log('✓ Record page accessible')

      // Navigate to Subjects page
      await page.click('text=Subjects')
      await page.waitForURL('**/app/subjects')
      await expect(page.locator('main')).toBeVisible()
      console.log('✓ Subjects page accessible')

      // Navigate to Settings page
      await page.click('text=Settings')
      await page.waitForURL('**/app/settings')
      await expect(page.locator('main')).toBeVisible()
      console.log('✓ Settings page accessible')

      // Navigate back to Dashboard
      await page.click('text=Dashboard')
      await page.waitForURL('**/app')
      await expect(page.locator('main')).toBeVisible()
      console.log('✓ Dashboard accessible')
    })
  })

  test('can access record page and see controls', async ({ page }) => {
    // Sign in first
    await signInWithMagicLink(page, testEmail)

    // Navigate to record page
    await page.goto('/app/record')
    await page.waitForURL('**/app/record')

    // Check for recording UI elements
    const mainContent = page.locator('main')
    await expect(mainContent).toBeVisible()

    // Should have some recording-related content
    const hasRecordButton = await page.locator('button').filter({ hasText: /record/i }).count() > 0
    const hasRecordText = await page.locator('text=/record/i').count() > 0

    expect(hasRecordButton || hasRecordText).toBeTruthy()
    console.log('✓ Record page has recording controls')
  })
})

// Test to verify the landing page is accessible
test('landing page is accessible', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Transcriber/i)

  // Check for key navigation elements on landing page
  const hasStartLink = await page.locator('text=Start Transcribing').count() > 0
  const hasSignIn = await page.locator('text=Sign In').count() > 0
  const hasGetStarted = await page.locator('text=Get Started').count() > 0

  expect(hasStartLink || hasSignIn || hasGetStarted).toBeTruthy()

  console.log('✓ Landing page is accessible with navigation elements')
})

// Test to verify auth redirects work
test('unauthenticated user is redirected to login', async ({ page }) => {
  await page.goto('/app')

  // Should redirect to login or signup
  await page.waitForURL(/\/(login|signup)/, { timeout: 10000 })

  console.log('✓ Auth redirect works correctly')
})

// Test login page renders correctly
test('login page renders correctly', async ({ page }) => {
  await page.goto('/app/login')

  // Check for email input
  await expect(page.locator('input[id="email"]')).toBeVisible()

  // Check for submit button
  await expect(page.locator('button[type="submit"]')).toBeVisible()

  // Check for sign up link
  await expect(page.locator('text=Create an account')).toBeVisible()

  console.log('✓ Login page renders correctly')
})

// Test signup page renders correctly
test('signup page renders correctly', async ({ page }) => {
  await page.goto('/app/signup')

  // Check for email input
  await expect(page.locator('input[id="email"]')).toBeVisible()

  // Check for submit button
  await expect(page.locator('button[type="submit"]')).toBeVisible()

  // Check for sign in link
  await expect(page.locator('text=Sign in')).toBeVisible()

  console.log('✓ Signup page renders correctly')
})
