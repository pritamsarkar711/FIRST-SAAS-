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
      const content = await page.content();
      if (content.includes('KILLED')) {
        console.log('TRIGGERED: ' + (content.match(/KILLED[^\n<]*/) || [''])[0]);
        triggered = true;
        break;
      }
      await page.waitForTimeout(3000);
    }
    if (!triggered) console.log('NOT TRIGGERED: KILLED marker never appeared');
  } catch (e) {
    console.log('browser error: ' + e.message);
  }
  await browser.close();
})();
