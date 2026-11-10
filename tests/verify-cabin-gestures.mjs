import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { withChrome } from './chrome.mjs';
const base=process.env.SITE_URL||'http://127.0.0.1:8000/';
let checks=0;
await withChrome(async({page,evaluate,load,errors})=>{
  await page('Page.enable');
  const settle=()=>evaluate('new Promise(r=>setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(r)),100))');
  const go=async t=>{
    await evaluate(`(()=>{const r=document.querySelector('#cabin'),s=r.querySelector('[data-stage]');const start=r.querySelector('[data-view]').clientWidth<700?0:1;const p=Math.max(0,Math.min(1,(${t}-start)/(10-start)));scrollTo({top:r.getBoundingClientRect().top+scrollY-parseFloat(s.style.top)+(r.getBoundingClientRect().height-s.offsetHeight)*p,behavior:'instant'})})()`);await settle();
  };
  const state=()=>evaluate(`(()=>{const v=document.querySelector('[data-view]'),b=v.getBoundingClientRect();return {y:scrollY,matrix:document.querySelector('[data-scene]').style.transform,band:document.querySelector('[data-band]').offsetHeight,x:b.left+b.width/2,cy:b.top+b.height/2}})()`);
  async function wheel(dx,dy,modifiers=0) {
    const s=await state();
    await page('Input.dispatchMouseEvent',{type:'mouseWheel',x:s.x,y:s.cy,deltaX:dx,deltaY:dy,modifiers});await settle();return state();
  }
  async function swipe(x1,y1,x2,y2) {
    await page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});
    for(let i=1;i<=8;i++) {
      await page('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/8,y:y1+(y2-y1)*i/8}]});
      await evaluate('new Promise(r=>setTimeout(r,20))');
    }
    await page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
  }
  for(const [width,height]of [[320,568],[390,844],[715,900],[1440,900],[998,448]]) {
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await load(base);await go(3.5);
    const initial=await state();
    let s=await wheel(180,0);assert(Math.abs(s.y-initial.y-180)<2,'Horizontal wheel advances');
    s=await wheel(-180,0);assert(Math.abs(s.y-initial.y)<2,'Horizontal wheel reverses');checks+=3;
    s=await wheel(0,160);assert(s.y>initial.y+100,'Native vertical wheel works');checks++;
    // Synthetic events let us inspect default prevention, unlike trusted CDP input.
    const cancellation=await evaluate(`(()=>{const v=document.querySelector('[data-view]');return [[150,0,false],[0,150,false],[100,120,false],[150,0,true]].map(([x,y,ctrl])=>{const e=new WheelEvent('wheel',{deltaX:x,deltaY:y,ctrlKey:ctrl,bubbles:true,cancelable:true});v.dispatchEvent(e);return e.defaultPrevented})})()`);
    assert.deepEqual(cancellation,[true,false,false,false],'Only horizontal non-pinch wheels canceled');checks++;
    const cue=await evaluate(`(()=>{const e=document.querySelector('[data-cabin-progress]'),b=e.getBoundingClientRect(),v=document.querySelector('[data-view]').getBoundingClientRect();return {hidden:e.querySelector('[data-progress-thumb]').getAttribute('aria-hidden'),pointer:getComputedStyle(e).pointerEvents,inside:b.left>=v.left&&b.right<=v.right&&b.top>=v.top&&b.bottom<=v.bottom,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
    assert(cue.inside&&!cue.overflow&&cue.hidden==='true'&&cue.pointer==='none');checks++;
    for(const t of [2.5,3.5,4.5,5.5,6.5,8.5,10.5]) {
      await go(t);
      assert(await evaluate(`(()=>{const rail=document.querySelector('[data-cabin-progress]');return [...document.querySelectorAll('[data-rule]')].every(e=>+getComputedStyle(e).zIndex>+getComputedStyle(rail).zIndex)})()`),'Rule bubbles paint above the decorative progress rail');checks++;
    }
    if(width===390||width===1440) {
      await go(3.5);const shot=await page('Page.captureScreenshot',{format:'png'});writeFileSync(`/tmp/husky-gestures-${width}.png`,Buffer.from(shot.data,'base64'));
    }
    await go(11);const end=await state();s=await wheel(300,0);assert(s.y>end.y+200,'Horizontal gesture can leave the cabin');checks++;
    await evaluate('scrollTo({top:0,behavior:"instant"})');await settle();
    assert.equal(await evaluate(`(()=>{const e=new WheelEvent('wheel',{deltaX:100,cancelable:true});document.querySelector('[data-view]').dispatchEvent(e);return e.defaultPrevented})()`),false,'Outside cabin is not intercepted');checks++;
    // Keyboard access still skips and focuses the static rules.
    await go(5.5);await evaluate('document.querySelector("[data-skip-room]").focus({preventScroll:true})');
    await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await settle();
    assert(await evaluate('document.querySelector("#cabin-rules").open&&document.activeElement===document.querySelector("#cabin-rules summary")'));checks++;
  }
  await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await page('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await load(base);await go(3.5);let before=await state();
  await swipe(300,before.cy,100,before.cy);let after=await state();assert(after.y>before.y+150,'Trusted swipe left advances');checks++;
  before=after;await swipe(90,before.cy,290,before.cy);after=await state();assert(after.y<before.y-150,'Trusted swipe right reverses');checks++;
  before=after;await swipe(190,before.cy+90,190,before.cy-90);after=await state();assert(after.y>before.y+100,'Native touch vertical scroll works');checks++;
  await go(3.5);before=await state();
  // Synthetic pointer events check edge exclusion and cancellation cleanup.
  const edge=await evaluate(`(()=>{const v=document.querySelector('[data-view]'),y=v.getBoundingClientRect().top+150;for(const [type,x]of [['pointerdown',8],['pointermove',150],['pointerup',150]])v.dispatchEvent(new PointerEvent(type,{pointerType:'touch',pointerId:77,clientX:x,clientY:y,bubbles:true}));return scrollY})()`);
  assert.equal(edge,before.y,'Edge swipe left to browser');checks++;
  for(const [width,height]of [[390,844],[1440,900]]) {
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await load(base);await settle();
    assert(await evaluate(`getComputedStyle(document.querySelector('[data-cabin-progress]')).display==='none'&&getComputedStyle(document.querySelector('[data-view]')).touchAction==='auto'`));
    assert.equal(await evaluate(`(()=>{const e=new WheelEvent('wheel',{deltaX:100,cancelable:true});document.querySelector('[data-view]').dispatchEvent(e);return e.defaultPrevented})()`),false);checks+=2;
  }
  assert.deepEqual(errors,[],'No browser/network errors');
});
console.log(`PASS ${checks} horizontal gesture, native vertical input, bounds, skip, cue and reduced-motion checks`);
