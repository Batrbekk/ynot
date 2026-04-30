import { test, expect } from '@playwright/test';

const RUN = process.env.RUN_E2E === '1';

test.describe('checkout e2e', () => {
  test.skip(!RUN, 'Set RUN_E2E=1 to run against running dev server + Stripe Test mode');

  test('successful card payment', async ({ page }) => {
    await page.goto('/');
    // Add a known seeded item to cart.
    await page.click('a[href*="/products/"]');
    await page.click('button:has-text("Add to bag")');
    await page.goto('/checkout/shipping');
    await page.fill('input[name="email"]', 'guest@example.com');
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'Buyer');
    await page.fill('input[name="line1"]', '1 Test St');
    await page.fill('input[name="city"]', 'London');
    await page.fill('input[name="postcode"]', 'SW1A 1AA');
    await page.fill('input[name="phone"]', '+447700900000');
    await page.selectOption('select[name="countryCode"]', 'GB');
    await page.waitForSelector('input[type="radio"][name="method"]');
    await page.click('input[type="radio"][name="method"]');
    await page.click('button:has-text("Continue to payment")');

    // Stripe Elements iframe.
    const cardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    await cardFrame.locator('input[name="number"]').fill('4242 4242 4242 4242');
    await cardFrame.locator('input[name="expiry"]').fill('12 / 30');
    await cardFrame.locator('input[name="cvc"]').fill('123');
    await cardFrame.locator('input[name="postal"]').fill('SW1A 1AA');

    await page.click('button:has-text("Pay")');
    await page.waitForURL(/\/checkout\/success\//, { timeout: 30_000 });
    await expect(page.getByText(/Payment received/i)).toBeVisible({ timeout: 30_000 });
  });
});
