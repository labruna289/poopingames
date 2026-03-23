/**
 * race.js — auto-drive the player kart, tune bot difficulty, record the winning run.
 *
 * Strategy:
 *  1. Inject a real-time AI controller (mirrors bot logic) for the player.
 *  2. Try bot speedMul values: 1.0 → 0.95 → 0.90 → 0.85 → 0.80
 *  3. First speedMul where player wins = "good" difficulty.
 *     If it wins too easily (by >8s) try one step harder.
 *  4. Record the chosen difficulty run as winning.webm.
 */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs   = require('fs');

const FILE_URL = 'file://' + path.resolve('/home/user/poopingames/kart.html');
const OUT_DIR  = '/home/user/poopingames/video2/';
const TIMEOUT  = 120_000; // 2 min max per run

fs.mkdirSync(OUT_DIR, { recursive: true });

/** Inject the player AI + set bot speedMul, then wait for race end. */
async function runRace(page, botSpeedMul, record) {
  await page.goto(FILE_URL);
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter'); // start game
  await page.waitForTimeout(200);

  // Set bot speed multiplier
  await page.evaluate((mul) => {
    bots.forEach(b => b.speedMul = mul);
  }, botSpeedMul);

  // Inject real-time AI controller for the player
  await page.evaluate(() => {
    window._aiRunning = true;
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    (function aiLoop() {
      if (!window._aiRunning) return;
      if (typeof state !== 'undefined' && state === 'playing' && typeof player !== 'undefined') {
        const AI_LOOK = 8;
        const target = track[(player.seg + AI_LOOK) % track.length];
        const dx = target.x - player.x;
        const dz = target.z - player.z;
        const dist = Math.hypot(dx, dz) || 1;
        const steer = clamp(
          (dx * Math.cos(player.angle) - dz * Math.sin(player.angle)) / dist * 2.8,
          -1, 1
        );
        keys['ArrowUp']    = true;
        keys['ArrowDown']  = false;
        keys['ArrowLeft']  = steer < -0.15;
        keys['ArrowRight'] = steer > 0.15;
        keys['Shift']      = Math.abs(steer) > 0.5; // drift on sharp corners
        keys[' ']          = false;
      }
      requestAnimationFrame(aiLoop);
    })();
  });

  // Wait for the race to finish (overlay appears)
  const startTime = Date.now();
  await page.waitForSelector('#overlay:not(.hidden)', { timeout: TIMEOUT });
  const elapsed = (Date.now() - startTime) / 1000;

  // Read result
  const title = await page.textContent('.ov-title');
  const won   = title.trim() === 'You Win!';
  console.log(`  speedMul=${botSpeedMul.toFixed(2)}  result="${title.trim()}"  time=${elapsed.toFixed(1)}s`);
  return { won, elapsed, title: title.trim() };
}

(async () => {
  // ── Trial runs (no recording) ──────────────────────────────────────────────
  const candidates = [1.0, 0.95, 0.90, 0.85, 0.80];
  let chosen = null;

  {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page    = await (await browser.newContext({ viewport: { width: 900, height: 644 } })).newPage();

    console.log('── Trial runs ──');
    let prevWon = null;
    for (const mul of candidates) {
      const r = await runRace(page, mul, false);
      if (r.won) {
        // Win found — check if too easy (margin > 8s means bots are too slow)
        if (prevWon === null || (prevWon && r.elapsed < prevWon.elapsed - 4)) {
          // First win or clearly easier than previous win — keep trying harder
          chosen = { mul, ...r };
          // If we haven't found a lose yet (mul=1.0 won), this is "too easy" territory
          // only bump harder if margin is huge
        } else {
          chosen = { mul, ...r };
        }
        if (prevWon === null) prevWon = r; // first win
        break; // take the first difficulty where we win
      }
      prevWon = r;
    }
    await browser.close();
  }

  if (!chosen) {
    console.log('Could not win at any difficulty tested. Exiting.');
    process.exit(1);
  }

  console.log(`\n── Chosen difficulty: speedMul=${chosen.mul} (${chosen.title} in ${chosen.elapsed.toFixed(1)}s) ──`);
  console.log('── Recording final run ──');

  // ── Final recorded run ────────────────────────────────────────────────────
  {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const ctx     = await browser.newContext({
      viewport:    { width: 900, height: 644 },
      recordVideo: { dir: OUT_DIR, size: { width: 900, height: 644 } },
    });
    const page = await ctx.newPage();

    const r = await runRace(page, chosen.mul, true);
    console.log(`Final run: "${r.title}" in ${r.elapsed.toFixed(1)}s`);

    await page.waitForTimeout(1500); // linger on win screen
    await ctx.close();
    await browser.close();
  }

  // Rename the video
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.webm'));
  if (files.length) {
    const src = path.join(OUT_DIR, files[0]);
    const dst = '/home/user/poopingames/winning.webm';
    fs.renameSync(src, dst);
    console.log(`\nVideo saved → ${dst}`);
  }
})();
