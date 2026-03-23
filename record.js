const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 800, height: 500 },
    recordVideo: { dir: '/home/user/poopingames/video/', size: { width: 800, height: 500 } },
  });
  const page = await ctx.newPage();

  const filePath = 'file://' + path.resolve('/home/user/poopingames/kart.html');
  await page.goto(filePath);
  await page.waitForTimeout(500);

  // Start the game
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);

  // Helper: hold a set of keys for a duration
  async function hold(keys, ms) {
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    for (const k of keys) await page.keyboard.up(k);
  }

  // Drive forward to pick up speed
  await hold(['ArrowUp'], 1200);

  // Jump while driving
  await hold(['ArrowUp', 'Space'], 120);
  await page.waitForTimeout(200);

  // More speed
  await hold(['ArrowUp'], 800);

  // Drift left (Shift + ArrowLeft + gas)
  await hold(['ArrowUp', 'ArrowLeft', 'Shift'], 1400);

  // Straighten out, let boost fire
  await hold(['ArrowUp'], 600);

  // Jump again
  await hold(['ArrowUp', 'Space'], 120);
  await page.waitForTimeout(300);

  // Drift right
  await hold(['ArrowUp', 'ArrowRight', 'Shift'], 1400);

  // Boost straight
  await hold(['ArrowUp'], 700);

  // Jump mid-corner
  await hold(['ArrowUp', 'ArrowLeft'], 300);
  await hold(['ArrowUp', 'ArrowLeft', 'Space'], 120);
  await hold(['ArrowUp', 'ArrowLeft'], 500);

  // Drift left again, tighten then widen
  await hold(['ArrowUp', 'ArrowLeft', 'Shift'], 800);
  // counter-steer while still drifting to widen
  await hold(['ArrowUp', 'ArrowRight', 'Shift'], 600);
  await hold(['ArrowUp'], 500);

  // Final sequence
  await hold(['ArrowUp', 'Space'], 120);
  await page.waitForTimeout(400);
  await hold(['ArrowUp', 'ArrowLeft', 'Shift'], 1200);
  await hold(['ArrowUp'], 800);

  await page.waitForTimeout(500);
  await ctx.close();
  await browser.close();
  console.log('Done');
})();
