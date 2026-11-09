import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withChrome } from './chrome.mjs';
const base = process.env.SITE_URL || 'http://127.0.0.1:8084/';
await withChrome(async ({ page, evaluate, load, errors }) => {
  for (const path of ['', '2025/', 'current-game-overlay.html', 'standings-overlay.html']) {
    for (const width of [390, 1440]) {
      await page('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await load(new URL(path, base).href);
      assert.deepEqual(await evaluate('[...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src)'), [], `Broken images: ${path}`);
      assert(await evaluate('[...document.styleSheets].some(s => s.href && s.cssRules.length)'), `Styles missing: ${path}`);
      if (!path) {
        assert.equal(await evaluate('document.querySelector("link[rel=canonical]").href'), 'https://huskyholiday.win/');
        assert.equal(await evaluate('[...document.links].filter(a => new URL(a.href).pathname.startsWith("/2025/")).length'), 0);
      } else if (path === '2025/') {
        assert.equal(await evaluate('document.title'), 'Husky Raid Holiday Tournament 2025');
        assert(await evaluate('document.body.innerText.includes("Saturday December 13th")'));
        assert(await evaluate('document.body.scrollWidth <= innerWidth + 1'), `Archive overflows at ${width}`);
        assert(await evaluate('[...document.links].filter(a => !a.hash).every(a => a.href.startsWith("https://"))'));
      }
      const { data } = await page('Page.captureScreenshot', { format: 'png' });
      const shot = join(tmpdir(), `husky-release-${path.replace(/\W/g, '') || '2026'}-${width}.png`);
      writeFileSync(shot, Buffer.from(data, 'base64'));
      console.log(`PASS ${path || '/'} at ${width}px. Screenshot ${shot}`);
    }
  }
  assert.deepEqual(errors, [], 'Browser exceptions or failed requests');
  console.log('PASS release pages and overlays: no failed requests or JavaScript exceptions');
});
