/* Husky Raid Holiday Tournament — page behaviour
 *
 *  1. Background snow   [data-js="snow"]         falling snow on a fixed layer behind the page
 *  2. Window snow       [data-js="window-snow"]  little snowfall inside each window of the room
 *  3. The room          [data-js="story"]        scroll-driven camera: mantel (maps) → fireplace (cabin rules) → tree (prizes)
 *  Footer reveal uses CSS sticky positioning, without a scroll handler.
 *
 * Everything respects prefers-reduced-motion.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { x = clamp01(x); return x * x * (3 - 2 * x); }

  /* ------------------------------------------------------------ 1. background snow */
  function backgroundSnow(canvas, density) {
    var ctx = canvas.getContext('2d');
    var parent = canvas.parentElement;
    var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var flakes = [], t = 0, mx = -9999, my = -9999;

    function make(init) {
      var z = Math.random();
      return { x: Math.random() * w, y: init ? Math.random() * h : -8, z: z, r: 0.6 + z * z * 3.6,
               vy: 0.25 + z * 1.1, ph: Math.random() * 6.283, a: 0.18 + z * 0.6, px: 0 };
    }
    function resize() {
      w = parent.clientWidth; h = parent.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(1600, Math.round((w * h / 6000) * density));
      flakes = [];
      for (var i = 0; i < n; i++) flakes.push(make(true));
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#FFFFFF';
      var wind = Math.sin(t * 0.002) * 0.5 + Math.sin(t * 0.0006) * 0.3;
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        if (!reduceMotion) {
          var dx = f.x - mx, dy = f.y - my, d2 = dx * dx + dy * dy;
          if (d2 < 14400) { var d = Math.sqrt(d2) || 1; f.px += (dx / d) * (1 - d / 120) * 1.2; }
          f.px *= 0.92;
          f.y += f.vy;
          f.x += wind * (0.3 + f.z) + Math.sin(f.ph + t * 0.01) * 0.3 * f.z + f.px;
          if (f.y > h + 8) flakes[i] = make(false);
          if (f.x > w + 8) f.x = -8; else if (f.x < -8) f.x = w + 8;
        }
        ctx.globalAlpha = f.a;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      t++;
      if (!reduceMotion) requestAnimationFrame(draw);
    }
    window.addEventListener('pointermove', function (e) {
      var b = canvas.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top;
    });
    document.addEventListener('pointerleave', function () { mx = -9999; my = -9999; });
    new ResizeObserver(function () { resize(); if (reduceMotion) draw(); }).observe(parent);
    resize(); draw();
  }

  /* ------------------------------------------------------------ 2. snow inside the room's windows */
  function windowSnow(canvas) {
    var ctx = canvas.getContext('2d');
    var w = canvas.clientWidth || 196, h = canvas.clientHeight || 356, k = 2;
    canvas.width = w * k; canvas.height = h * k; ctx.setTransform(k, 0, 0, k, 0, 0);
    var flakes = [], t = 0;
    function make(init) {
      var z = Math.random();
      return { x: Math.random() * w, y: init ? Math.random() * h : -4, z: z, r: 0.6 + z * 2, vy: 0.25 + z * 0.8, ph: Math.random() * 6.28 };
    }
    for (var i = 0; i < 90; i++) flakes.push(make(true));
    function draw() {
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#FFFFFF';
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        if (!reduceMotion) {
          f.y += f.vy; f.x += Math.sin(f.ph + t * 0.02) * 0.3 + 0.15;
          if (f.y > h + 4) flakes[i] = make(false);
          if (f.x > w + 4) f.x = -4;
        }
        ctx.globalAlpha = 0.35 + f.z * 0.6; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1; t++;
      if (!reduceMotion) requestAnimationFrame(draw);
    }
    draw();
  }

  /* ------------------------------------------------------------ 3. the room: scroll-driven camera */
  function room(section) {
    var stage = section.querySelector('[data-stage]');
    var band = section.querySelector('[data-band]');
    var view = section.querySelector('[data-view]');
    var scene = section.querySelector('[data-scene]');
    var header = document.querySelector('header');
    var caps = ['maps', 'rules', 'prizes'].map(function (k) { return section.querySelector('[data-cap="' + k + '"]'); });
    // Semantic order, independent of label DOM order or historical coordinates.
    var beats = ['timer', 'flags', 'friendly-fire', 'radar', 'chair'].map(function (id) {
      var el = section.querySelector('[data-rule="' + id + '"]');
      var p = el.dataset.at.split(',');
      return { id: id, el: el, x: +p[0], y: +p[1] };
    });
    // Scene-unit bounds include the artwork wrapper's 80px left inset.
    // Flags frame only the captured standards and container, not the red home flag.
    var focusBounds = {
      timer: [1274, 384, 128, 88], flags: [1404, 648, 130, 240],
      'friendly-fire': [1556, 674, 448, 180], radar: [2050, 708, 120, 130],
      chair: [2280, 600, 270, 280],
      // 80px artwork inset + 2500px tree shift + gift positions.
      // Include the highest bow, not just the rectangular box bodies.
      gifts: [2675, 629, 620, 291], leaderboard: [3780, 365, 400, 138]
    };
    var progress = section.querySelector('[data-cabin-progress]');
    var progressThumb = progress.querySelector('[data-progress-thumb]');
    var progressFill = progress.querySelector('[data-progress-fill]');
    var progressHint = progress.querySelector('[data-progress-hint]');
    var progressTravel = 0, progressUsed = false;
    var focus = section.querySelector('[data-rule-focus]');
    var focusPaths = focus.querySelectorAll('path');
    var steam = section.querySelectorAll('[data-steam]');
    var noseRings = section.querySelectorAll('[data-nose-ring]');
    var stepText = section.querySelector('[data-rule-step]');
    var reference = document.querySelector('#cabin-rules');
    if (reduceMotion) reference.open = true;
    section.querySelector('[data-cap="rules"] a[href="#cabin-rules"]').addEventListener('click', function (event) {
      event.preventDefault();
      reference.open = true;
      reference.scrollIntoView({ behavior: 'instant', block: 'start' });
      reference.querySelector('summary').focus({ preventScroll: true });
    });
    var SW = 4370, SH = 1000, sceneLeft = 1100, treeCenter = 3080;
    var roomObjects = scene.firstElementChild;
    var ceilingLights = scene.querySelector('.cabin-lights');
    var raf = 0, vw = 0, sh = 0, top = 0, vv = 0, captionHeight = 0;
    var travel = 11;
    // Preserve the original middle pace of eight stage-heights per eleven units.
    var scrollLengths = 8;
    // Desktop begins at the first camera move. Phones retain their original map pan.
    // Finish when LAN settles at logical t=10, with no final hold to scroll through.
    var openingTravel = 0, timelineTravel = 9;
    var guide = section.querySelector('[data-room-guide]');
    section.querySelector('[data-skip-room]').addEventListener('click', function (event) {
      event.preventDefault();
      reference.open = true;
      // Do not animate a skip through the same scene the visitor is leaving.
      // Measure the actual header, including enlarged/wrapped text. A fixed
      // scroll-margin can leave the focused summary underneath a taller header.
      var headerBottom = Math.max(0, header.getBoundingClientRect().bottom);
      var target = reference.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: target - headerBottom - 12, behavior: 'instant' });
      reference.querySelector('summary').focus({ preventScroll: true });
    });

    function geometry() {
      // Preserve desktop artwork and floor coordinates on every screen.
      var treeScale = Math.max(vw / 2580, Math.min(vw / 1160, vv / SH));
      SW = Math.max(4370, treeCenter + vw / treeScale / 2);
      scene.style.height = SH + 'px';
      scene.style.width = SW + 'px';
      scene.style.setProperty('--tree-shift', '2500px');
      roomObjects.style.width = (SW - 80) + 'px';
      ceilingLights.setAttribute('viewBox', '0 0 ' + SW * 70 / 93 + ' 70');
    }
    function shot(cx, cy, s) {
      var hw = vw / (2 * s), hh = vv / (2 * s);
      cx = 2 * hw >= SW - sceneLeft ? (sceneLeft + SW) / 2 : Math.min(Math.max(cx, sceneLeft + hw), SW - hw);
      cy = 2 * hh >= SH ? SH / 2 : Math.min(Math.max(cy, hh), SH - hh);
      return { s: s, x: vw / 2 - cx * s, y: vv / 2 - cy * s };
    }
    function mix(a, b, e) { return { s: a.s + (b.s - a.s) * e, x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }; }
    function show(el, o) { el.style.opacity = o; el.style.visibility = o > 0.01 ? '' : 'hidden'; }

    // No entry timers: jumping, reversing and restoring scroll give the same art.
    function effects(t) {
      var flag = reduceMotion ? 1 : ease((t - 3.12) / .7);
      var shield = reduceMotion ? 1 : ease((t - 4.12) / .7);
      var clockLocal = clamp01(t - 2);
      var clockPulse = !reduceMotion && t >= 2 && t < 3 ? Math.pow(Math.sin(clockLocal * Math.PI * 2), 2) : 0;
      // Hold the signal while the camera starts its radar pan, then flicker off.
      var radarLocal = clamp01((t - 5.18) / .54);
      // Two soft dips, then a fade to off. No binary or timed flashing.
      var nose = reduceMotion || t >= 5.72 ? 0 : t < 5 ? 1 :
        (1 - ease(radarLocal)) * (.65 + .35 * Math.cos(radarLocal * Math.PI * 4));
      scene.style.setProperty('--flag-raised', flag.toFixed(4));
      scene.style.setProperty('--shield-deployed', shield.toFixed(4));
      scene.style.setProperty('--clock-pulse', clockPulse.toFixed(4));
      scene.style.setProperty('--nose-light', nose.toFixed(4));
      scene.dataset.radarOff = String(reduceMotion || t >= 5.72);
      // Staggered outgoing rings stay concentric and fade with distance.
      noseRings.forEach(function (ring, i) {
        var phase = (t * 1.5 + i / 3) % 1;
        var opacity = reduceMotion ? 0 : nose * .8 * (1 - phase) * ease(phase / .12);
        ring.setAttribute('r', (10 + phase * 36).toFixed(3));
        ring.style.opacity = opacity.toFixed(4);
      });
      steam.forEach(function (path, i) {
        var local = clamp01(t - 6);
        var phase = (local * 1.4 + i * .24) % 1;
        var opacity = reduceMotion ? .5 : t >= 6 && t < 7 ? Math.sin(phase * Math.PI) * .75 * ease(local / .15) * ease((1 - local) / .15) : 0;
        path.style.opacity = opacity.toFixed(4);
        path.style.transform = reduceMotion ? 'none' : 'translate(' + (Math.sin(phase * Math.PI * 2) * 4).toFixed(2) + 'px,' + (-phase * 18).toFixed(2) + 'px)';
      });
    }

    function drawFocus(bounds, cam, opacity) {
      var pad = 9;
      var x = Math.max(5, cam.x + bounds[0] * cam.s - pad);
      var y = Math.max(5, cam.y + bounds[1] * cam.s - pad);
      var right = Math.min(vw - 5, cam.x + (bounds[0] + bounds[2]) * cam.s + pad);
      var bottom = Math.min(vv - 5, cam.y + (bounds[1] + bounds[3]) * cam.s + pad);
      var leg = Math.min(28, (right - x) / 3, (bottom - y) / 3);
      var d = 'M' + x + ',' + (y + leg) + 'V' + y + 'H' + (x + leg) +
        'M' + (right - leg) + ',' + y + 'H' + right + 'V' + (y + leg) +
        'M' + right + ',' + (bottom - leg) + 'V' + bottom + 'H' + (right - leg) +
        'M' + (x + leg) + ',' + bottom + 'H' + x + 'V' + (bottom - leg);
      focusPaths.forEach(function (path) { path.setAttribute('d', d); });
      show(focus, right > x && bottom > y ? opacity : 0);
    }

    // Measure the small viewport, not the toolbar-dependent innerHeight.
    // Keep camera framing, stage height and scroll distance on the same basis.
    var viewportMeasure = document.createElement('div');
    viewportMeasure.dataset.smallViewport = '';
    viewportMeasure.setAttribute('aria-hidden', 'true');
    viewportMeasure.style.cssText = 'position:absolute;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none;overflow:hidden;';
    section.appendChild(viewportMeasure);
    var hasSmallViewport = CSS.supports('height', '100svh');

    function layout() {
      vw = view.clientWidth || stage.clientWidth;
      var hh = header ? header.offsetHeight : 0;
      var viewportHeight = hasSmallViewport ? viewportMeasure.getBoundingClientRect().height : window.innerHeight;
      var avail = viewportHeight - hh;
      if (reduceMotion) {
        band.style.height = 'auto';
        caps.forEach(function (c) { c.style.position = 'static'; c.style.padding = '10px 24px'; show(c, 1); });
      }
      var bh = reduceMotion ? band.offsetHeight : Math.max(vw < 700 ? 116 : 132,
        Math.max.apply(null, caps.map(function (c) { return c.offsetHeight; })) + 36);
      // Reserve the navigation row once during layout. It never overlays art
      // or enters the aria-hidden animated caption subtree.
      if (!reduceMotion) bh = Math.max(bh, guide.offsetHeight + 52 +
        Math.max.apply(null, caps.map(function (c) { return c.offsetHeight; })));
      captionHeight = bh;
      if (!reduceMotion) band.style.height = bh + 'px';
      sh = Math.max(vw < 700 ? 320 : 460, avail);
      vv = Math.max(120, sh - bh);
      top = hh;
      stage.style.height = sh + 'px';
      stage.style.top = top + 'px';
      progressTravel = Math.max(0, progress.clientHeight - progressThumb.offsetHeight);
      geometry();
      openingTravel = vw < 700 ? 1 : 0;
      timelineTravel = openingTravel + 9;
      // Keep the middle journey's physical pace exactly as before.
      scrollLengths = 8 * timelineTravel / travel;
      section.style.height = (reduceMotion ? sh : sh * (scrollLengths + 1)) + 'px';
      update();
    }

    function update() {
      raf = 0;
      var phone = vw < 700;
      var r = section.getBoundingClientRect();
      var p = clamp01((top - r.top) / Math.max(1, r.height - sh));
      var distance = p * timelineTravel;
      var t = openingTravel && distance < openingTravel ? distance / openingTravel : 1 + distance - openingTravel;
      var lanReveal = ease(t - 9);
      // Keep Prizes visible and the scene viewport fixed through the LAN pan.
      if (!reduceMotion) vv = sh - captionHeight;
      var enter = ease(t - 1), leave = ease(t - 7);
      var mapsScale = Math.max(Math.min(vw / 1000, vv / 440) * .95, vw / 1180);
      // Keep the phone map pass above the hearth, with one frame column
      // in focus at a time. Pan across the original wall, without moving art.
      var maps = phone ? shot(1515 + 525 * ease(t), 270, Math.max(vw / 480, vv / 580)) : shot(1780, 270, mapsScale);
      var fireScale = Math.max(vw / 1480, vv / SH);
      var fire = shot(1840, SH - vv / (2 * fireScale), fireScale);
      var treeScale = Math.max(vw / 2580, Math.min(vw / 1160, vv / SH));
      // A short phone pan reveals the podium in place, left to right.
      if (phone) treeScale = Math.max(vw / 780, vv / SH);
      var tree = shot(phone ? 2920 + 160 * ease(t - 8) : treeCenter, SH - vv / (2 * treeScale), treeScale);
      // A room-scale visit, not a trophy zoom. Phones frame the plaque and nearby stations.
      var lanScale = phone ? vw / 560 : Math.min(vw / 1120, vv / SH);
      var lan = shot(phone ? 3980 : 3910, 570, lanScale);
      // Mobile visits each original prop instead of moving the props inward.
      var ruleShots = beats.map(function (beat) {
        if (phone) return shot(beat.x, beat.id === 'flags' ? 650 : beat.y - 60, Math.max(vw / 500, vv / 820));
        // Keep the stand in frame on narrow desktops; lift the timer to the mantel.
        if (beat.id === 'flags') return shot(Math.min(1840, 1220 + vw / (2 * fireScale)), SH - vv / (2 * fireScale), fireScale);
        return beat.id === 'timer' ? shot(1840, SH - vv / (2 * fireScale) - 130, fireScale) : fire;
      });
      var index = Math.min(4, Math.max(0, Math.floor(t - 2)));
      var activeShot = ruleShots[index];
      if (index > 0) activeShot = mix(ruleShots[index - 1], activeShot, ease((t - 2 - index) / .24));
      var cam = t < 2 ? mix(maps, ruleShots[0], enter) :
        t < 7 ? activeShot : mix(mix(ruleShots[4], tree, leave), lan, lanReveal);
      if (reduceMotion) cam = shot((sceneLeft + SW) / 2, SH / 2, Math.min(vw / (SW - sceneLeft), vv / SH));
      else {
        [1 - enter, enter * (1 - leave), leave].forEach(function (o, i) { show(caps[i], o); });
      }
      var stepLabel = reduceMotion ? 'All rules listed below.' : 'Rule ' + (index + 1) + ' of 5';
      stepText.textContent = stepLabel;
      section.dataset.beat = t >= 9 ? 'lan' : t >= 2 && t < 7 ? beats[index].id : t < 2 ? 'maps' : 'prizes';
      effects(t);
      show(focus, 0);
      // One scroll-linked indicator for vertical and horizontal input alike.
      var progressActive = !reduceMotion && r.top <= top + 1 && r.bottom >= top + sh - 1;
      progress.dataset.active = String(progressActive);
      if (p > .001) progressUsed = true;
      if (progressUsed) progress.dataset.used = 'true';
      progressThumb.style.transform = 'translateY(' + (p * progressTravel).toFixed(2) + 'px)';
      progressFill.style.transform = 'scaleY(' + p.toFixed(5) + ')';
      var hintOpacity = 1 - ease(p / .04);
      show(progressHint, hintOpacity);
      scene.style.transform = 'translate(' + cam.x.toFixed(1) + 'px,' + cam.y.toFixed(1) + 'px) scale(' + cam.s.toFixed(4) + ')';
      beats.forEach(function (beat, i) {
        var bounds = focusBounds[beat.id];
        var lx = cam.x + (bounds[0] + bounds[2] / 2) * cam.s;
        var ly = Math.max(60, cam.y + bounds[1] * cam.s - 9);
        beat.el.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px)';
        var tip = beat.el.lastElementChild;
        var half = tip.offsetWidth / 2;
        var tipX = Math.max(half + 12, Math.min(lx, vw - half - 12));
        tip.style.left = (tipX - lx).toFixed(1) + 'px';
        tip.style.bottom = '14px';
        // A short quiet gap between bubbles while the phone camera moves.
        var local = t - (2 + i);
        var opacity = local >= 0 && local < 1 ? Math.min(ease(local / .24), ease((1 - local) / .12)) : 0;
        var visible = !reduceMotion && lx > 0 && lx < vw && ly > tip.offsetHeight + 16 && ly < vv ? opacity : 0;
        show(beat.el, visible);
        if (i === index && t >= 2 && t < 7) drawFocus(bounds, cam, visible);
      });
      // Keep brackets quiet during the camera moves. One target at a time,
      // using the same screen-space padding, strokes and corners as the rules.
      if (!reduceMotion && t >= 7.7 && t < 9.2) {
        drawFocus(focusBounds.gifts, cam, Math.min(ease((t - 7.7) / .3), ease((9.2 - t) / .3)));
      } else if (!reduceMotion && t >= 9.8) {
        drawFocus(focusBounds.leaderboard, cam, ease((t - 9.8) / .2));
      }
    }

    // Horizontal input changes the page's existing scroll position.
    // No second timeline, snapping, animation loop, or vertical-scroll interception.
    function cabinPinned() {
      var rect = section.getBoundingClientRect();
      return !reduceMotion && rect.top <= top + 1 && rect.bottom >= top + sh - 1;
    }
    function interactiveTarget(target) {
      return target.closest('a, button, input, select, textarea, summary, [contenteditable="true"]');
    }
    view.addEventListener('wheel', function (event) {
      if (!cabinPinned() || event.ctrlKey || event.metaKey || interactiveTarget(event.target) ||
          Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.2 || !event.deltaX) return;
      // Normalize wheel line/page units. Trackpads normally report CSS pixels.
      var unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? sh : 1;
      event.preventDefault();
      window.scrollBy({ top: event.deltaX * unit, behavior: 'instant' });
    }, { passive: false });

    if (!reduceMotion) view.style.touchAction = 'pan-y pinch-zoom';
    var swipe = null;
    var touchPointers = new Set();
    view.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'touch') return;
      touchPointers.add(event.pointerId);
      if (touchPointers.size !== 1) { swipe = null; return; }
      // Leave screen-edge gestures to the browser and OS. Never capture a pointer.
      if (!cabinPinned() || interactiveTarget(event.target) || event.clientX < 24 || event.clientX > innerWidth - 24) return;
      swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, last: event.clientX, axis: null };
    }, { passive: true });
    view.addEventListener('pointermove', function (event) {
      if (!swipe || event.pointerId !== swipe.id || !cabinPinned()) return;
      var dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
      if (!swipe.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
        swipe.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'horizontal' : 'vertical';
      }
      if (swipe.axis === 'horizontal') {
        // Finger left advances, finger right reverses, just like a horizontal scroller.
        window.scrollBy({ top: swipe.last - event.clientX, behavior: 'instant' });
      }
      swipe.last = event.clientX;
    }, { passive: true });
    function endSwipe(event) {
      touchPointers.delete(event.pointerId);
      if (swipe && swipe.id === event.pointerId) swipe = null;
    }
    window.addEventListener('pointerup', endSwipe, { passive: true });
    window.addEventListener('pointercancel', endSwipe, { passive: true });
    window.addEventListener('blur', function () { swipe = null; touchPointers.clear(); });

    function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
    var layoutObserver = new ResizeObserver(layout);
    layoutObserver.observe(stage);
    // Real small-viewport changes, such as rotation, still need a new layout.
    layoutObserver.observe(viewportMeasure);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', layout);
    // Font wrapping can resize the guide without changing the stage dimensions.
    document.fonts.ready.then(layout);
    document.fonts.addEventListener('loadingdone', layout);
    layout();
  }

  /* ------------------------------------------------------------ boot */
  function boot() {
    document.querySelectorAll('[data-js="snow"]').forEach(function (c) { backgroundSnow(c, 1); });
    document.querySelectorAll('[data-js="window-snow"]').forEach(windowSnow);
    document.querySelectorAll('[data-js="story"]').forEach(room);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
