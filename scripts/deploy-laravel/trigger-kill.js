/**
 * Triggers the emergency kill.php through a real browser (passes the
 * LiteSpeed WAF JS challenge). Used by deploy-laravel.yml.
 * Env: KILL_URL = full URL of kill.php on the live site.
 */
const { chromium } = require('/tmp/pw/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  try {
    await page.goto(process.env.KILL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    let triggered = false;
    for (let i = 0; i < 24; i++) {
      const body = await page.evaluate(() =>
        document.body ? document.body.innerText : '(no body)'
      );
      const trimmed = (body || '').trim();
      if (i % 4 === 0) {
        console.log(`poll ${i}: ${trimmed.slice(0, 140).replace(/\n/g, ' | ')}`);
      }
      if (trimmed.includes('SIGKILL') || trimmed.includes('TOTAL /proc')) {
        console.log('=== CLEANER OUTPUT ===');
        console.log(trimmed.slice(0, 3000));
        triggered = true;
        break;
      }
      await page.waitForTimeout(3000);
    }
    if (!triggered) console.log('NOT TRIGGERED: cleaner output never appeared');
  } catch (e) {
    console.log('browser error: ' + e.message);
  }
  await browser.close();
})();
