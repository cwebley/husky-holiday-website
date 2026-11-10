// Start the static site on port 8083, then run: node tests/verify-page.mjs
// Local Chrome + Node's built-in WebSocket. No npm dependencies.
// Optional overrides: CHROME_PATH, PAGE_URL, SCREENSHOT_DIR.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const url = process.env.PAGE_URL || 'http://127.0.0.1:8083/';
const shots = process.env.SCREENSHOT_DIR || '/tmp';
const surveyURL = 'https://app.rallly.co/poll/H9KAVvkKt5yb';
const viewports = [[320, 568], [390, 844], [430, 932], [700, 900], [1440, 900], [1920, 900]];
const profile = mkdtempSync(join(tmpdir(), 'husky-page-'));
const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
]);
let socket;
const errors = [];
const deadline = setTimeout(() => {
  console.error('FAIL: page verification exceeded 120 seconds');
  chrome.kill();
  process.exitCode = 1;
}, 120000);
try {
  const endpoint = await new Promise((resolve, reject) => {
    chrome.on('error', reject);
    chrome.once('exit', code => reject(Error(`Chrome exited before connecting: ${code}`)));
    let log = '';
    chrome.stderr.on('data', chunk => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) resolve(match[1]);
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params.exceptionDetails;
      errors.push(detail.exception?.description || `${detail.text} at ${detail.url}:${detail.lineNumber}`);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(`console.error: ${message.params.args.map(a => a.value ?? a.description).join(' ')}`);
    }
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => {
      pending.delete(key);
      reject(Error(`CDP timed out: ${method}`));
    }, 15000);
    pending.set(key, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: key, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params = {}) => call(method, params, sessionId);
  const evaluate = async expression => {
    const response = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    assert(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const settle = () => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
  const viewport = async (width, height) => {
    await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await settle();
  };
  const load = async () => {
    const result = await page('Page.navigate', { url });
    assert(!result.errorText, `Navigation failed: ${result.errorText}`);
    // Wait for this navigation, not the previous document's complete readyState.
    await evaluate(`new Promise((resolve, reject) => {
      const start = performance.now();
      const check = () => {
        if (location.href === ${JSON.stringify(url)} && document.readyState === 'complete') resolve();
        else if (performance.now() - start > 10000) reject(Error('Page did not finish loading'));
        else setTimeout(check, 20);
      };
      check();
    })`);
    await evaluate('document.fonts.ready.then(() => true)');
    await evaluate('scrollTo({ top: 0, left: 0, behavior: "instant" })');
    await settle();
    assert.equal(await evaluate('document.querySelectorAll("#main-content").length'), 1);
    assert.equal(await evaluate('document.querySelectorAll("footer").length'), 1);
    const { nodes } = await page('Accessibility.getFullAXTree');
    const spoken = nodes.filter(n => !n.ignored && n.role?.value === 'StaticText').map(n => n.name?.value).join(' ');
    for (const text of ['Game 1: won 3 to 2, gaining 1 point.', 'Game 2: won 2 to 0, gaining 2 points.', 'Game 3: won 3 to 1, gaining 2 points.', 'Game 4: lost 0 to 1, losing 1 point.', 'Total across 4 games: gained 4 points.']) {
      assert(spoken.includes(text), `Missing spoken scoring explanation: ${text}`);
    }
    assert(!spoken.includes('3–2'), 'Do not read the visual score as subtraction');
    assert(await evaluate(`!document.querySelector('[data-band]').closest('[aria-hidden="true"]') && [...document.querySelectorAll('[data-cap]')].every(e => e.getAttribute('aria-hidden') === 'true') && document.querySelector('[data-cap="rules"] a').tabIndex === -1 && document.querySelector('[data-skip-room]').tabIndex === 0`), 'Expose skip navigation while keeping animated captions hidden from screen readers');
    assert(await evaluate(`['maps-title', 'prizes-title'].every(id => document.getElementById(id).closest('section').classList.contains('visually-hidden'))`));
    await call('Target.activateTarget', { targetId });
    await page('Emulation.setFocusEmulationEnabled', { enabled: true });
    const wasOpen = await evaluate(`document.querySelector('#cabin-rules').open`);
    await evaluate(`document.querySelector('#cabin-rules summary').focus()`);
    await settle();
    await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
    await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await settle();
    assert.equal(await evaluate(`document.querySelector('#cabin-rules').open`), !wasOpen, 'Rules disclosure responds to keyboard');
    if (!wasOpen) {
      const expanded = await page('Accessibility.getFullAXTree');
      assert(expanded.nodes.some(n => !n.ignored && n.name?.value?.includes('Come and go as you please.')), 'Expanded rules are readable');
    }
    await evaluate(`document.querySelector('#cabin-rules').open = ${wasOpen}; document.activeElement.blur(); scrollTo({top:0,behavior:'instant'})`);
    await settle();
    for (const name of ['The maps', 'Prizes']) {
      assert.equal(nodes.filter(n => !n.ignored && n.role?.value === 'heading' && n.name?.value === name).length, 1, `Stable cabin heading: ${name}`);
    }
  };
  const scroll = async top => {
    await evaluate(`scrollTo({top: ${top}, left: 0, behavior: 'instant'})`);
    await settle();
  };
  const screenshot = async name => {
    const result = await page('Page.captureScreenshot', { format: 'png' });
    const path = join(shots, `husky-swatchkit-${name}.png`);
    writeFileSync(path, Buffer.from(result.data, 'base64'));
    console.log(`Screenshot ${path}`);
  };
  const scrollSection = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: 'start', behavior: 'instant'})`);
    await settle();
  };
  const layout = () => evaluate(`(() => {
    const main = document.querySelector('#main-content'), footer = document.querySelector('footer');
    const style = element => {
      const s = getComputedStyle(element);
      return {position:s.position, z:s.zIndex, transform:s.transform, translate:s.translate,
        rotate:s.rotate, scale:s.scale, opacity:s.opacity, background:s.backgroundColor};
    };
    const rect = element => element.getBoundingClientRect().toJSON();
    const ancestors = [];
    for (let e = footer.parentElement; e; e = e.parentElement) ancestors.push(style(e));
    const probe = document.createElement('i');
    probe.style.color = 'var(--color-ground, var(--ground))';
    document.body.append(probe);
    const ground = getComputedStyle(probe).color;
    probe.remove();
    return {siblings:main.parentElement === footer.parentElement,
      following:!!(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING),
      main:style(main), footer:style(footer), ancestors, ground,
      mainRect:rect(main), footerRect:rect(footer), y:scrollY,
      max:document.documentElement.scrollHeight-innerHeight, height:innerHeight, width:innerWidth};
  })()`);
  const noTransform = (style, label) => {
    for (const property of ['transform', 'translate', 'rotate', 'scale']) {
      assert.equal(style[property], 'none', `${label} has ${property}: ${style[property]}`);
    }
  };
  const checkLayers = async (label, reduced = false) => {
    const state = await layout();
    assert(state.siblings && state.following, `${label}: main and footer must be ordered siblings`);
    assert.equal(state.main.z, '1', `${label}: main z-index`);
    assert.equal(state.footer.z, '0', `${label}: footer z-index`);
    const flowFallback = reduced || state.height <= 720 || state.width <= 700 || state.footerRect.height > state.height;
    assert(flowFallback ? ['sticky', 'static', 'relative'].includes(state.footer.position) : state.footer.position === 'sticky',
      `${label}: unexpected footer positioning ${state.footer.position}`);
    noTransform(state.main, `${label} main`);
    noTransform(state.footer, `${label} footer`);
    state.ancestors.forEach((s, i) => noTransform(s, `${label} footer ancestor ${i}`));
    assert.equal(state.main.opacity, '1', `${label}: main must not be translucent`);
    assert.equal(state.main.background, state.ground, `${label}: main must use opaque ground`);
    assert(/^rgb\(/.test(state.main.background) || /,\s*1\)$/.test(state.main.background), `${label}: transparent main ground`);
    return state;
  };
  const checkOverflow = async label => {
    const result = await evaluate(`(() => {
      const offenders = [];
      for (const e of document.querySelectorAll('body *')) {
        if (e.closest('#cabin') || e instanceof SVGElement || ['SCRIPT','STYLE','LINK','CANVAS'].includes(e.tagName)) continue;
        const s = getComputedStyle(e), r = e.getBoundingClientRect();
        if (!r.width || !r.height || s.visibility === 'hidden' || s.display === 'none') continue;
        let left = r.left, right = r.right;
        // Decorative bleed clipped inside a component does not overflow the page.
        for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
          if (['hidden','clip','auto','scroll'].includes(getComputedStyle(a).overflowX)) {
            const ar = a.getBoundingClientRect(); left = Math.max(left, ar.left); right = Math.min(right, ar.right);
          }
        }
        if (right > left && (left < -1 || right > innerWidth + 1)) offenders.push({tag:e.tagName,id:e.id,left,right});
      }
      return {width:innerWidth, scrollWidth:document.documentElement.scrollWidth, offenders:offenders.slice(0,12)};
    })()`);
    assert(result.scrollWidth <= result.width + 1, `${label}: document horizontal overflow ${JSON.stringify(result)}`);
    assert.deepEqual(result.offenders, [], `${label}: elements overflow outside the cabin`);
  };
  const checkFonts = async () => {
    const result = await evaluate(`(async () => {
      const specifications = [{family:'Fraunces',min:100,max:900},{family:'Nunito',min:200,max:1000}];
      const requested = [];
      for (const {family,min,max} of specifications) for (const style of ['normal','italic']) {
        for (let weight=min; weight<=max; weight+=100) {
          const query = style + ' ' + weight + ' 20px "' + family + '"';
          const loaded = await document.fonts.load(query, 'Holiday Raid 2026');
          requested.push({query, count:loaded.length, ready:document.fonts.check(query, 'Holiday Raid 2026')});
        }
      }
      await document.fonts.ready;
      return {status:document.fonts.status, requested, faces:[...document.fonts].map(f=>({family:f.family.replace(/['"]/g,''), style:f.style, weight:f.weight, status:f.status}))};
    })()`);
    assert.equal(result.status, 'loaded');
    for (const request of result.requested) assert(request.count > 0 && request.ready, `Font not loaded: ${request.query}`);
    for (const [family, min, max] of [['Fraunces', 100, 900], ['Nunito', 200, 1000]]) {
      for (const style of ['normal', 'italic']) {
        const face = result.faces.find(f => f.family === family && f.style === style);
        assert(face, `Missing ${style} ${family} font face`);
        assert.equal(face.weight, `${min} ${max}`, `${family} must declare its full variable weight range`);
        assert.equal(face.status, 'loaded', `${family} ${style} must load`);
      }
    }
  };
  const checkSurvey = async () => {
    const links = await evaluate(`[...document.querySelectorAll('a')].filter(a => /survey|vote.*date/i.test(a.textContent) || a.href.includes('rallly.co')).map(a => ({text:a.textContent.trim(),href:a.href}))`);
    assert(links.length >= 2, 'Expected survey links in the hero and footer');
    links.forEach(link => assert.equal(link.href, surveyURL, `Survey destination changed: ${link.text}`));
  };
  const checkFAQ = async () => {
    const count = await evaluate('document.querySelectorAll("#faq details > summary").length');
    assert(count > 0, 'FAQ has no native disclosure controls');
    for (let i = 0; i < count; i++) {
      await evaluate(`document.querySelectorAll('#faq details')[${i}].open = false`);
      await evaluate(`document.querySelectorAll('#faq details > summary')[${i}].scrollIntoView({block:'center',behavior:'instant'})`);
      await settle();
      const point = await evaluate(`(() => {const r=document.querySelectorAll('#faq details > summary')[${i}].getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
      await page('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
      await page('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
      await settle();
      assert(await evaluate(`(() => {const d=document.querySelectorAll('#faq details')[${i}];return d.open && [...d.children].some(e=>e.tagName!=='SUMMARY'&&e.getBoundingClientRect().height>0)})()`), `FAQ ${i + 1} did not open after a real click`);
      await evaluate(`document.querySelectorAll('#faq details')[${i}].open = false`);
    }
  };
  const footerReveal = async (width, reduced = false, capture = false) => {
    const initial = await checkLayers(`${width} footer`, reduced);
    const start = Math.max(0, initial.max - initial.footerRect.height);
    const steps = [0, .2, .4, .6, .8, 1];
    let previous;
    const positions = new Map();
    for (const direction of ['forward', 'reverse']) {
      for (const progress of direction === 'forward' ? steps : [...steps].reverse()) {
        await scroll(start + (initial.max - start) * progress);
        const state = await checkLayers(`${width} ${direction} ${progress}`, reduced);
        await checkOverflow(`${width} ${direction} ${progress}`);
        // A sticky footer stays parked while the opaque main uncovers it.
        if (state.footer.position === 'sticky' && state.footerRect.height <= state.height) {
          assert(Math.abs(state.footerRect.bottom - state.height) <= 2, `Footer not pinned to viewport bottom at ${width}/${progress}`);
        }
        const visible = Math.max(0, state.height - Math.max(0, state.mainRect.bottom, state.footerRect.top));
        if (previous !== undefined) assert(direction === 'forward' ? visible + 2 >= previous : visible <= previous + 2,
          `${width}: footer reveal jumped in ${direction}`);
        previous = visible;
        if (direction === 'forward') positions.set(progress, state.footerRect.top);
        else assert(Math.abs(positions.get(progress) - state.footerRect.top) <= 2, `${width}: reverse footer geometry differs`);
        if (capture && direction === 'forward' && [0, .4, .8, 1].includes(progress)) {
          await screenshot(`${width}-footer-reveal-${Math.round(progress * 100)}`);
        }
      }
      previous = undefined;
    }
    await scroll(initial.max);
    const bottom = await evaluate(`(() => {
      const f=document.querySelector('footer'), r=f.getBoundingClientRect();
      const links=[...f.querySelectorAll('a')].map(a=>{const b=a.getBoundingClientRect(), x=b.left+b.width/2,y=b.top+b.height/2;return {text:a.textContent.trim(),top:b.top,bottom:b.bottom,hit:y>=0&&y<innerHeight&&a.contains(document.elementFromPoint(x,y))}});
      return {bottom:r.bottom,height:innerHeight,links};
    })()`);
    assert(Math.abs(bottom.bottom - bottom.height) <= 2, `${width}: footer bottom unreachable`);
    assert(bottom.links.length > 0, `${width}: footer has no links`);
    for (const link of bottom.links) assert(link.top >= -1 && link.bottom <= bottom.height + 1 && link.hit,
      `${width}: footer link covered or unreachable: ${JSON.stringify(link)}`);
    if (capture) await screenshot(`${width}-footer`);
  };

  const checkFooterAccess = async label => {
    // Scroll real content, not the footer box. An oversized sticky footer can
    // report a visible box while its opening copy stays behind the main layer.
    const count = await evaluate(`(() => {
      const f=document.querySelector('footer');
      return [f.querySelector('h1,h2,h3,p'), ...f.querySelectorAll('a')].filter(Boolean).length;
    })()`);
    assert(count > 1, `${label}: expected footer copy and links`);
    // First uncover the footer through document scrolling. scrollIntoView alone
    // sees a sticky descendant's viewport rect and can leave it behind the main.
    await scroll(await evaluate('document.documentElement.scrollHeight-innerHeight'));
    for (let i = 0; i < count; i++) {
      for (const edge of ['start', 'end']) {
      await evaluate(`(() => {
        const f=document.querySelector('footer'), e=[f.querySelector('h1,h2,h3,p'), ...f.querySelectorAll('a')].filter(Boolean)[${i}];
        e.scrollIntoView({block:${JSON.stringify(edge)},behavior:'instant'});
        const range=document.createRange(); range.selectNodeContents(e);
        const rects=[...range.getClientRects()].filter(r=>r.width>1&&r.height>1);
        const r=${JSON.stringify(edge)} === 'start' ? rects[0] : rects.at(-1);
        if(r) scrollBy({top:r.top+r.height/2-innerHeight/2,behavior:'instant'});
      })()`);
      await settle();
      const target = await evaluate(`(() => {
        const f=document.querySelector('footer'), e=[f.querySelector('h1,h2,h3,p'), ...f.querySelectorAll('a')].filter(Boolean)[${i}];
        const range=document.createRange(); range.selectNodeContents(e);
        const rects=[...range.getClientRects()].filter(r=>r.width>1&&r.height>1);
        const first=rects[0] || e.getBoundingClientRect(), tail=rects.at(-1) || first;
        const r=${JSON.stringify(edge)} === 'start' ? first : tail, last=r;
        const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        const tailHit=document.elementFromPoint(last.left+last.width/2,last.top+last.height/2);
        return {text:e.textContent.trim(),top:r.top,bottom:last.bottom,height:innerHeight,
          hit:(e===hit||e.contains(hit))&&(e===tailHit||e.contains(tailHit)),
          coveredBy:[hit,tailHit].map(n=>n?{tag:n.tagName,id:n.id,text:n.textContent.trim().slice(0,60)}:null),
          footer:{position:getComputedStyle(f).position,height:f.getBoundingClientRect().height},
          mainBottom:document.querySelector('#main-content').getBoundingClientRect().bottom};
      })()`);
      assert(target.top >= -1 && target.bottom <= target.height + 1 && target.hit,
        `${label}: footer content cannot be reached by scrolling: ${JSON.stringify(target)}`);
      }
    }
    await checkOverflow(label);
  };

  await page('Runtime.enable');
  await page('Page.enable');
  const fluid = [];
  const failures = [];
  for (const [width, height] of viewports) {
    await viewport(width, height);
    await load();
    await checkLayers(`${width} initial`);
    await checkOverflow(`${width} initial`);
    await checkFonts();
    const ribbon = await evaluate(`(() => {
      const h=document.querySelector('.hero__title'),r=document.createRange();
      r.selectNodeContents(h);
      const lines=[...r.getClientRects()];
      return {badge:document.querySelector('.hero__rosette').getBoundingClientRect().toJSON(),
        lastLine:lines.at(-1).toJSON(),date:document.querySelector('#date').getBoundingClientRect().toJSON(),
        subtitle:document.querySelector('.hero__subtitle').getBoundingClientRect().toJSON(),width:innerWidth};
    })()`);
    const overlaps = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    assert(!overlaps(ribbon.badge,ribbon.lastLine), `${width}: ribbon covers Raid`);
    assert(!overlaps(ribbon.badge,ribbon.date), `${width}: ribbon overlaps survey card`);
    assert(!overlaps(ribbon.badge,ribbon.subtitle), `${width}: ribbon overlaps subtitle`);
    assert(ribbon.badge.left >= 0 && ribbon.badge.right <= ribbon.width, `${width}: ribbon is clipped`);
    await checkSurvey();
    fluid.push(await evaluate(`(() => {
      const h=document.querySelector('#tournament-title'), p=document.querySelector('#how'), s=getComputedStyle(p), r=p.getBoundingClientRect();
      return {width:innerWidth,body:parseFloat(getComputedStyle(document.body).fontSize),title:parseFloat(getComputedStyle(h).fontSize),
        padding:parseFloat(s.paddingLeft),gutter:r.left,content:r.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)};
    })()`));
    if (width <= 430) {
      const sizing = fluid.at(-1);
      assert(sizing.gutter >= 8 && sizing.gutter <= 32, `Excessive or missing mobile outer gutter: ${JSON.stringify(sizing)}`);
      assert(sizing.padding >= 12 && sizing.padding <= 32, `Excessive or missing mobile panel padding: ${JSON.stringify(sizing)}`);
      assert(sizing.content >= width * .65, `Mobile panel leaves too little usable text width: ${JSON.stringify(sizing)}`);
    }
    const capture = [390, 1440].includes(width);
    if (capture) {
      await screenshot(`${width}-hero`);
      await scrollSection('#how');
      await checkOverflow(`${width} how`);
      await screenshot(`${width}-how`);
      await scrollSection('#cabin-rules');
      await checkOverflow(`${width} rules disclosure`);
      await screenshot(`${width}-rules-disclosure`);
    }
    await checkFAQ();
    await scrollSection('#volunteer');
    const tally = await evaluate(`(() => {
      const svg=document.querySelector('.volunteer__tally'),mask=svg.querySelector('.tally__reveal');
      const animation=mask.getAnimations()[0];
      if(!animation) return {animated:false};
      animation.pause();
      const samples=[500,1200,2500,7800].map(time=>{
        animation.currentTime=time;
        const s=getComputedStyle(mask);
        return {offset:parseFloat(s.strokeDashoffset),opacity:parseFloat(s.opacity)};
      });
      return {animated:true,marks:svg.querySelectorAll('g > path').length,samples};
    })()`);
    assert(tally.animated && tally.marks===5, `${width}: expected five tally marks and a masked draw animation`);
    assert.equal(tally.samples[0].opacity,0);
    assert(tally.samples[1].offset>0 && tally.samples[1].offset<1, 'Tally must reveal progressively');
    assert.equal(tally.samples[2].offset,0);
    assert.equal(tally.samples[2].opacity,1);
    assert(tally.samples[3].opacity>0 && tally.samples[3].opacity<1, 'Completed tally should fade before restarting');
    if(capture) for(const [phase,time] of [['start',500],['drawing',1200],['complete',2500]]) {
      await evaluate(`document.querySelector('.tally__reveal').getAnimations()[0].currentTime=${time}`);
      await settle();
      await screenshot(`${width}-tally-${phase}`);
    }
    await evaluate(`document.querySelector('.tally__reveal').getAnimations()[0].play()`);
    await footerReveal(width, false, capture);
    console.log(`PASS ${width}x${height}: layout, overflow, fonts, survey, FAQ, forward/reverse footer`);
  }
  for (const metric of ['body', 'title', 'padding', 'gutter']) {
    assert(fluid.at(-1)[metric] > fluid[0][metric] + .5, `${metric} does not grow across viewports: ${JSON.stringify(fluid)}`);
    for (let i = 1; i < fluid.length; i++) assert(fluid[i][metric] + 1 >= fluid[i - 1][metric], `${metric} shrinks unexpectedly: ${JSON.stringify(fluid)}`);
  }
  console.log(`PASS fluid type and spacing: ${JSON.stringify(fluid)}`);

  // Exercise the short-height fallback and both ends of an oversized footer.
  await viewport(390, 568);
  await load();
  await checkLayers('390x568 footer');
  await checkFooterAccess('390x568 footer top and links');
  console.log('PASS 390x568: footer opening copy and every link remain accessible');

  // Simulate a user increasing their default text size, without changing zoom
  // or the CSS viewport. Taller viewports also exercise the sticky-footer case:
  // enlarged content can exceed the viewport even above a short-height cutoff.
  for (const [width, height] of [[390, 568], [390, 844], [700, 900]]) {
    await viewport(width, height);
    await load();
    const textBefore = await evaluate('parseFloat(getComputedStyle(document.body).fontSize)');
    await evaluate(`(() => {
      const s=document.createElement('style'); s.id='verify-large-text';
      s.textContent='html { font-size: 200% !important; }'; document.head.append(s);
    })()`);
    await evaluate('document.fonts.ready.then(() => true)');
    await settle();
    assert(await evaluate('parseFloat(getComputedStyle(document.body).fontSize)') > textBefore * 1.5,
      'Enlarged-text test did not increase body text size');
    try {
      await checkLayers(`${width}x${height} enlarged text footer`);
      await checkFooterAccess(`${width}x${height} enlarged text footer title and links`);
      console.log(`PASS ${width}x${height}: enlarged text, entire footer title and links accessible`);
    } catch (error) {
      failures.push(error.message);
      console.error(`FAIL ${error.message}`);
      await screenshot(`${width}x${height}-enlarged-text-failure`);
    }
  }

  // A footer taller than a short viewport must still allow access to its end.
  await viewport(390, 240);
  await load();
  const tall = await layout();
  assert(tall.footerRect.height > 240, 'Short viewport does not exercise a footer taller than the viewport');
  await scroll(tall.max);
  await checkLayers('short viewport footer');
  const lastLink = await evaluate(`(() => {
    const a=[...document.querySelectorAll('footer a')].at(-1),r=a.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    return {top:r.top,bottom:r.bottom,height:innerHeight,hit:a.contains(document.elementFromPoint(x,y))};
  })()`);
  assert(lastLink.top >= 0 && lastLink.bottom <= lastLink.height && lastLink.hit, `Tall footer end is inaccessible: ${JSON.stringify(lastLink)}`);
  await checkOverflow('short viewport footer');
  console.log('PASS footer taller than viewport: bottom link remains accessible');

  await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  for (const width of [390, 1440]) {
    await viewport(width, 900);
    await load();
    await checkLayers(`${width} reduced motion`, true);
    const staticTally=await evaluate(`(()=>{const e=document.querySelector('.tally__reveal'),s=getComputedStyle(e);return {animations:e.getAnimations().length,offset:parseFloat(s.strokeDashoffset),opacity:s.opacity}})()`);
    assert.deepEqual(staticTally,{animations:0,offset:0,opacity:'1'}, 'Reduced motion must show the completed tally without animation');
    await checkOverflow(`${width} reduced motion`);
    await footerReveal(width, true);
    console.log(`PASS ${width}: reduced-motion footer, forward/reverse scrolling, accessible links`);
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log('PASS no browser JavaScript exceptions or console errors');
  assert.deepEqual(failures, [], 'Enlarged-text accessibility failures');
  await call('Browser.close');
} catch (error) {
  console.error(error);
  console.error(`Browser runtime errors captured: ${JSON.stringify(errors)}`);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  socket?.close();
  const exited = chrome.exitCode !== null || chrome.signalCode !== null;
  if (!exited) {
    const exit = new Promise(resolve => chrome.once('exit', resolve));
    chrome.kill();
    await exit;
  }
  rmSync(profile, { recursive: true, force: true });
}
