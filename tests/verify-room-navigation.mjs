// Serve the production site, then run: node tests/verify-room-navigation.mjs
// SITE_URL overrides the local preview URL. No npm dependencies.
import assert from 'node:assert/strict';
import { withChrome } from './chrome.mjs';

const base = process.env.SITE_URL || 'http://127.0.0.1:8000/';
const candidatePath = process.env.TEST_PATH || '/';
const sizes = [[320,568],[390,844],[448,998],[715,900],[1440,900],[998,448]];
const times = [0,.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.3,5.5,5.8,6,6.5,7,7.5,8,8.5,9,9.25,9.5,9.75,10,10.5,11];
const rules = ['timer','flags','friendly-fire','radar','chair'];
let checks = 0, geometryChecks = 0, keyboardChecks = 0, reducedChecks = 0, accessibilityChecks = 0;
function near(actual, expected, tolerance = 1, message = '') {
  assert(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected} ± ${tolerance}`);
}
const ease = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };

// Production's 11-unit camera, evaluated against the candidate's smaller view.
function expectedCamera(s) {
  const vw=s.width, vv=s.view.height, SW=s.sceneWidth, t=s.t, phone=vw<700;
  const shot=(cx,cy,scale)=> {
    const hw=vw/(2*scale),hh=vv/(2*scale);
    cx=2*hw>=SW-1100?(1100+SW)/2:Math.min(Math.max(cx,1100+hw),SW-hw);
    cy=2*hh>=1000?500:Math.min(Math.max(cy,hh),1000-hh);
    return {s:scale,x:vw/2-cx*scale,y:vv/2-cy*scale};
  };
  const mix=(a,b,e)=>({s:a.s+(b.s-a.s)*e,x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e});
  const mapsScale=Math.max(Math.min(vw/1000,vv/440)*.95,vw/1180);
  const maps=phone?shot(1515+525*ease(t),270,Math.max(vw/480,vv/580)):shot(1780,270,mapsScale);
  const fireScale=Math.max(vw/1480,vv/1000);
  const fire=shot(1840,1000-vv/(2*fireScale),fireScale);
  let treeScale=Math.max(vw/2580,Math.min(vw/1160,vv/1000));
  if(phone)treeScale=Math.max(vw/780,vv/1000);
  const tree=shot(phone?2920+160*ease(t-8):3080,1000-vv/(2*treeScale),treeScale);
  const lan=shot(phone?3980:3910,570,phone?vw/560:Math.min(vw/1120,vv/1000));
  const shots=s.anchors.map((beat,i)=>phone?shot(beat[0],i===1?650:beat[1]-60,Math.max(vw/500,vv/820)):
    i===1?shot(Math.min(1840,1220+vw/(2*fireScale)),1000-vv/(2*fireScale),fireScale):
    i===0?shot(1840,1000-vv/(2*fireScale)-130,fireScale):fire);
  const index=Math.min(4,Math.max(0,Math.floor(t-2)));
  const active=index>0?mix(shots[index-1],shots[index],ease((t-2-index)/.24)):shots[index];
  const cam=t<2?mix(maps,shots[0],ease(t-1)):t<7?active:mix(mix(shots[4],tree,ease(t-7)),lan,ease(t-9));
  return [cam.s,0,0,cam.s,cam.x,cam.y];
}

await withChrome(async ({page,load,evaluate,errors}) => {
  await page('Page.enable');
  await page('Accessibility.enable');
  const settle=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
  const navigate=async path=>{await load(new URL(path,base).href);await settle();};
  const metrics=async(width,height)=>{await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await settle();};
  const snapshot=()=>evaluate(`(() => {
    const r=document.querySelector('#room'),stage=r.querySelector('[data-stage]'),band=r.querySelector('[data-band]'),view=r.querySelector('[data-view]'),scene=r.querySelector('[data-scene]');
    const rect=e=>e?.getBoundingClientRect().toJSON();
    const visible=e=>{const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity>.01&&e.getBoundingClientRect().height>0};
    const m=new DOMMatrix(getComputedStyle(scene).transform),top=parseFloat(getComputedStyle(stage).top);
    const guide=r.querySelector('[data-room-guide]'),skip=r.querySelector('[data-skip-room]');
    return {t:Math.max(0,Math.min(11,(top-r.getBoundingClientRect().top)/(r.offsetHeight-stage.offsetHeight)*11)),beat:r.dataset.beat,
      stage:stage.offsetHeight,span:r.offsetHeight-stage.offsetHeight,section:r.offsetHeight,band:band.offsetHeight,bandRect:rect(band),view:rect(view),width:view.clientWidth,
      sceneWidth:parseFloat(scene.style.width),capHeight:Math.max(...[...r.querySelectorAll('[data-cap]')].map(e=>e.offsetHeight)),matrix:[m.a,m.b,m.c,m.d,m.e,m.f],
      anchors:['timer','flags','friendly-fire','radar','chair'].map(id=>r.querySelector('[data-rule="'+id+'"]').dataset.at.split(',').map(Number)),
      captions:[...r.querySelectorAll('[data-cap]')].filter(visible).map(e=>({id:e.dataset.cap,rect:rect(e)})),
      labels:[...r.querySelectorAll('[data-rule]')].filter(visible).map(e=>({id:e.dataset.rule,rect:rect(e.lastElementChild)})),
      guide:guide&&{visible:visible(guide),height:guide.offsetHeight,rect:rect(guide),cue:rect(guide.querySelector('p'))},
      skip:skip&&{visible:visible(skip),rect:rect(skip),href:skip.getAttribute('href'),hit:(()=>{const b=skip.getBoundingClientRect(),e=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return e===skip||skip.contains(e)})()},
      effects:{values:['--flag-raised','--shield-deployed','--clock-pulse','--nose-light'].map(k=>+getComputedStyle(scene).getPropertyValue(k)),
        radar:scene.dataset.radarOff,nose:getComputedStyle(r.querySelector('.rudolph-nose')).fill,
        rings:[...r.querySelectorAll('[data-nose-ring]')].map(e=>[e.getAttribute('r'),getComputedStyle(e).opacity]),
        steam:[...r.querySelectorAll('[data-steam]')].map(e=>[getComputedStyle(e).opacity,getComputedStyle(e).transform]),
        cloth:getComputedStyle(r.querySelector('.captured-cloth')).transform,shield:getComputedStyle(r.querySelector('.drop-wall-field')).transform},
      plaque:rect(r.querySelector('[data-winner-plaque]')),overflow:document.documentElement.scrollWidth>innerWidth+1};
  })()`);
  const go=async t=> {
    await evaluate(`(()=>{const r=document.querySelector('#room'),s=r.querySelector('[data-stage]');scrollTo({top:r.getBoundingClientRect().top+scrollY-parseFloat(getComputedStyle(s).top)+(r.offsetHeight-s.offsetHeight)*${t}/11,behavior:'instant'})})()`);
    await settle();return snapshot();
  };
  const ax=async()=> (await page('Accessibility.getFullAXTree')).nodes.filter(n=>!n.ignored);
  const headings=nodes=>nodes.filter(n=>n.role?.value==='heading').map(n=>[n.name?.value,n.properties?.find(p=>p.name==='level')?.value.value]).sort();
  const staticRules=()=>evaluate(`[...document.querySelectorAll('#house-rules li')].map(e=>e.textContent.replace(/\\s+/g,' ').trim())`);
  const assertAX=async original=> {
    accessibilityChecks++;
    const nodes=await ax();
    assert.deepEqual(headings(nodes),original,'Static accessible headings unchanged');
    assert(!nodes.some(n=>/^Rule [1-5] of 5$/.test(n.name?.value||'')),'Animated rule count stays hidden');
    assert.equal(nodes.filter(n=>n.role?.value==='link'&&n.name?.value==='Skip the cabin').length,1,'One accessible skip link');
    assert(nodes.some(n=>n.role?.value==='StaticText'&&n.name?.value?.trim()==='Scroll down to explore'),'Accessible scroll cue without arrow');
    assert(await evaluate(`(()=>{const b=document.querySelector('[data-band]');return !b.closest('[aria-hidden="true"]')&&[...b.querySelectorAll('[data-cap]')].every(e=>e.getAttribute('aria-hidden')==='true')})()`),'Only guide navigation exposed in band');
  };
  function assertGeometry(s,initial,context) {
    assert(!s.overflow,`${context}: page has horizontal overflow`);
    near(s.band,initial.band,.1,`${context}: fixed band`);
    for(const key of ['x','y','width','height'])near(s.view[key],initial.view[key],1,`${context}: fixed view ${key}`);
    assert(s.guide?.visible&&s.skip?.visible&&s.skip.hit,`${context}: guide and link visible and hit-testable`);
    const g=s.guide.rect,k=s.skip.rect,c=s.guide.cue;
    assert(k.width>=24&&k.height>=24,`${context}: usable skip target ${JSON.stringify(k)}`);
    for(const [name,b]of [['guide',g],['skip',k],['cue',c]]) {
      assert(b.left>=-1&&b.right<=s.width+1&&b.top>=s.bandRect.top-1&&b.bottom<=s.bandRect.bottom+1,`${context}: ${name} clipped`);
    }
    for(const cap of s.captions)assert(g.bottom<=cap.rect.top+1,`${context}: guide overlaps ${cap.id} caption`);
    assert.equal(s.skip.href,'#house-rules');
    assert(s.labels.length<=1,`${context}: simultaneous rule bubbles`);
    // Production hides bubbles when the actual scene width is >=700 or the
    // viewport is too short. Do not turn that existing behavior into a failure.
    for(const label of s.labels)assert(label.rect.left>=s.view.left-1&&label.rect.right<=s.view.right+1&&label.rect.top>=s.view.top-1&&label.rect.bottom<=s.view.bottom+1,`${context}: visible rule bubble clipped`);
    expectedCamera(s).forEach((value,i)=>near(s.matrix[i],value,i<4?.0002:.25,`${context}: original camera component ${i}`));
    const t=s.t,local=Math.max(0,Math.min(1,t-2));
    const radarLocal=Math.max(0,Math.min(1,(t-5.18)/.54));
    const expected=[ease((t-3.12)/.7),ease((t-4.12)/.7),t>=2&&t<3?Math.sin(local*Math.PI*2)**2:0,t>=5.72?0:t<5?1:(1-ease(radarLocal))*(.65+.35*Math.cos(radarLocal*Math.PI*4))];
    expected.forEach((value,i)=>near(s.effects.values[i],value,.0002,`${context}: original effect ${i}`));
    assert.equal(s.effects.radar,String(t>=5.72));
    if(s.t>=10)assert(s.plaque.left>=s.view.left-1&&s.plaque.right<=s.view.right+1&&s.plaque.top>=s.view.top-1&&s.plaque.bottom<=s.view.bottom+1,`${context}: final plaque clipped ${JSON.stringify(s.plaque)}`);
    geometryChecks++;checks++;
  }
  const skip=async(t,context)=> {
    await evaluate(`document.querySelector('#house-rules').open=false`);
    await go(t);
    await evaluate(`document.querySelector('[data-skip-room]').focus({preventScroll:true});window.__skipEvent=null;document.querySelector('[data-skip-room]').addEventListener('click',e=>window.__skipEvent={trusted:e.isTrusted,detail:e.detail},{once:true})`);
    assert(await evaluate(`document.activeElement===document.querySelector('[data-skip-room]')`),`${context}: keyboard focus reaches skip`);
    await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
    await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
    await settle();
    const result=await evaluate(`(()=>{const d=document.querySelector('#house-rules'),s=d.querySelector('summary'),r=s.getBoundingClientRect(),h=document.querySelector('header').getBoundingClientRect(),room=document.querySelector('#room').getBoundingClientRect();return {open:d.open,focus:document.activeElement===s,summary:r.toJSON(),header:h.toJSON(),room:room.toJSON(),stage:document.querySelector('[data-stage]').getBoundingClientRect().toJSON(),stickyTop:parseFloat(getComputedStyle(document.querySelector('[data-stage]')).top),event:window.__skipEvent,y:scrollY}})()`);
    assert.deepEqual(result.event,{trusted:true,detail:0},`${context}: trusted keyboard activation`);
    assert(result.open&&result.focus,`${context}: skip opens details and focuses summary`);
    assert(result.stage.top<result.stickyTop-1&&result.room.bottom<=result.summary.top,`${context}: skip exits pinned scene ${JSON.stringify(result)}`);
    assert(result.summary.top>=Math.max(0,result.header.bottom)-1&&result.summary.bottom<=await evaluate('innerHeight'),`${context}: summary visible below sticky header ${JSON.stringify(result)}`);
    await evaluate('new Promise(r=>setTimeout(r,100))');
    near(await evaluate('scrollY'),result.y,.1,`${context}: instant skip, no smooth scroll drift`);
    keyboardChecks++;checks++;
  };

  for(const [width,height]of sizes) {
    await metrics(width,height);await navigate(candidatePath);
    const initial=await go(0),originalHeadings=headings(await ax()),originalRules=await staticRules();
    assert.equal(originalRules.length,5);
    for (const title of ['The maps','Prizes','2025 Husky Holiday champion']) {
      assert.equal(originalHeadings.filter(([name])=>name===title).length,1,'One static heading: '+title);
    }
    if(width===320) {
      const source=await evaluate(`Promise.all([...document.scripts].filter(s=>s.src&&new URL(s.src).origin===location.origin).map(s=>fetch(s.src).then(r=>{if(!r.ok)throw Error('Script fetch '+r.status);return r.text()}))).then(s=>s.join('\\n'))`);
      assert(!/addEventListener\s*\(\s*['"](?:wheel|mousewheel|touchstart|touchmove|touchend)['"]|\bon(?:wheel|mousewheel|touchstart|touchmove|touchend)\s*=/.test(source),'No wheel or touch interception handlers');
      assert.equal((source.match(/\.preventDefault\s*\(/g)||[]).length,2,'Only the two explicit reference-link clicks cancel defaults');
      assert.equal((source.match(/addEventListener\s*\(\s*['"]click['"]/g)||[]).length,2,'Exactly two explicit click listeners');
      for(const selector of ['[data-cap="rules"] a[href="#house-rules"]','[data-skip-room]'])assert(source.includes(`section.querySelector('${selector}').addEventListener('click', function (event) {\n      event.preventDefault();`),'Default cancellation belongs to '+selector);
      assert(/addEventListener\('scroll', onScroll, \{ passive: true \}\)/.test(source),'Scroll listener remains passive');
      console.log('PASS script audit: no wheel/touch interception; preventDefault only on the written-rules and skip clicks');
    }
    near(initial.span,initial.stage*8,1,'Room travel is exactly 8 stages');
    near(initial.section,initial.stage*9,1,'Room section is exactly 9 stages');
    near(initial.band,Math.max(initial.width<700?116:132,initial.guide.height+52+initial.capHeight),1,'Band reserves measured guide and maximum caption height');
    assert.deepEqual(await staticRules(),originalRules,'Static rule text unchanged');
    await evaluate(`window.__bandWrites=0;new MutationObserver(ms=>window.__bandWrites+=ms.length).observe(document.querySelector('[data-band]'),{attributes:true,attributeFilter:['style']})`);
    const states=new Map();
    for(const t of times) {
      const s=await go(t);states.set(t,s);assertGeometry(s,initial,`${width}x${height} t=${t}`);
      if([0,2.5,3.5,4.5,5.5,6.5,8.5,10.5].includes(t)) {
        await assertAX(originalHeadings);
        const expected=t>=9?'lan':t>=2&&t<7?rules[Math.floor(t-2)]:t<2?'maps':'prizes';
        assert.equal(s.beat,expected,`Logical beat ${width} t=${t}`);
      }
      if(t>=8&&t<=11)assert.deepEqual(s.captions.map(c=>c.id),['prizes'],'Prizes caption stays through LAN');
    }
    assert.equal(await evaluate('__bandWrites'),0,'Scroll must not resize fixed caption band');
    for(const t of [10.5,5.3,3.5,9.5,0,6.5,2.5,11,5.8,4.5]) {
      const s=await go(t),before=states.get(t);
      assert.deepEqual(s.matrix,before.matrix,`Jump/reverse restores camera ${width} t=${t}`);
      assert.deepEqual(s.effects,before.effects,`Jump/reverse restores computed effects ${width} t=${t}`);
      assertGeometry(s,initial,`reverse ${width} t=${t}`);
    }
    await metrics(width<700?1440:390,900);await go(9.5);
    await metrics(width,height);const restored=await go(9.5);
    assert.deepEqual(restored.matrix,states.get(9.5).matrix,'Resize away/back restores camera');
    assert.deepEqual(restored.effects,states.get(9.5).effects,'Resize away/back restores effects');
    assertGeometry(restored,initial,`resize ${width}`);
    for(const [name,t]of [['maps',.5],['rules',4.5],['prizes',8.5],['LAN',10.5]])await skip(t,`${width}x${height} ${name}`);
    console.log(`PASS ${width}x${height}: accessible guide, fixed band, 8-stage travel, 11-unit camera/effects, five rules, plaque, reverse/jump, resize, four trusted keyboard skips`);
  }

  // Approximate text-only zoom without scaling the layout viewport. Every
  // computed HTML font size is doubled, so explicit px captions grow too.
  await metrics(390,844);await navigate(candidatePath);
  await evaluate(`(()=>{const nodes=[...document.querySelectorAll('body *')].filter(e=>e instanceof HTMLElement&&!['SCRIPT','STYLE','CANVAS'].includes(e.tagName));const sizes=nodes.map(e=>parseFloat(getComputedStyle(e).fontSize));nodes.forEach((e,i)=>e.style.setProperty('font-size',sizes[i]*2+'px','important'));dispatchEvent(new Event('resize'))})()`);
  await settle();const enlarged=await go(0);
  for(const t of [0,2.5,4.5,8.5,10.5])assertGeometry(await go(t),enlarged,`390 text 200% t=${t}`);
  await skip(4.5,'390 text 200%');
  console.log('PASS 390x844: simulated 200% text, guide/caption separation and keyboard skip');

  await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for(const [width,height]of [[320,568],[390,844],[1440,900],[998,448]]) {
    await metrics(width,height);await navigate('/');const originalHeadings=headings(await ax()),originalRules=await staticRules();
    await navigate(candidatePath);
    const reduced=await evaluate(`(()=>{const room=document.querySelector('#room'),s=room.querySelector('[data-stage]'),guide=room.querySelector('[data-room-guide]'),r=guide.getBoundingClientRect(),d=document.querySelector('#house-rules');return {section:room.offsetHeight,stage:s.offsetHeight,position:getComputedStyle(s).position,guideHidden:getComputedStyle(guide).display==='none'||getComputedStyle(guide).visibility==='hidden'||r.height===0,open:d.open,running:document.getAnimations().filter(a=>a.playState==='running').length,overflow:document.documentElement.scrollWidth>innerWidth+1}})()`);
    assert.equal(reduced.section,reduced.stage,'Reduced motion uses one normal stage');
    assert(reduced.guideHidden&&reduced.open&&!reduced.overflow,'Reduced motion hides guide and opens static rules');
    assert.equal(reduced.running,0,'Reduced motion has no running art animations');
    assert.deepEqual(headings(await ax()),originalHeadings,'Reduced motion static headings unchanged');
    assert(!(await ax()).some(n=>n.role?.value==='link'&&n.name?.value==='Skip the cabin'),'Hidden guide removed from AX tree');
    assert.deepEqual(await staticRules(),originalRules,'Reduced motion retains all five static rules');
    await evaluate(`(()=>{const r=document.querySelector('#room');scrollTo({top:r.getBoundingClientRect().top+scrollY,behavior:'instant'})})()`);await settle();
    const before=await evaluate('scrollY');
    await page('Input.dispatchMouseEvent',{type:'mouseWheel',x:Math.min(width-1,200),y:Math.min(height-1,300),deltaX:0,deltaY:Math.max(height,900)});
    await evaluate('new Promise(r=>setTimeout(r,120))');await settle();
    assert(await evaluate('scrollY')>before+100,'Trusted wheel scroll is not trapped');
    await evaluate(`document.querySelector('#house-rules summary').scrollIntoView({behavior:'instant',block:'center'})`);await settle();
    assert(await evaluate(`(()=>{const b=document.querySelector('#house-rules summary').getBoundingClientRect();return b.top<innerHeight&&b.bottom>0})()`),'Static rules reachable through normal scrolling');
    reducedChecks++;checks++;console.log(`PASS ${width}x${height}: reduced motion, one stage, hidden guide, static rules, no animations or wheel trap`);
  }
  assert.deepEqual(errors,[],'No browser exceptions or failed network requests');
});
console.log(`PASS ${checks} checks: ${geometryChecks} geometry/camera/effect snapshots, ${keyboardChecks} trusted keyboard skips, ${reducedChecks} reduced-motion cases; plus ${accessibilityChecks} full AX comparisons, static-rule assertions and script interception audit. No browser/network errors.`);
