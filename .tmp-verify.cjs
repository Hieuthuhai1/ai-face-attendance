const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  await page.goto("https://ai-face-attendance-zeta.vercel.app/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "nv.a@demo.vn");
  await page.fill('input[name="password"]', "Passw0rd!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|check-in|enrollment/, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log("after login:", page.url());

  await page.goto("https://ai-face-attendance-zeta.vercel.app/check-in", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  console.log("has_demo_phrase:", body.includes("nhận diện mô phỏng"));
  console.log("has_demo_badge:", /DEMO\s*MODE|DEMO —/.test(body));
  console.log("url:", page.url());
  await page.screenshot({ path: "C:/Users/THIS PC/AppData/Local/Temp/opencode/prod-checkin.png" });

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
