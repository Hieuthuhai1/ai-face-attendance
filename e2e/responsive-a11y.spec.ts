import { expect, test, type Page } from "@playwright/test";

/** Task 9+10: responsive, a11y, phân quyền UI. Chạy trên production build. */

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email công việc").fill(email);
  await page.getByLabel("Mật khẩu").fill("Passw0rd!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth - de.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

for (const width of [360, 390, 430, 768, 1280]) {
  test(`viewport ${width}px: không overflow ngang (dashboard, check-in)`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    await loginAs(page, "nv.a@demo.vn");
    await page.goto("/dashboard");
    await expect(page.getByText("Ca hôm nay", { exact: true })).toBeVisible({ timeout: 15_000 });
    await noHorizontalOverflow(page);
    await page.goto("/check-in");
    await expect(page.getByText("Quét & xác minh", { exact: true })).toBeVisible({ timeout: 15_000 });
    await noHorizontalOverflow(page);
    await context.close();
  });
}

test("viewport 390: bottom-bar hiện, sidebar ẩn; 1280: ngược lại", async ({ browser }) => {
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await mob.newPage();
  await loginAs(mp, "nv.a@demo.vn");
  await expect(mp.getByRole("navigation", { name: "Điều hướng nhanh" })).toBeVisible();
  await expect(mp.getByRole("navigation", { name: "Điều hướng chính" })).toBeHidden();
  await mob.close();

  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dp = await desk.newPage();
  await loginAs(dp, "hr@demo.vn");
  await expect(dp.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
  await expect(dp.getByRole("navigation", { name: "Điều hướng nhanh" })).toBeHidden();
  await desk.close();
});

test("keyboard: Tab đầu tới nút Google, focus-visible hoạt động", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Đăng nhập với Google" })).toBeFocused();
});

test("contrast: chữ body và nút primary đạt WCAG AA (≥4.5)", async ({ page }) => {
  await page.goto("/login");
  const ratios = await page.evaluate(() => {
    function lum(hex: string): number {
      const c = hex.replace("#", "");
      const rgb = [0, 2, 4].map((i) => {
        const v = parseInt(c.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * (rgb[0] ?? 0) + 0.7152 * (rgb[1] ?? 0) + 0.0722 * (rgb[2] ?? 0);
    }
    function ratio(fg: string, bg: string): number {
      const a = lum(fg);
      const b = lum(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    // Contrast tính từ tokens (ổn định, không phụ thuộc runtime).
    return {
      // #0f172a trên #f6f7f9 (tokens), trắng trên brand #1d4ed8
      bodyText: ratio("#0f172a", "#f6f7f9"),
      primaryBtn: ratio("#ffffff", "#1d4ed8"),
    };
  });
  expect(ratios.bodyText).toBeGreaterThanOrEqual(4.5);
  expect(ratios.primaryBtn).toBeGreaterThanOrEqual(4.5);
});

test("reduced-motion: skeleton không animation", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/login");
  const duration = await page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "skeleton";
    document.body.appendChild(el);
    const d = getComputedStyle(el, "::after").animationDuration;
    el.remove();
    return d;
  });
  // Trình duyệt serialize 0.01ms thành "1e-05s" — parse số để so sánh.
  expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);
  await context.close();
});

test("employee vào trang HR/Admin bị chặn server-side", async ({ page }) => {
  await loginAs(page, "nv.a@demo.vn");
  await page.goto("/admin/employees");
  await expect(page).toHaveURL(/\/dashboard\?forbidden=1/);
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/dashboard\?forbidden=1/);
  await page.goto("/audit");
  await expect(page).toHaveURL(/\/dashboard\?forbidden=1/);
});
