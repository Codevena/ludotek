import { chromium } from "playwright";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve(__dirname, "../docs/screenshots");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  console.warn(`Taking screenshots from ${BASE_URL}...`);

  // Home page
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "home.png"),
    fullPage: false,
  });
  console.warn("Saved: docs/screenshots/home.png");

  await browser.close();
  console.warn("Done!");
}

main().catch((err) => {
  console.error("Screenshot failed:", err);
  process.exit(1);
});
