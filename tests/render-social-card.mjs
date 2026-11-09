import { withChrome } from './chrome.mjs';
import { writeFileSync } from 'node:fs';
await withChrome(async ({ page, load, errors }) => {
  await page('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await load(new URL('../docs/social-card.html', import.meta.url).href);
  if (errors.length) throw Error(errors.join('\n'));
  const { data } = await page('Page.captureScreenshot', { format: 'png' });
  writeFileSync(new URL('../site/images/social-card.png', import.meta.url), Buffer.from(data, 'base64'));
  console.log('Rendered site/images/social-card.png, 1200x630');
});
