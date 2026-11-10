import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { withChrome } from './chrome.mjs';
const base = process.env.SITE_URL || 'http://127.0.0.1:8000/';
let checks = 0;
await withChrome(async ({ page, evaluate, load, errors }) => {
  await page('Page.enable');
  const settle = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
  async function go(t) {
    await evaluate(`(()=>{const r=document.querySelector('#room'),s=r.querySelector('[data-stage]');const start=r.querySelector('[data-view]').clientWidth<700?0:1;const p=Math.max(0,Math.min(1,(${t}-start)/(10-start)));scrollTo({top:r.getBoundingClientRect().top+scrollY-parseFloat(getComputedStyle(s).top)+(r.getBoundingClientRect().height-s.offsetHeight)*p,behavior:'instant'})})()`);
    await settle();
    return evaluate(`(()=>{
      const f=document.querySelector('[data-rule-focus]'),v=document.querySelector('[data-view]'),s=document.querySelector('[data-scene]');
      const rect=e=>{const b=e.getBoundingClientRect(),a=v.getBoundingClientRect();return [b.x-a.x,b.y-a.y,b.right-a.x,b.bottom-a.y]};
      const gifts=[...document.querySelectorAll('.podium-gift,.podium-gift .gift-bow')].map(rect);
      return {matrix:getComputedStyle(s).transform,band:document.querySelector('[data-band]').offsetHeight,
        opacity:+f.style.opacity,visible:getComputedStyle(f).visibility!=='hidden'&&getComputedStyle(f).display!=='none',
        frame:rect(f.querySelector('path')),view:[v.clientWidth,v.clientHeight],plaque:rect(document.querySelector('[data-winner-plaque]')),
        gifts:[Math.min(...gifts.map(b=>b[0])),Math.min(...gifts.map(b=>b[1])),Math.max(...gifts.map(b=>b[2])),Math.max(...gifts.map(b=>b[3]))]};
    })()`);
  }
  for (const [width,height] of [[320,568],[390,844],[448,998],[715,900],[1440,900],[998,448]]) {
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    const times=[6.5,7.5,7.85,8,8.5,9,9.4,9.9,10,10.5,11];
    await load(base); await settle();
    const initial = await go(0);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-rule-focus] path')].map(p=>getComputedStyle(p).strokeWidth)`), ['10px','5px'], 'Chunkier strokes on shared focus overlay');
    for (let i=0;i<times.length;i++) {
      const t=times[i],s=await go(t);
      assert.equal(s.band,initial.band,'Caption band unchanged');
      if (t===9.4||t===7.5) assert(!s.visible,'Quiet camera transition');
      if(t>=8&&t<=9||t>=10) {
        assert(s.visible&&s.opacity>(t===9?.6:.98),`Visible focus ${width} t=${t}`);
        const target=t<9.2?s.gifts:s.plaque;
        const expected=[Math.max(5,target[0]-9),Math.max(5,target[1]-9),Math.min(s.view[0]-5,target[2]+9),Math.min(s.view[1]-5,target[3]+9)];
        s.frame.forEach((n,k)=>assert(Math.abs(n-expected[k])<.5,`Frame geometry ${width} t=${t}: ${s.frame} vs ${expected}`));
      }
      if((width===1440||width===390)&&(t===8.5||t===10.5)) {
        const {data}=await page('Page.captureScreenshot',{format:'png'});
        writeFileSync(`/tmp/husky-brackets-${width}-${t}.png`,Buffer.from(data,'base64'));
      }
      checks++;
    }
    await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await load(base);await settle();
    assert(!(await go(10.5)).visible,'Reduced-motion focus stays hidden');checks++;
    await page('Emulation.setEmulatedMedia',{features:[]});
  }
  assert.deepEqual(errors,[],'No browser/network errors');
});
console.log(`PASS ${checks} bracket checks across six viewport sizes`);
