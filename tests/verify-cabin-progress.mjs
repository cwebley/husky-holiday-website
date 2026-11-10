import assert from 'node:assert/strict';
import{writeFileSync}from'node:fs';
import{withChrome}from'./chrome.mjs';
const candidate=process.env.SITE_URL||'http://127.0.0.1:8000/';
let checks=0;
await withChrome(async({page,load,evaluate,errors})=>{
 await page('Page.enable');await page('Accessibility.enable');
 const settle=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
 const snap=()=>evaluate(`(()=>{const r=document.querySelector('#room'),s=r.querySelector('[data-stage]'),v=r.querySelector('[data-view]'),c=r.querySelector('[data-scene]'),f=r.querySelector('[data-rule-focus]'),rail=r.querySelector('[data-cabin-progress]');const rect=e=>e.getBoundingClientRect().toJSON();const q=rail&&rail.querySelector('[data-progress-thumb]');return {y:scrollY,span:r.getBoundingClientRect().height-s.offsetHeight,band:r.querySelector('[data-band]').offsetHeight,matrix:c.style.transform,beat:r.dataset.beat,effects:['--flag-raised','--shield-deployed','--clock-pulse','--nose-light'].map(k=>+getComputedStyle(c).getPropertyValue(k)),focus:+f.style.opacity,labels:[...r.querySelectorAll('[data-rule]')].filter(e=>+e.style.opacity>.01).map(e=>[e.dataset.rule,rect(e.lastElementChild)]),view:rect(v),overflow:document.documentElement.scrollWidth>innerWidth,rail:rail&&{rect:rect(rail),thumb:rect(q),fill:getComputedStyle(rail.querySelector('[data-progress-fill]')).transform,used:rail.dataset.used,active:rail.dataset.active,display:getComputedStyle(rail).display,hintOpacity:+rail.querySelector('[data-progress-hint]').style.opacity,nudge:getComputedStyle(q.querySelector('svg')).animationName,animations:rail.getAnimations({subtree:true}).filter(a=>a.playState==='running').length}}})()`);
 async function go(p){await evaluate(`(()=>{const r=document.querySelector('#room'),s=r.querySelector('[data-stage]');scrollTo({top:r.getBoundingClientRect().top+scrollY-parseFloat(s.style.top)+(r.getBoundingClientRect().height-s.offsetHeight)*${p},behavior:'instant'})})()`);await settle();return snap();}
 const near=(a,b,tol,msg)=>assert(Math.abs(a-b)<=tol,`${msg}: ${a} vs ${b}`);
 const ax=async()=>(await page('Accessibility.getFullAXTree')).nodes.filter(n=>!n.ignored);
 const headings=nodes=>nodes.filter(n=>n.role?.value==='heading').map(n=>n.name?.value).sort();
 for(const[width,height]of[[320,568],[390,844],[448,998],[715,900],[1440,900],[998,448]]){
  await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const ps=[0,.005,.02,.04,.1,.2,.3,.4,.5,.6,.7,.8,.9,1];
  await load(candidate);await settle();const originalHeadings=headings(await ax());
  assert.equal(await evaluate('document.querySelectorAll(".room-guide p,.cabin-scroll-cue").length'),0,'Old cues removed');checks++;
  const initial=await go(0);
  assert.equal(initial.rail.nudge,'cabin-scroll-nudge','Initial arrow nudge');assert(initial.rail.hintOpacity>.99);checks++;
  for(let i=0;i<ps.length;i++){
   const p=ps[i],s=await go(p);
   assert.equal(s.band,initial.band,'Fixed caption band');near(s.span,initial.span,.01,'Fixed travel');assert(!s.overflow);
   if(p===1){assert.equal(s.beat,'lan');near(s.focus,1,.01,'LAN settled at endpoint');}
   const r=s.rail;assert.equal(r.active,'true');assert(r.rect.top>=s.view.top&&r.rect.bottom<=s.view.bottom);
   const progress=(r.thumb.top-r.rect.top)/(r.rect.height-r.thumb.height);
   near(progress,p,.001,'Arrow follows actual journey');
   if(p>=.04)assert(r.hintOpacity<.001,'Hint fades after initial movement');
   if(p>0.005){assert.equal(r.nudge,'none','No idle nudge after interaction');assert.equal(r.animations,0,'No continuous animation');}
   checks++;
   if((width===390||width===1440)&&[0,.4,1].includes(p)){
    const shot=await page('Page.captureScreenshot',{format:'png'});writeFileSync(`/tmp/husky-progress-${width}-${p}.png`,Buffer.from(shot.data,'base64'));
   }
  }
  const reverse=await go(.4);near((reverse.rail.thumb.top-reverse.rail.rect.top)/(reverse.rail.rect.height-reverse.rail.thumb.height),.4,.001,'Reverse updates marker');
  await go(0);assert.equal((await snap()).rail.nudge,'none','Returning to start does not restart nudge');checks++;
  const nodes=await ax();assert.deepEqual(headings(nodes),originalHeadings);
  assert.equal(nodes.filter(n=>n.role?.value==='StaticText'&&n.name?.value==='Scroll or swipe to explore the cabin. Use Skip the cabin to continue without the tour.').length,1,'One accessible instruction');
  assert.equal(nodes.filter(n=>n.role?.value==='link'&&n.name?.value==='Skip the cabin').length,1);checks++;
  await go(.4);let before=await snap();
  await page('Input.dispatchMouseEvent',{type:'mouseWheel',x:before.view.x+before.view.width/2,y:before.view.y+before.view.height/2,deltaX:160,deltaY:0});
  await evaluate('new Promise(r=>setTimeout(r,120))');let after=await snap();assert(after.y>before.y+100&&after.rail.thumb.top>before.rail.thumb.top,'Horizontal gesture advances rail');checks++;
  await evaluate('document.querySelector("[data-skip-room]").focus({preventScroll:true})');
  await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await settle();
  assert(await evaluate('document.querySelector("#house-rules").open&&document.activeElement===document.querySelector("#house-rules summary")'));checks++;
  console.log(`PASS ${width}x${height}: progress geometry, fixed viewport, fade/nudge, reverse, horizontal input, AX and skip`);
 }
 await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await page('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await load(candidate);await go(.4);let touchBefore=await snap();
 const swipe=async(x1,y1,x2,y2)=>{
  await page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});
  for(let i=1;i<=8;i++){
   await page('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/8,y:y1+(y2-y1)*i/8}]});
   await evaluate('new Promise(r=>setTimeout(r,20))');
  }
  await page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
 };
 let cy=touchBefore.view.y+touchBefore.view.height/2;
 await swipe(300,cy,100,cy);let touchAfter=await snap();assert(touchAfter.y>touchBefore.y+150&&touchAfter.rail.thumb.top>touchBefore.rail.thumb.top,'Touch left advances progress');checks++;
 touchBefore=touchAfter;await swipe(90,cy,290,cy);touchAfter=await snap();assert(touchAfter.y<touchBefore.y-150&&touchAfter.rail.thumb.top<touchBefore.rail.thumb.top,'Touch right reverses progress');checks++;
 touchBefore=touchAfter;await swipe(190,cy+90,190,cy-90);touchAfter=await snap();assert(touchAfter.y>touchBefore.y+100,'Native vertical touch remains available');checks++;
 await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 for(const width of[320,390,1440]){
  await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await load(candidate);await settle();
  assert.equal((await snap()).rail.display,'none');
  assert(await evaluate('document.getAnimations().filter(a=>a.playState==="running").length===0&&document.querySelector("#house-rules").open'));
  assert(!(await ax()).some(n=>n.name?.value?.includes('Scroll or swipe to explore')),'Reduced motion has no scroll cue in AX');checks++;
 }
 assert.deepEqual(errors,[]);
});
console.log(`PASS ${checks} progress cue and preservation checks; no browser/network errors`);
