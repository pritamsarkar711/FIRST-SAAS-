/**
 * Triggers the emergency kill.php through a real browser (passes the
 * LiteSpeed WAF JS challenge). Used by deploy-laravel.yml.
 *
 * The account is under constant memory pressure from the legacy Node
 * crash-loop; PHP dispatch succeeds only in the windows right after the
 * OOM killer reaps bun. So we reload patiently for up to ~15 minutes.
 *
 * Env: KILL_URL = full URL of kill.php on the live site.
 */
const { chromium } = require('/tmp/pw/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  try {
    await page.goto(process.env.KILL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.log('initial goto: ' + e.message);
  }
  let triggered = false;
  // 60 reloads x 15s ~= 15 minutes of patient retries
  for (let i = 0; i < 60 && !triggered; i++) {
    try {
      const body = await page.evaluate(() =>
        document.body ? document.body.innerText : '(no body)'
      );
      const trimmed = (body || '').trim();
      if (i % 4 === 0) {
        console.log(`poll ${i}: ${trimmed.slice(0, 110).replace(/\n/g, ' | ')}`);
      }
      if (trimmed.includes('SIGKILL') || trimmed.includes('TOTAL /proc')) {
        console.log('=== CLEANER OUTPUT ===');
        console.log(trimmed.slice(0, 3000));
        triggered = true;
        break;
      }
      await page.waitForTimeout(15000);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (e) {
      console.log(`poll ${i} error: ` + e.message.split('\n')[0]);
      await page.waitForTimeout(15000);
      try {
        await page.goto(process.env.KILL_URL + '&x=' + Date.now(), {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
      } catch (e2) {
        /* keep polling */
      }
    }
  }
  if (!triggered) console.log('NOT TRIGGERED: cleaner output never appeared');
  await browser.close();
})();
