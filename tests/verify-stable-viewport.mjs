import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { withChrome } from './chrome.mjs';
const siteURL = process.env.SITE_URL || 'http://127.0.0.1:8084/';
await withChrome(async ({ page, evaluate, load, errors }) => {
  const settle = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
  const metrics = (width, height) => page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const snapshot = () => evaluate(`(()=>{
    const r=document.querySelector('#cabin'),s=r.querySelector('[data-stage]'),v=r.querySelector('[data-view]');
    return {stage:s.offsetHeight,top:s.getBoundingClientRect().top,view:v.clientHeight,section:r.offsetHeight,
      matrix:r.querySelector('[data-scene]').style.transform,beat:r.dataset.beat,
      rail:r.querySelector('[data-progress-thumb]').style.transform,y:scrollY,
      overflow:document.documentElement.scrollWidth>innerWidth};
  })()`);
  async function go(p) {
    await evaluate(`(()=>{const r=document.querySelector('#cabin'),s=r.querySelector('[data-stage]');scrollTo({top:r.offsetTop-parseFloat(s.style.top)+(r.offsetHeight-s.offsetHeight)*${p},behavior:'instant'})})()`);
    await settle();
  }
  const sitePath = new URL(siteURL).pathname;
  for (const [width, height] of [[320,568],[390,844],[430,932],[700,900],[1440,900]]) {
    await metrics(width, height);
    await load(siteURL);
    await settle();
    assert.equal(await evaluate('document.querySelectorAll("[data-small-viewport]").length'), 1);
    assert(await evaluate(`(()=>{const s=document.querySelector('[data-stage]'),m=document.querySelector('[data-small-viewport]');return Math.abs(s.offsetHeight-Math.max(innerWidth<700?320:460,m.getBoundingClientRect().height-document.querySelector('header').offsetHeight))<1})()`));
    await go(.45);
    const initial = await snapshot();
    // Model toolbar-driven innerHeight changes while native 100svh stays fixed.
    // Desktop headless Chrome has no collapsing toolbar of its own.
    for (const delta of [64, -48, 0]) {
      await evaluate(`Object.defineProperty(window,'innerHeight',{configurable:true,value:${height + delta}});dispatchEvent(new Event('resize'));`);
      await settle();
      assert.deepEqual(await snapshot(), initial, 'Toolbar-only height changes must not alter layout, camera or progress');
    }
    await evaluate("delete window.innerHeight;dispatchEvent(new Event('resize'))");
    // Freeze the probe to model native svh while the actual visible area changes.
    await evaluate(`document.querySelector('[data-small-viewport]').style.height='${height - 80}px';dispatchEvent(new Event('resize'))`);
    await go(.45);
    const small = await snapshot();
    for (const visibleHeight of [height - 80, height, height - 80]) {
      await metrics(width, visibleHeight);
      await settle();
      const next = await snapshot();
      assert.deepEqual(next, small, 'Visible viewport changes with stable svh must not reframe the scene');
      assert(!next.overflow);
    }
    console.log(`PASS stable toolbar simulation ${width}x${height}`);
  }
  // Restore native sizing and check a genuine rotation/viewport change.
  await metrics(390, 844); await load(siteURL); await settle();
  const portrait = await snapshot();
  await metrics(844, 390); await settle();
  const landscape = await snapshot();
  assert.notEqual(landscape.stage, portrait.stage, 'Real viewport changes still resize the cabin');
  assert(!landscape.overflow);
  await metrics(390,844); await load(siteURL); await settle();
  await evaluate("document.querySelector('[data-small-viewport]').style.height='764px';dispatchEvent(new Event('resize'))");
  for (const p of [0, .3, .6, .9, 1, .6, .3, 0]) { await go(p); assert(!(await snapshot()).overflow); }
  await go(.45);
  const image = await page('Page.captureScreenshot', { format: 'png' });
  writeFileSync('/tmp/husky-stable-viewport.png', Buffer.from(image.data, 'base64'));
  await evaluate("document.querySelector('[data-skip-room]').click()"); await settle();
  assert(await evaluate("document.querySelector('#cabin-rules').open && document.activeElement===document.querySelector('#cabin-rules summary')"));
  assert.equal(await evaluate('location.pathname'), sitePath, 'Fragment navigation stays on the current page');
  await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await load(siteURL); await settle();
  assert(await evaluate("document.querySelector('#cabin').offsetHeight===document.querySelector('[data-stage]').offsetHeight && document.querySelector('#cabin-rules').open"));
  assert.deepEqual(errors, []);
  console.log('PASS rotation, forward/reverse scrolling, skip link, reduced motion and network/runtime checks');
  console.log('Screenshot: /tmp/husky-stable-viewport.png');
});
