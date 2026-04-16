import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve(__dirname, "../docs/screenshots");

const PAGES = [
  { name: "home", path: "/" },
  { name: "timeline", path: "/timeline" },
  { name: "insights", path: "/insights" },
  { name: "discover", path: "/discover" },
  { name: "devices", path: "/devices" },
];

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  // Set dark theme in localStorage before navigating
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("theme", "dark");
  });

  console.warn(`Taking screenshots from ${BASE_URL}...`);

  for (const { name, path: pagePath } of PAGES) {
    await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: "networkidle" });
    // Wait for styles and content to render
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${name}.png`),
      fullPage: false,
    });
    console.warn(`Saved: docs/screenshots/${name}.png`);
  }

  await browser.close();
  console.warn("Done!");
}

main().catch((err) => {
  console.error("Screenshot failed:", err);
  process.exit(1);
});
