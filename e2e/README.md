# E2E Tests with Playwright

This directory contains end-to-end tests for the Transcriber app using Playwright.

## Test Coverage

### Main Workflow Test (`app-workflow.spec.ts`)

Tests the complete user journey:
1. **Load home page** - Verifies app loads correctly
2. **Sign up** - Creates new user account
3. **Create subject** - Creates a new subject for organizing recordings
4. **Record audio** - Records 5 seconds of audio with microphone
5. **Transcribe** - Attempts transcription (currently fails due to known issue)

### Additional Tests

- **Sign in workflow** - Tests with existing user account
- **Subject CRUD** - Create and delete subjects
- **Accessibility** - Verifies home page is accessible

## Running Tests

### Prerequisites

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Install Playwright browsers:**
   ```bash
   bunx playwright install chromium
   ```

3. **Ensure dev server is not already running** (Playwright will start it automatically)

### Run Tests

```bash
# Run all tests (headless)
bun run test:e2e

# Run with UI (recommended for development)
bun run test:e2e:ui

# Run in headed mode (see browser)
bun run test:e2e:headed

# Run specific test file
bunx playwright test e2e/app-workflow.spec.ts

# Run in debug mode
bunx playwright test --debug
```

### View Test Reports

```bash
# After tests run, view HTML report
bun run test:e2e:report
```

## Test Output

Tests will:
- ✅ Create screenshots on failure
- ✅ Record video on failure
- ✅ Generate HTML report
- ✅ Show console logs for each step

## Known Issues

### Transcription Step

The transcription step currently **fails** due to the `registerBackend` error with `@xenova/transformers`. This is documented and expected.

The test will:
- ✅ Successfully complete steps 1-4
- ⚠️ Step 5 (transcription) will fail but test continues
- ✅ Verify navigation still works after transcription attempt

### Workarounds

Until transcription is fixed, the test:
1. Attempts transcription
2. Logs the expected failure
3. Continues with other verifications
4. Still passes overall (verifies rest of app works)

## Test Data

Tests use:
- **Email:** `test-{timestamp}@example.com` (unique per test run)
- **Password:** `TestPassword123!`
- **Subject:** "Test Subject"
- **Recording:** "Test Recording" (5 seconds)

This ensures each test run is isolated and doesn't conflict.

## Debugging

### Test Fails to Start

**Issue:** Dev server not starting
```bash
# Check if ports are in use
lsof -ti:5173  # Client
lsof -ti:3000  # Server

# Kill if needed
pkill -f "vite"
pkill -f "bun.*dev"
```

### Microphone Permission Issues

**Issue:** Recording fails
- Playwright auto-grants microphone permission
- Check browser console in headed mode for errors

### Timeout Issues

**Issue:** Tests timeout
- Increase timeout in `playwright.config.ts`
- Check that dev server started successfully
- Look for console errors in browser

### Database Issues

**Issue:** User already exists
- Tests use timestamp-based emails (should be unique)
- If issue persists, check `server/auth.db`

## CI/CD Integration

For CI environments:

```yaml
# Example GitHub Actions
- name: Install dependencies
  run: bun install

- name: Install Playwright
  run: bunx playwright install --with-deps chromium

- name: Run E2E tests
  run: bun run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Best Practices

### Writing Tests

1. **Use test.step()** for better reporting
2. **Add console.log()** for debugging
3. **Use descriptive selectors** (prefer text over CSS)
4. **Wait for navigation** explicitly
5. **Handle async properly** (await everything)

### Selectors Priority

1. **Text content:** `page.click('text=Sign Up')`
2. **Test IDs:** `page.locator('[data-testid="submit"]')`
3. **Roles:** `page.locator('button[type="submit"]')`
4. **Last resort:** CSS selectors

### Test Structure

```typescript
test('descriptive test name', async ({ page }) => {
  await test.step('Step 1: Do something', async () => {
    // Test code
    console.log('✓ Step completed')
  })
  
  await test.step('Step 2: Do next thing', async () => {
    // Test code
    console.log('✓ Step completed')
  })
})
```

## Extending Tests

### Add New Test

Create new file: `e2e/my-feature.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('my feature works', async ({ page }) => {
  await page.goto('/')
  // Your test code
})
```

### Add Test Helpers

Create `e2e/helpers.ts`:

```typescript
import { Page } from '@playwright/test'

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
}
```

## Troubleshooting

### Common Errors

**Error:** `page.goto: net::ERR_CONNECTION_REFUSED`
- **Fix:** Dev server not running. Playwright should start it automatically.
- Check `playwright.config.ts` webServer config

**Error:** `Timeout 30000ms exceeded`
- **Fix:** Increase timeout or check element selector
- Use `{ timeout: 60000 }` option

**Error:** `Element is not visible`
- **Fix:** Wait for element to be visible
- Use `await expect(element).toBeVisible()`

**Error:** `Session storage is not available`
- **Fix:** Clear browser state between tests
- Add `await page.context().clearCookies()`

## Performance

- Tests run in ~30-60 seconds
- Use `fullyParallel: false` for workflow tests
- Use `workers: 1` to avoid conflicts
- Parallel tests coming soon (when transcription is fixed)

## Next Steps

1. ✅ Tests for authentication flows
2. ✅ Tests for subject management
3. ✅ Tests for recording
4. ⏳ Fix transcription (blocked by registerBackend issue)
5. ⏳ Add tests for transcription when fixed
6. ⏳ Add tests for settings/preferences
7. ⏳ Add visual regression tests

## Resources

- [Playwright Docs](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging](https://playwright.dev/docs/debug)
- [CI Integration](https://playwright.dev/docs/ci)
