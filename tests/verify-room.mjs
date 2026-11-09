// Run with the static site at localhost:8083: node tests/verify-room.mjs
// SITE_URL overrides the preview URL.
// Uses local Chrome and Node's built-in WebSocket, without dependencies.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const profile = mkdtempSync(join(tmpdir(), 'husky-room-'));
const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank']);
const timeout = setTimeout(() => { chrome.kill(); process.exit(1); }, 90000);
try {
  const endpoint = await new Promise((resolve, reject) => {
    chrome.on('error', reject);
    let log = '';
    chrome.stderr.on('data', chunk => { log += chunk; const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) resolve(match[1]); });
  });
  const ws = new WebSocket(endpoint);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map(), errors = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (!message.id) return;
    const request = pending.get(message.id); pending.delete(message.id);
    if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result);
  });
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const key = ++id; pending.set(key, { resolve, reject });
    ws.send(JSON.stringify({ id: key, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => call(method, params, sessionId);
  const evaluate = async expression => {
    const response = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    assert(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const settle = `new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`;
  const load = async () => {
    await page('Page.navigate', { url: process.env.SITE_URL || 'http://127.0.0.1:8083/' });
    await evaluate(`new Promise(r=>{if(document.readyState==='complete')r();else addEventListener('load',r,{once:true})})`);
    await evaluate(`document.fonts.ready.then(()=>true)`);
    await evaluate(settle);
  };
  const go = async progress => {
    await evaluate(`(()=>{const r=document.querySelector('#room'),s=r.querySelector('[data-stage]');scrollTo({top:r.getBoundingClientRect().top+scrollY+(r.offsetHeight-s.offsetHeight)*${progress}-parseFloat(s.style.top),behavior:'instant'})})()`);
    await evaluate(settle);
    const { nodes } = await page('Accessibility.getFullAXTree');
    for (const name of ['The maps', 'Prizes', '2025 Husky Holiday champion']) {
      assert.equal(nodes.filter(n => !n.ignored && n.role?.value === 'heading' && n.name?.value === name).length, 1, `Stable heading: ${name}`);
    }
    assert(!nodes.some(n => !n.ignored && /^Rule [1-5] of 5$/.test(n.name?.value || '')), 'Animated captions are hidden from screen readers');
    return evaluate(`(()=>{const r=document.querySelector('#room'),s=r.querySelector('[data-scene]'),v=r.querySelector('[data-view]').getBoundingClientRect();return {beat:r.dataset.beat,radar:s.dataset.radarOff,nose:getComputedStyle(r.querySelector('.rudolph-nose')).fill,labels:[...r.querySelectorAll('[data-rule]')].filter(e=>+e.style.opacity>.01).map(e=>({id:e.dataset.rule,rect:e.lastElementChild.getBoundingClientRect().toJSON()})),view:v.toJSON(),overflow:document.documentElement.scrollWidth>innerWidth,transform:s.style.transform}})()`);
  };
  await page('Runtime.enable');
  const ids = ['timer', 'flags', 'friendly-fire', 'radar', 'chair'];
  let sharedGeometry;
  for (const [width, height] of [[320,568],[390,844],[430,932],[700,900],[1440,900],[1920,900]]) {
    await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await load();
    const geometry = await evaluate(`(()=>{const selectors=['.ctf-flags','.mantel-clock','.needler-gift','.plasma-pistol-gift','.rudolph','.cabin-chair','.battle-rifle-gift','.prize-first','.prize-second','.prize-third','.holiday-lan'];return selectors.map(s=>{const e=document.querySelector(s),c=getComputedStyle(e);return [s,parseFloat(c.left),parseFloat(c.top),parseFloat(c.width),parseFloat(c.height),c.translate,c.scale,c.display]})})()`);
    if (sharedGeometry) assert.deepEqual(geometry, sharedGeometry, 'Viewport changed prop coordinates');
    else sharedGeometry = geometry;
    assert(Math.abs(geometry.at(-1)[3]-904.4)<.02); assert.equal(geometry.at(-1)[4],595);
    assert(Math.abs(geometry.at(-1)[1]+64*.85-3400)<.02,'LAN artwork stays anchored despite transparent left bleed');
    const giftByName = name=>geometry.find(g=>g[0]===name);
    assert.equal(giftByName('.prize-second')[1],95);
    assert.equal(giftByName('.prize-first')[1],300);
    assert.equal(giftByName('.prize-third')[1],550);
    assert(giftByName('.needler-gift')[2]+giftByName('.needler-gift')[4]<=giftByName('.plasma-pistol-gift')[2]);
    assert.equal(giftByName('.plasma-pistol-gift')[3],90);
    assert.equal(giftByName('.plasma-pistol-gift')[4],74);
    // Prize bases sit on the track's centerline, clear of its near rail.
    for (const gift of geometry.filter(g=>['.prize-first','.prize-second','.prize-third'].includes(g[0]))) {
      assert.equal(gift[2]+gift[4],920);
    }
    const weaponTags=await evaluate(`[...document.querySelectorAll('.weapon-gift')].map(e=>{const tags=e.querySelectorAll('.weapon-gift-tag'),t=tags[0],name=t?.querySelector('.weapon-tag-name'),paper=t?.querySelector('.weapon-tag-paper').getBBox(),b=name?.getBBox();return {weapon:e.classList[0],count:tags.length,name:name?.textContent,recipient:t?.dataset.recipient,hidden:e.getAttribute('aria-hidden'),bounds:b&&[b.x,b.y,b.width,b.height,paper.width,paper.height],fits:b&&b.x>=12&&b.x+b.width<=paper.width-3&&b.y>=9&&b.y+b.height<=paper.height-2,still:t?.getAnimations({subtree:true}).length===0}})`);
    assert.deepEqual(weaponTags.map(t=>[t.weapon,t.name]),[
      ['battle-rifle-gift','FourthString'],['needler-gift','Chan'],['plasma-pistol-gift','SDot'],['spnkr-gift','scrof'],['gravity-hammer-gift','Victory']
    ]);
    assert(weaponTags.every(t=>t.count===1&&t.recipient===t.name&&t.hidden==='true'&&t.fits&&t.still),`Weapon names fit one static decorative tag per bow: ${JSON.stringify(weaponTags)}`);
    const stockings=await evaluate(`([...document.querySelectorAll('.sportsmanship-stocking')].map(e=>{const t=e.querySelector('text'),b=t.getBBox();return {name:t.textContent,hidden:e.getAttribute('aria-hidden'),fits:b.x>=23&&b.x+b.width<=125&&b.y>=16&&b.y+b.height<=44,readable:new DOMMatrix(getComputedStyle(t).transform).a>0,animated:e.getAnimations({subtree:true}).length>0}}))`);
    assert.deepEqual(stockings.map(s=>s.name),['GoodSport','TeamPlayer','HypeMan','GraciousRival']);
    assert(stockings.every(s=>s.hidden==='true'&&s.fits&&s.readable&&!s.animated),'Stocking embroidery must fit its cuff, stay readable and remain decorative');
    const stockingShape=await evaluate(`([...document.querySelectorAll('.sportsmanship-stocking')].map(e=>{const cuff=e.querySelector('.stocking-cuff'),text=e.querySelector('text'),leg=e.querySelector('.stocking-leg'),p=new DOMPoint(74,36),a=p.matrixTransform(cuff.getCTM()),b=p.matrixTransform(text.getCTM());return {aligned:Math.hypot(a.x-b.x,a.y-b.y)<.1,slim:leg.getBBox().width<cuff.getBBox().width*.85&&cuff.getBBox().width===116,top:parseFloat(getComputedStyle(e).top),fabric:e.querySelector('.stocking-fabric').getAttribute('transform')}}))`);
    assert(stockingShape.every(s=>s.aligned&&s.slim&&s.top>=470&&s.top<490),'Stockings need aligned cuffs, slim fabric and loops fixed to the wood');
    assert(stockingShape[1].fabric?.includes('scale(-1 1)')&&!stockingShape[2].fabric,'Middle toes point away from the fire');
    assert.equal(await evaluate(`document.querySelectorAll('.covenant-convoy__wraith').length`),1);
    assert.equal(await evaluate(`document.querySelectorAll('.covenant-convoy__ghost').length`),2);
    const depth=await evaluate(`(()=>{const e=document.querySelector('.train');return [4000,12000].map(t=>{e.getAnimations().forEach(a=>{a.pause();a.currentTime=t});return getComputedStyle(e).zIndex})})()`);
    assert.deepEqual(depth,['7','2']);
    const launcher=await evaluate(`(()=>{const r=document.querySelector('.spnkr-gift'),t=document.querySelector('.train');return {z:+getComputedStyle(r).zIndex,siblings:r.parentElement===t.parentElement}})()`);
    assert(launcher.siblings && depth.every(z=>+z>launcher.z),'Train must pass in front of the rocket launcher on both sides of the track');
    const smallGifts=await evaluate(`[...document.querySelectorAll('.small-gift')].map(e=>({x:e.offsetLeft,y:e.offsetTop,w:e.offsetWidth,h:e.offsetHeight,z:+getComputedStyle(e).zIndex}))`);
    assert.equal(smallGifts.length,17);
    const bonusTags=await evaluate(`([...document.querySelectorAll('.small-gift')].map(e=>{const tags=e.querySelectorAll('.bonus-gift-tag'),t=tags[0];return {count:tags.length,text:t?.textContent,fit:t&&t.scrollWidth<=t.clientWidth,hidden:e.getAttribute('aria-hidden')}}))`);
    assert(bonusTags.every(t=>t.count===1&&t.text==='$1'&&t.fit&&t.hidden==='true'),'Every little gift gets exactly one decorative $1 tag');
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.gift-prize-tag strong')].map(e=>e.textContent)`),['$50','$25','$10'],'Main prize values stay unchanged');
    for (const gift of smallGifts) {
      assert.equal(gift.z,6);
      for (const x of [gift.x,gift.x+gift.w]) for (const y of [gift.y,gift.y+gift.h]) {
        assert(((x-430)/375)**2+((y-920)/56)**2<1,'Small gift extends outside train track');
      }
    }
    const cars=await evaluate(`(()=>{const cars=[...document.querySelectorAll('.train')];return [0,4000,7900,12000,15500].map(t=>cars.map(e=>{[e,e.firstElementChild].forEach(n=>n.getAnimations().forEach(a=>{a.pause();a.currentTime=t}));return {phase:parseFloat(getComputedStyle(e).offsetDistance),facing:new DOMMatrix(getComputedStyle(e.firstElementChild).transform).a}}))})()`);
    for(const lap of cars) {
      // Negative delays put the engine ahead, even when it wraps through 100%.
      assert(Math.abs((lap[0].phase-lap[1].phase+100)%100-3.4375)<.01);
      assert(Math.abs((lap[0].phase-lap[2].phase+100)%100-6.875)<.01);
      for(const car of lap) assert.equal(car.facing,car.phase<50?1:-1);
    }
    assert(await evaluate(`[...document.images].every(e=>e.complete&&e.naturalWidth>0)`));
    for (let i = 0; i < 5; i++) {
      const state = await go((2.5+i)/11);
      assert.equal(state.beat, ids[i]); assert.equal(state.labels.length,1);
      assert.equal(state.labels[0].id,ids[i]);
      assert.equal(state.radar,String(i>=4));
      if (i<3) assert.equal(state.nose,'color(srgb 1 0.286275 0.239216)');
      if (i>=4) assert.equal(state.nose,'rgb(74, 58, 54)');
      const frame=await evaluate(`(()=>{const f=document.querySelector('[data-rule-focus]'),v=document.querySelector('[data-view]').getBoundingClientRect(),b=f.querySelector('path').getBoundingClientRect();return {visible:getComputedStyle(f).visibility,opacity:+f.style.opacity,x:b.x-v.x,y:b.y-v.y,right:b.right-v.x,bottom:b.bottom-v.y}})()`);
      assert.equal(frame.visible,'visible'); assert(frame.opacity>.9);
      assert(frame.x>=4&&frame.y>=4&&frame.right<=state.view.width-4&&frame.bottom<=state.view.height-4,'Focus brackets clipped');
      if(i!==1) {
        const selector=['.mantel-clock',null,'.drop-wall','.rudolph','.cabin-chair'][i];
        const prop=await evaluate(`document.querySelector('${selector}').getBoundingClientRect().toJSON()`);
        const x=prop.x-state.view.x,y=prop.y-state.view.y;
        assert(Math.abs(frame.x-Math.max(5,x-9))<5&&Math.abs(frame.y-Math.max(5,y-9))<5,'Focus does not track actual object');
        assert(Math.abs(frame.right-Math.min(state.view.width-5,x+prop.width+9))<5,'Focus right edge misses object');
      }
      assert(!state.overflow);
      if(i===0||i===1) {
        const prop=await evaluate(`document.querySelector('${i===0?'.mantel-clock':'.ctf-flags'}').getBoundingClientRect().toJSON()`);
        assert(prop.top>=state.view.top&&prop.bottom<=state.view.bottom&&prop.left>=state.view.left&&prop.right<=state.view.right,`Prop clipped at ${width}, beat ${i}: ${JSON.stringify({prop,view:state.view})}`);
      }
      const tip = state.labels[0].rect;
      assert(tip.left>=0&&tip.right<=width&&tip.top>=state.view.top&&tip.bottom<=state.view.bottom,'Bubble clipped');
      if (width===390||width===1440) {
        const shot=await page('Page.captureScreenshot',{format:'png'});
        writeFileSync(join(tmpdir(),`husky-room-${width}-${ids[i]}.png`),Buffer.from(shot.data,'base64'));
      }
    }
    // Every transition, including reverse scroll, must show at most one bubble.
    for (let t=7; t>=1; t-=.1) {
      const state=await go(t/11);
      assert(state.labels.length<=1);
      // Scroll positions round to CSS pixels, so avoid asserting a subpixel boundary.
      if (Math.abs(t-5.72)>.002) assert.equal(state.radar,String(t>=5.72));
    }
    assert.equal((await go(5.8/11)).radar,'true');
    assert.equal((await go(4.99/11)).radar,'false');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.rudolph-nose')).fill`),'color(srgb 1 0.286275 0.239216)','Reverse scroll must relight immediately');
    if(width===390) {
      await go(5.3/11);
      const held=await evaluate(`getComputedStyle(document.querySelector('.rudolph-nose')).fill`);
      await evaluate(`new Promise(r=>setTimeout(r,1100))`);
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.rudolph-nose')).fill`),held,'Pausing scroll must hold the flicker state');
      await go(4.9/11);
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.rudolph-nose')).fill`),'color(srgb 1 0.286275 0.239216)','Reverse scroll must relight without a timer');
    }
    // Sample first, middle and settled states in both directions, including skips.
    const art=async t=>{
      await go(t/11);
      return evaluate(`(()=>{const s=document.querySelector('[data-scene]'),c=getComputedStyle(s),field=document.querySelector('.drop-wall-field'),cloth=document.querySelector('.captured-cloth');return {rings:[...document.querySelectorAll('[data-nose-ring]')].map(e=>({r:+e.getAttribute('r'),opacity:+e.style.opacity,cx:e.getAttribute('cx'),cy:e.getAttribute('cy')})),flag:+c.getPropertyValue('--flag-raised'),shield:+c.getPropertyValue('--shield-deployed'),clock:+c.getPropertyValue('--clock-pulse'),nose:+c.getPropertyValue('--nose-light'),steam:[...document.querySelectorAll('[data-steam]')].map(e=>+e.style.opacity),cloth:getComputedStyle(cloth).transform,field:getComputedStyle(field).transform}})()`);
    };
    for(const [name,start] of [['flag',3.12],['shield',4.12]]) {
      const first=await art(start-.02),middle=await art(start+.35),last=await art(start+.75);
      assert.equal(first[name],0); assert(middle[name]>.45&&middle[name]<.55); assert.equal(last[name],1);
      assert.notEqual(first[name==='flag'?'cloth':'field'],last[name==='flag'?'cloth':'field']);
      assert.deepEqual(await art(start+.35),middle,'Reverse scroll reproduces middle state');
      assert.deepEqual(await art(start-.02),first,'Reverse scroll restores initial state');
      if(width===390||width===1440) for(const [phase,t] of [['initial',start-.02],['middle',start+.35],['final',start+.75]]) {
        await art(t);
        const shot=await page('Page.captureScreenshot',{format:'png'});
        writeFileSync(join(tmpdir(),`husky-room-${width}-${name}-${phase}.png`),Buffer.from(shot.data,'base64'));
      }
    }
    assert.equal((await art(2)).clock,0); assert((await art(2.25)).clock>.99); assert.equal((await art(3.1)).clock,0);
    const lit=await art(4.8);
    assert.equal(lit.nose,1);
    assert.equal(lit.rings.length,3);
    assert(lit.rings.every(r=>r.r>=10&&r.r<46&&r.cx==='57'&&r.cy==='42'&&r.opacity>0),'Lit nose emits concentric rings');
    const ordered=[...lit.rings].sort((a,b)=>a.r-b.r);
    assert(ordered[0].opacity>ordered[1].opacity&&ordered[1].opacity>ordered[2].opacity,'Outgoing rings fade with distance');
    assert.notDeepEqual((await art(5.05)).rings,lit.rings,'Scroll moves outgoing rings');
    assert.deepEqual((await art(4.8)).rings,lit.rings,'Reverse scroll restores the same rings');
    const flicker=await art(5.3); assert(flicker.nose>0&&flicker.nose<1);
    const unlit=await art(5.8);
    assert.equal(unlit.nose,0);
    assert(unlit.rings.every(r=>r.opacity===0),'Nose rings disappear with the light');
    if(width===390||width===1440) for(const [phase,t] of [['lit',5.12],['flicker',5.4],['off',5.85]]) {
      await art(t);
      const shot=await page('Page.captureScreenshot',{format:'png'});
      writeFileSync(join(tmpdir(),`husky-room-${width}-radar-${phase}.png`),Buffer.from(shot.data,'base64'));
    }
    assert.deepEqual(await art(5.3),flicker);
    assert((await art(6.5)).steam.every(o=>o>0)); assert((await art(7.1)).steam.every(o=>o===0));
    const maps=await go(0), prizes=await go(8.8/11);
    const tree = await evaluate(`(() => {
      const t=document.querySelector('.christmas-tree');
      return {frags:t.querySelectorAll('.tree-grenade--frag').length,plasmas:t.querySelectorAll('.tree-grenade--plasma').length,
        sword:!!t.querySelector('.tree-sword-topper'),hidden:t.getAttribute('aria-hidden'),
        steady:[...t.querySelectorAll('.tree-grenade,.tree-sword-topper')].every(e=>e.getAnimations({subtree:true}).length===0),
        refs:[...t.querySelectorAll('use')].every(e=>!!document.querySelector(e.getAttribute('href')))};
    })()`);
    assert.deepEqual(tree,{frags:9,plasmas:9,sword:true,hidden:'true',steady:true,refs:true});
    if (width===390||width===1440) {
      await evaluate(`document.querySelectorAll('.train,.trainbody').forEach(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=3000}))`);
      await evaluate(settle);
      const shot=await page('Page.captureScreenshot',{format:'png'});
      writeFileSync(join(tmpdir(),`husky-room-${width}-grenade-tree.png`),Buffer.from(shot.data,'base64'));
    }
    assert.equal(maps.beat,'maps'); assert.equal(prizes.beat,'prizes');
    const finale=await go(10.5/11);
    assert.equal(finale.beat,'lan');
    const plaque=await evaluate(`(()=>{const e=document.querySelector('[data-winner-plaque]'),r=e.getBoundingClientRect(),v=document.querySelector('[data-view]').getBoundingClientRect(),scale=new DOMMatrix(getComputedStyle(document.querySelector('[data-scene]')).transform).a;return {text:e.textContent,rect:r.toJSON(),view:v.toJSON(),nameSize:parseFloat(getComputedStyle(e.querySelector('.winner-plaque__name')).fontSize)*scale,scoreSize:parseFloat(getComputedStyle(e.querySelector('.winner-plaque__score')).fontSize)*scale,captions:[...document.querySelectorAll('[data-cap]')].some(e=>+e.style.opacity>.01),band:document.querySelector('[data-band]').offsetHeight,fit:[...e.children].every(c=>c.scrollWidth<=c.clientWidth)}})()`);
    assert(plaque.text.includes('Victory is BACK')&&plaque.text.includes('+17')&&plaque.text.includes('flag diff.'));
    assert(plaque.text.includes('2025')&&plaque.text.includes('2026')&&plaque.text.includes('Your name here'));
    assert.equal(await evaluate(`document.querySelector('[data-winner-year="2026"] .winner-plaque__score')`),null,'Open year has no invented score');
    assert(plaque.rect.left>=plaque.view.left&&plaque.rect.right<=plaque.view.right&&plaque.rect.top>=plaque.view.top&&plaque.rect.bottom<=plaque.view.bottom,'Winner plaque clipped');
    assert(plaque.nameSize>=14&&plaque.scoreSize>=13,'Plaque text too small to carry winner information');
    assert(!plaque.captions&&plaque.band===0&&plaque.fit,'Finale has no duplicate caption or overflowing plaque text');
    assert.equal(finale.labels.length,0);
    if(width===390||width===1440) {
      const shot=await page('Page.captureScreenshot',{format:'png'});
      writeFileSync(join(tmpdir(),`husky-room-${width}-lan-winner.png`),Buffer.from(shot.data,'base64'));
    }
    await go(9.5/11);
    assert.deepEqual((await go(10.5/11)).transform,finale.transform,'Reverse and forward restore the LAN shot');
    if(width===390) {
      await page('Page.reload');
      await evaluate(`new Promise(r=>{if(document.readyState==='complete')r();else addEventListener('load',r,{once:true})})`);
      await evaluate(`document.fonts.ready.then(()=>true)`);
      await evaluate(settle);
      assert.equal(await evaluate(`document.querySelector('#room').dataset.beat`),'lan','Reload restores the final LAN beat');
      assert.equal(await evaluate(`document.querySelector('[data-band]').offsetHeight`),0);
      assert.equal(await evaluate(`document.querySelector('[data-scene]').style.transform`),finale.transform);
    }
    assert.equal((await go(8.8/11)).beat,'prizes');
    if (width<700) {
      await go(0);
      const bounds=await evaluate(`(()=>{const m=new DOMMatrix(getComputedStyle(document.querySelector('[data-scene]')).transform),v=document.querySelector('[data-view]');return {bottom:(v.clientHeight-m.f)/m.a,scale:m.a}})()`);
      assert(bounds.bottom<=581,'Phone map shot exposes the fireplace');
      const rule=await go(4.5/11);
      assert.notEqual(rule.transform,maps.transform);
    }
    assert.notEqual(maps.transform,prizes.transform);
    // Reload midway: no one-way triggers or dependence on preceding scroll events.
    await load(); await go(5.8/11);
    const restoredArt=await art(5.8);
    await page('Page.reload');
    await evaluate(`new Promise(r=>{if(document.readyState==='complete')r();else addEventListener('load',r,{once:true})})`);
    await evaluate(settle);
    assert.equal(await evaluate(`document.querySelector('[data-scene]').dataset.radarOff`),'true');
    assert.deepEqual(await art(5.8),restoredArt,'Reload restores complete effect state');
    await go(4.5/11);
    assert.equal(await evaluate(`document.querySelector('[data-scene]').dataset.radarOff`),'false');
    console.log(`PASS ${width}x${height}: shared geometry, five rules, LAN winner, transitions, reverse, reload, assets`);
  }
  await evaluate(`document.querySelector('[data-cap="rules"] a').click()`);
  assert(await evaluate(`document.querySelector('#house-rules').open`));
  assert(await evaluate(`document.activeElement === document.querySelector('#house-rules summary')`));
  assert(await evaluate(`document.querySelector('#house-rules').textContent.includes('No equipment use while carrying the flag.')`));
  assert(await evaluate(`document.querySelector('#rule-flags br')?.nextSibling.textContent === 'No equipment use while carrying the flag.'`),'Equipment restriction is on its own line');
  // Live resize restores shared composition, not stale portrait mutations.
  await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await evaluate(settle); assert.equal((await go(3.5/11)).labels[0].id,'flags');
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate(settle); assert.equal((await go(3.5/11)).labels[0].id,'flags');
  await go(10.5/11);
  for(const width of [390,1440]) {
    await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate(settle);
    assert.equal((await go(10.5/11)).beat,'lan');
    assert(await evaluate(`(()=>{const p=document.querySelector('[data-winner-plaque]').getBoundingClientRect(),v=document.querySelector('[data-view]').getBoundingClientRect();return p.left>=v.left&&p.right<=v.right&&p.top>=v.top&&p.bottom<=v.bottom})()`),'Resized LAN plaque remains in view');
  }
  await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for (const width of [390,1440]) {
    await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await load();
    assert(await evaluate(`document.querySelector('#house-rules').open`));
    assert.equal(await evaluate(`document.querySelectorAll('#house-rules li').length`),5);
    assert.equal(await evaluate(`document.querySelector('#room').offsetHeight===document.querySelector('[data-stage]').offsetHeight`),true);
    assert.equal(await evaluate(`document.getAnimations().filter(a=>a.playState==='running').length`),0);
    assert(await evaluate(`[...document.querySelectorAll('[data-nose-ring]')].every(e=>+getComputedStyle(e).opacity===0)`),'Reduced motion hides nose rings');
    assert.deepEqual(await evaluate(`(()=>{const s=getComputedStyle(document.querySelector('[data-scene]'));return ['--flag-raised','--shield-deployed','--clock-pulse','--nose-light'].map(k=>+s.getPropertyValue(k))})()`),[1,1,0,0]);
    console.log(`PASS ${width}: reduced motion, static rules, no animations`);
  }
  await page('Page.navigate',{url:new URL('images/props/lan-trinket-shelf.svg',process.env.SITE_URL || 'http://127.0.0.1:8083/').href});
  await evaluate(`new Promise(r=>{if(document.readyState==='complete')r();else addEventListener('load',r,{once:true})})`);
  const shelf=await evaluate(`({order:[...document.querySelectorAll('[data-shelf-item]')].sort((a,b)=>a.getBoundingClientRect().x-b.getBoundingClientRect().x).map(e=>e.dataset.shelfItem),labels:[...document.querySelectorAll('.game-title')].map(e=>{const b=e.getBBox();return {text:e.textContent,dx:b.x+b.width/2-+e.getAttribute('x'),dy:b.y+b.height/2-+e.getAttribute('y')}})})`);
  assert.deepEqual(shelf.order,['snow-globe','trophy','chief','games']);
  assert.deepEqual(shelf.labels.map(l=>l.text),['Halo: Combat Evolved','Halo 2','Fuzion Frenzy','Soulcalibur II']);
  assert(shelf.labels.every(l=>Math.abs(l.dx)<.25&&Math.abs(l.dy)<.25),`Game spine text off-center: ${JSON.stringify(shelf.labels)}`);
  const cases=await evaluate(`([...document.querySelectorAll('[data-game-case]')].map(e=>{const t=e.querySelector('.game-title'),b=t.getBBox(),m=e.getCTM().inverse().multiply(t.getCTM());return {platform:e.querySelector('.game-platform').textContent,fits:[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].every(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(m);return p.x>=3&&p.x<=18&&p.y>=21&&p.y<=103})}}))`);
  assert.equal(cases.length,4); assert(cases.every(c=>c.platform==='XBOX'&&c.fits),'Game titles fit inside individual Xbox spines');
  const emblem=await evaluate(`(()=>{const e=document.querySelector('[data-shelf-item="trophy"] [data-trophy-emblem="controller"]');if(!e)return null;const b=e.getBBox(),m=e.transform.baseVal.consolidate().matrix;return {paths:e.querySelectorAll('path').length,points:[[b.x,b.y],[b.x+b.width,b.y+b.height]].map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(m);return [p.x,p.y]})}})()`);
  assert(emblem&&emblem.paths===2,'Trophy has a controller silhouette and its looped cable');
  assert(emblem.points.every(([x,y])=>x>=7&&x<=49&&y>=8&&y<=60),'Controller engraving fits inside the trophy cup');
  const shelfShot=await page('Page.captureScreenshot',{format:'png'});
  writeFileSync(join(tmpdir(),'husky-lan-shelf-games.png'),Buffer.from(shelfShot.data,'base64'));
  console.log('PASS shelf order, Xbox cases and centered game labels');
  await page('Page.navigate',{url:new URL('images/props/holiday-lan.svg',process.env.SITE_URL || 'http://127.0.0.1:8083/').href});
  await evaluate(`new Promise(r=>{if(document.readyState==='complete')r();else addEventListener('load',r,{once:true})})`);
  const glowBleed=await evaluate(`(()=>{const v=document.documentElement.viewBox.baseVal,e=document.querySelector('#station > ellipse'),cx=+e.getAttribute('cx'),rx=+e.getAttribute('rx');return [...document.querySelectorAll('use[href="#station"]')].every(s=>{const x=+s.getAttribute('x');return x+cx-rx>v.x&&x+cx+rx<v.x+v.width})})()`);
  assert(glowBleed,'Every monitor halo must fade out inside the SVG bounds, without a clipped edge');
  const players=await evaluate(`([...document.querySelectorAll('[data-lan-player]')].map(e=>{const t=e.querySelector('text'),b=t.getBBox();return {tag:e.dataset.lanPlayer,text:t.textContent,fits:b.x>=7&&b.x+b.width<=192&&b.y>=159&&b.y+b.height<=281,dot:e.querySelector('circle').getAttribute('fill')}}))`);
  assert.deepEqual(players.map(p=>p.tag),['GoodSport','TeamPlayer','HypeMan','GraciousRival']);
  assert(players.every(p=>p.text===p.tag+' ready'&&p.fits&&p.dot==='#8CCB71'),'Each LAN screen has a matching gamertag and green ready indicator within the glass');
  const mugs=await evaluate(`({instances:document.querySelectorAll('[data-mug-instance]').length,colors:[...document.querySelectorAll('[data-mug-instance]')].map(e=>e.style.getPropertyValue('--mug-band')),marshmallows:document.querySelectorAll('#mug rect').length,gradients:!!document.querySelector('#mug-glaze')&&!!document.querySelector('#cocoa-surface')})`);
  assert.equal(mugs.instances,2); assert.equal(mugs.marshmallows,3); assert(mugs.gradients); assert.notEqual(...mugs.colors);
  const lanShot=await page('Page.captureScreenshot',{format:'png'});
  writeFileSync(join(tmpdir(),'husky-lan-gamertags.png'),Buffer.from(lanShot.data,'base64'));
  console.log('PASS LAN gamertags, ready indicators and screen text bounds');
  assert.deepEqual(errors,[]);
  console.log('PASS no browser JavaScript exceptions');
  await call('Browser.close'); ws.close();
} finally { clearTimeout(timeout); chrome.kill(); chrome.once('exit',()=>rmSync(profile,{recursive:true,force:true})); }
