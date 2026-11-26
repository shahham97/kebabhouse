import { expect, test } from '@playwright/test';

test.describe('Star Kebab — End-to-End Platform, Role Auth & Responsive Journeys', () => {
  test('Test 1: Separate Role Logins + Form Validation + Responsive Mobile (390px) & Desktop', async ({
    page,
  }) => {
    // 1. Mobile viewport (390x844) responsiveness check across public + auth routes
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['/', '/menu', '/admin/login', '/staff/login', '/account/login']) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow, `Horizontal overflow on mobile ${route}`).toBeLessThanOrEqual(4);
    }

    // 2. Desktop viewport for role separation & validation checks
    await page.setViewportSize({ width: 1280, height: 800 });

    // Unauthenticated redirects go to their own role-specific login routes
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.goto('/till');
    await expect(page).toHaveURL(/\/staff\/login/);

    await page.goto('/account');
    await expect(page).toHaveURL(/\/account\/login/);

    // Client-side Zod validation on /admin/login
    await page.goto('/admin/login');
    await page.locator('#admin-email').fill('bad-email');
    await page.locator('#admin-password').fill('123');
    await page.getByRole('button', { name: /Sign In to Admin Portal/i }).click();
    await expect(page.getByText(/valid work email/i).first()).toBeVisible();

    // Counter Staff (staff@starkebab.com.au) is REJECTED on /admin/login
    await page.locator('#admin-email').fill('staff@starkebab.com.au');
    await page.locator('#admin-password').fill('StarStaff123!');
    await page.getByRole('button', { name: /Sign In to Admin Portal/i }).click();
    await expect(page.getByRole('alert')).toContainText(/Staff Login/i, { timeout: 20000 });

    // Customer Login on /account/login works for Oliver Smith
    await page.goto('/account/login');
    await page.locator('#cust-email').fill('oliver@starkebab.com.au');
    await page.locator('#cust-password').fill('Customer123!');
    await page.getByRole('button', { name: /Sign In to Star Rewards/i }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 30000 });
    await expect(page.getByText(/Oliver Smith/i).first()).toBeVisible();
  });

  test('Test 2: Storefront Journey — Home -> Menu -> Customize -> Checkout (STAR15) -> Live Tracker', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/CARVED OFF THE/i);
    await expect(page.getByText(/Active Combos & Deals/i)).toBeVisible();

    await page.goto('/menu');
    await expect(page.getByText('Signature Charcoal Kebab').first()).toBeVisible();

    await page.getByText('Signature Charcoal Kebab').first().click();
    const dialog = page.getByRole('dialog', { name: 'Signature Charcoal Kebab' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Increase quantity' }).click();
    await dialog.getByRole('button', { name: /Add to Order/i }).click();
    await expect(dialog).toBeHidden();

    await page.goto('/checkout');
    await expect(page.getByText(/1\. Fulfilment & Timing/i)).toBeVisible();

    await page.getByRole('button', { name: /Pickup \(Free\)/i }).click();

    await page.getByPlaceholder('Charlotte Taylor').fill('Charlotte Taylor');
    await page.getByPlaceholder('0412 345 678').fill('0412 345 678');
    await page.getByPlaceholder('charlotte.taylor@example.com.au').fill('charlotte.taylor@example.com.au');

    await page.getByPlaceholder('Try STAR15 or WELCOME5').fill('STAR15');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.getByText(/Discount \(STAR15\)/i)).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Pay .* & Place Order/i }).click();

    await expect(page).toHaveURL(/\/order\/ord_/, { timeout: 45000 });
    await expect(page.getByText('Live Order Tracker', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/#SK-\d+/);
    await expect(page.getByText(/Order Received/i).first()).toBeVisible();
    await expect(page.getByText(/Tax Invoice Summary/i)).toBeVisible();
  });

  test('Test 3: Admin Login (Usama) -> Till Dine-In -> Kebab KDS -> Serve -> Cash Payment -> Auto-Complete + RBAC', async ({
    page,
  }) => {
    // 1. Sign in as Usama (Owner) via /admin/login
    await page.goto('/admin/login');
    await page.locator('#admin-email').fill('admin@starkebab.com.au');
    await page.locator('#admin-password').fill('StarAdmin123!');
    await page.getByRole('button', { name: /Sign In to Admin Portal/i }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 45000 });
    await expect(page.getByText(/Usama/i).first()).toBeVisible();

    // 2. Open /till and create Dine-In Table 9 order
    await page.goto('/till');
    await expect(page.getByText('STAR KEBAB TILL')).toBeVisible();

    const uniqueGuest = `Liam Guest ${Date.now()}`;
    await page.getByRole('button', { name: 'Dine-in', exact: true }).click();
    await page.getByPlaceholder('Table # (e.g. 5) *').fill('9');
    await page.getByPlaceholder('Customer name').fill(uniqueGuest);

    await page.locator('[role="button"]', { hasText: 'Signature Charcoal Kebab' }).first().click();
    await page.getByRole('button', { name: /^Add to Order$/i }).click();
    await page.getByRole('button', { name: /Place Order ·/i }).click();

    await expect(page.getByText(uniqueGuest).first()).toBeVisible({ timeout: 35000 });

    // 3. Switch to /station/kebab dark-mode KDS and bump PREPARING -> READY
    await page.goto('/station/kebab');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Kebab Station/i);

    const kdsTicket = page.locator('article', { hasText: uniqueGuest }).first();
    await expect(kdsTicket).toBeVisible({ timeout: 30000 });
    const kdsText = (await kdsTicket.textContent()) ?? '';
    const match = kdsText.match(/#SK-\d+/);
    expect(match).not.toBeNull();
    const orderNumber = match![0];

    await kdsTicket.getByRole('button', { name: /^PREPARING$/i }).click();
    await expect(kdsTicket.getByRole('button', { name: /^PREPARING$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 30000 }
    );
    await kdsTicket.getByRole('button', { name: /^READY$/i }).click();
    await expect(kdsTicket).toBeHidden({ timeout: 30000 });

    // 4. Return to /till -> Ready -> Mark Served -> Take Cash Payment -> Auto-Complete
    await page.goto('/till');
    await page.getByRole('button', { name: /Live Operations Board/i }).click();
    await page.getByRole('button', { name: /^Ready\b/i }).click();

    const readyCard = page
      .locator('div.rounded-2xl', { hasText: orderNumber })
      .filter({ hasText: /Mark Served \(Table 9\)/i })
      .first();
    await expect(readyCard).toBeVisible({ timeout: 30000 });
    await readyCard.getByRole('button', { name: /Mark Served \(Table 9\)/i }).click();

    await page.getByRole('button', { name: /Served – Awaiting Payment/i }).click();
    const servedCard = page
      .locator('div.rounded-2xl', { hasText: orderNumber })
      .filter({ hasText: /Take Payment/i })
      .first();
    await expect(servedCard).toBeVisible({ timeout: 30000 });
    await servedCard.getByRole('button', { name: /Take Payment/i }).click();

    await expect(page.getByText(`Take Payment · ${orderNumber}`)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '$20', exact: true }).click();
    await page.getByRole('button', { name: /Record CASH ·/i }).click();
    await expect(page.getByText(/auto-completed/i)).toBeVisible({ timeout: 35000 });

    await page.getByRole('button', { name: /Order History/i }).click();
    await expect(page.getByText(orderNumber).first()).toBeVisible({ timeout: 30000 });

    // 5. Verify Counter Staff on /staff/login reaches /till but is blocked from /admin/finance
    await page.context().clearCookies();
    await page.goto('/staff/login');
    await page.locator('#staff-email').fill('staff@starkebab.com.au');
    await page.locator('#staff-password').fill('StarStaff123!');
    await page.getByRole('button', { name: /Sign In to Staff Portal/i }).click();
    await expect(page).toHaveURL(/\/till/, { timeout: 30000 });

    await page.goto('/admin/finance');
    const bodyText = (await page.locator('body').textContent()) ?? '';
    expect(/access denied|forbidden|403|permission/i.test(bodyText)).toBe(true);
  });
});
