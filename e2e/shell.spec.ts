import { expect, test } from "@playwright/test";

/** R3 smoke: AppShell theo role + guard. Cần dev server + local Supabase seed. */
test("anon vào dashboard bị đẩy về login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("HR login thấy sidebar + topbar + đăng xuất được", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email công việc").fill("hr@demo.vn");
  await page.getByLabel("Mật khẩu").fill("Passw0rd!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByText("Ca hôm nay")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible({ timeout: 15_000 });
  const sidebar = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(sidebar.getByRole("link", { name: "Nhân viên", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("mobile hiện bottom-bar, không sidebar", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email công việc").fill("nv.a@demo.vn");
  await page.getByLabel("Mật khẩu").fill("Passw0rd!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("navigation", { name: "Điều hướng nhanh" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeHidden();
  await context.close();
});
