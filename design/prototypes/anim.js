/* Pergament hero animation — vanilla port of src/remotion/DocToEpub.tsx.
   96 frames @ 30fps: book spread -> page scan -> EPUB on phone.
   Every colour reads from a CSS custom property so each prototype recolours it
   without touching this file. Exposes window.PergamentHero.mount(). */
(function () {
  "use strict";

  var TOTAL = 96;
  var FPS = 30;
  var BASE = 420; // design-space square; scaled to fit the host element

  /* ── easing ── */
  function cubicBezier(p1x, p1y, p2x, p2y) {
    var cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
    var cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
    function sx(t) { return ((ax * t + bx) * t + cx) * t; }
    function sy(t) { return ((ay * t + by) * t + cy) * t; }
    function dx(t) { return (3 * ax * t + 2 * bx) * t + cx; }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x, i, e, d;
      for (i = 0; i < 8; i++) {
        e = sx(t) - x;
        if (Math.abs(e) < 1e-5) return sy(t);
        d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      var lo = 0, hi = 1;
      t = x;
      for (i = 0; i < 20; i++) {
        e = sx(t);
        if (Math.abs(e - x) < 1e-5) break;
        if (x > e) lo = t; else hi = t;
        t = (hi + lo) / 2;
      }
      return sy(t);
    };
  }
  var ease = cubicBezier(0.65, 0, 0.35, 1);
  var easeOut = cubicBezier(0.16, 1, 0.3, 1);

  /* Multi-point interpolation, clamped at both ends (Remotion semantics). */
  function interp(f, input, output, eas) {
    var n = input.length;
    if (f <= input[0]) return output[0];
    if (f >= input[n - 1]) return output[n - 1];
    var i = 0;
    while (i < n - 2 && f > input[i + 1]) i++;
    var t = (f - input[i]) / (input[i + 1] - input[i]);
    if (eas) t = eas(t);
    return output[i] + (output[i + 1] - output[i]) * t;
  }

  /* ── injected stylesheet (once per document) ── */
  var CSS = [
    /* No --a-* declarations here: the host page owns the palette on :root and
       every use site below carries its own fallback. */
    ".pgh{position:relative;width:100%;height:100%;overflow:hidden}",
    ".pgh-scale{position:absolute;left:50%;top:50%;width:420px;height:420px;",
    "transform-origin:center center}",
    ".pgh-layer{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}",
    ".pgh-lines{display:flex;flex-direction:column;justify-content:center;",
    "gap:9%;height:100%;padding:14%;box-sizing:border-box}",
    ".pgh-lines i{display:block;height:3px;border-radius:1px;",
    "background:var(--a-ink,#16243a);opacity:.6}",
    /* book */
    ".pgh-book{position:relative;width:380px;height:270px;perspective:1400px;",
    "filter:drop-shadow(0 16px 30px rgba(21,48,89,.20))}",
    ".pgh-book-base{position:absolute;inset:0;background:var(--a-paper,#ffffff);",
    "border-radius:4px;box-shadow:inset 0 0 0 1px var(--a-edge,#cbd9ee)}",
    ".pgh-edge{position:absolute;top:4px;bottom:4px;width:5px;background:var(--a-edge,#cbd9ee)}",
    ".pgh-edge-l{left:0;border-radius:4px 0 0 4px}",
    ".pgh-edge-r{right:0;border-radius:0 4px 4px 0}",
    ".pgh-spine{position:absolute;top:0;bottom:0;left:50%;width:10px;margin-left:-5px;",
    "background:linear-gradient(90deg,rgba(21,48,89,0) 0%,rgba(21,48,89,.16) 50%,rgba(21,48,89,0) 100%)}",
    ".pgh-half{position:absolute;top:0;bottom:0;width:50%}",
    ".pgh-half-l{left:0}.pgh-half-r{right:0}",
    ".pgh-flip{position:absolute;top:0;bottom:0;left:50%;width:50%;",
    "transform-style:preserve-3d;transform-origin:left center}",
    ".pgh-face{position:absolute;inset:0;backface-visibility:hidden;",
    "-webkit-backface-visibility:hidden;border-radius:0 4px 4px 0}",
    ".pgh-face-f{background:var(--a-paper,#ffffff);box-shadow:0 0 22px rgba(21,48,89,.22)}",
    ".pgh-face-b{background:var(--a-shade,#eef3fb);transform:rotateY(180deg)}",
    /* camera */
    ".pgh-cam{position:relative;width:240px;height:320px;",
    "filter:drop-shadow(0 16px 30px rgba(21,48,89,.20))}",
    ".pgh-sheet{position:absolute;inset:0;background:var(--a-paper,#ffffff);border-radius:4px;",
    "overflow:hidden;box-shadow:inset 0 0 0 1px var(--a-edge,#cbd9ee)}",
    ".pgh-scan{position:absolute;left:0;right:0;height:2px;background:var(--a-accent,#1d4ed8);",
    "box-shadow:0 0 26px var(--a-accent,#1d4ed8),0 0 8px var(--a-accent,#1d4ed8)}",
    ".pgh-flash{position:absolute;inset:0;background:var(--a-accent,#1d4ed8);opacity:0}",
    ".pgh-lens{position:absolute;width:130px;height:130px;margin-left:-65px;margin-top:-65px}",
    ".pgh-lens-ring{width:100%;height:100%;border-radius:50%;",
    "border:3px solid var(--a-accent,#1d4ed8);background:color-mix(in srgb,var(--a-accent,#1d4ed8) 7%,transparent);",
    "position:relative;box-shadow:0 0 34px color-mix(in srgb,var(--a-accent,#1d4ed8) 32%,transparent),",
    "inset 0 0 18px color-mix(in srgb,var(--a-accent,#1d4ed8) 16%,transparent)}",
    ".pgh-lens-ring::before{content:'';position:absolute;inset:14px;border-radius:50%;",
    "border:1.5px solid var(--a-accent,#1d4ed8);opacity:.45}",
    ".pgh-cross-h,.pgh-cross-v{position:absolute;background:var(--a-accent,#1d4ed8);opacity:.7}",
    ".pgh-cross-h{top:50%;left:6px;right:6px;height:1px;margin-top:-.5px}",
    ".pgh-cross-v{left:50%;top:6px;bottom:6px;width:1px;margin-left:-.5px}",
    ".pgh-dot{position:absolute;top:50%;left:50%;width:6px;height:6px;margin:-3px 0 0 -3px;",
    "border-radius:50%;background:var(--a-accent,#1d4ed8)}",
    /* phone */
    ".pgh-phone{position:relative;width:188px;height:340px;",
    "filter:drop-shadow(0 20px 38px rgba(21,48,89,.26))}",
    ".pgh-phone-body{position:absolute;inset:0;background:var(--a-frame,#17263d);border-radius:28px;",
    "padding:6px;box-sizing:border-box;border:1px solid var(--a-frame-line,#2c3f5e)}",
    ".pgh-screen{width:100%;height:100%;background:var(--a-paper,#ffffff);border-radius:22px;",
    "overflow:hidden;position:relative}",
    ".pgh-ebook{position:absolute;inset:0;padding:22px 14px;box-sizing:border-box;",
    "display:flex;flex-direction:column;gap:7px}",
    ".pgh-ebook b{display:block;height:7px;width:55%;background:var(--a-ink,#16243a);opacity:.88;",
    "border-radius:1px;margin-bottom:6px}",
    ".pgh-ebook i{display:block;height:3px;border-radius:1px;background:var(--a-ink,#16243a);opacity:.55}",
    ".pgh-finger{position:absolute;top:55%;width:26px;height:26px;margin:-13px 0 0 -13px;",
    "border-radius:50%;background:color-mix(in srgb,var(--a-accent,#1d4ed8) 45%,transparent);",
    "border:2px solid var(--a-accent,#1d4ed8);",
    "box-shadow:0 0 20px color-mix(in srgb,var(--a-accent,#1d4ed8) 45%,transparent)}"
  ].join("");

  function injectCss() {
    if (document.getElementById("pgh-style")) return;
    var s = document.createElement("style");
    s.id = "pgh-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── DOM builders ── */
  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function lines(count, seed) {
    var wrap = el("div", "pgh-lines");
    for (var i = 0; i < count; i++) {
      var last = i === count - 1;
      var w = last ? 50 : 85 - ((i + seed) % 3) * 9;
      var b = document.createElement("i");
      b.style.width = w + "%";
      wrap.appendChild(b);
    }
    return wrap;
  }

  function ebookPage(variant) {
    var wrap = el("div", "pgh-ebook");
    wrap.appendChild(document.createElement("b"));
    var seed = variant * 3;
    for (var i = 0; i < 13; i++) {
      var b = document.createElement("i");
      b.style.width = (i === 12 ? 38 : 92 - ((i + seed) % 4) * 11) + "%";
      wrap.appendChild(b);
    }
    return wrap;
  }

  function buildBook() {
    var book = el("div", "pgh-book");
    book.appendChild(el("div", "pgh-book-base"));
    book.appendChild(el("div", "pgh-edge pgh-edge-l"));
    book.appendChild(el("div", "pgh-edge pgh-edge-r"));
    var hl = el("div", "pgh-half pgh-half-l");
    hl.appendChild(lines(5, 0));
    var hr = el("div", "pgh-half pgh-half-r");
    hr.appendChild(lines(5, 4));
    book.appendChild(hl);
    book.appendChild(hr);
    book.appendChild(el("div", "pgh-spine"));
    var flips = [];
    for (var i = 0; i < 3; i++) {
      var f = el("div", "pgh-flip");
      var front = el("div", "pgh-face pgh-face-f");
      front.appendChild(lines(4, 1));
      var back = el("div", "pgh-face pgh-face-b");
      back.appendChild(lines(4, 2));
      f.appendChild(front);
      f.appendChild(back);
      book.appendChild(f);
      flips.push(f);
    }
    return { root: book, flips: flips };
  }

  function buildCam() {
    var cam = el("div", "pgh-cam");
    var sheet = el("div", "pgh-sheet");
    sheet.appendChild(lines(8, 2));
    var scan = el("div", "pgh-scan");
    var flash = el("div", "pgh-flash");
    sheet.appendChild(scan);
    sheet.appendChild(flash);
    cam.appendChild(sheet);
    var lens = el("div", "pgh-lens");
    var ring = el("div", "pgh-lens-ring");
    ring.appendChild(el("div", "pgh-cross-h"));
    ring.appendChild(el("div", "pgh-cross-v"));
    ring.appendChild(el("div", "pgh-dot"));
    lens.appendChild(ring);
    cam.appendChild(lens);
    return { root: cam, scan: scan, flash: flash, lens: lens, ring: ring };
  }

  function buildPhone() {
    var phone = el("div", "pgh-phone");
    var body = el("div", "pgh-phone-body");
    var screen = el("div", "pgh-screen");
    var p1 = ebookPage(1);
    var p2 = ebookPage(2);
    screen.appendChild(p1);
    screen.appendChild(p2);
    body.appendChild(screen);
    phone.appendChild(body);
    var finger = el("div", "pgh-finger");
    phone.appendChild(finger);
    return { root: phone, p1: p1, p2: p2, finger: finger };
  }

  /* ── per-frame render ── */
  function render(parts, frame) {
    /* Book: visible 0-22, exits 22-28, hidden to 88, re-enters 88-95. */
    var bf = frame;
    var bookOpacity =
      bf < 28
        ? interp(bf, [22, 28], [1, 0], ease)
        : bf >= 88
        ? interp(bf, [88, 95], [0, 1], easeOut)
        : 0;
    var lift = bf >= 88 ? interp(bf, [88, 95], [16, 0], easeOut) : 0;
    parts.book.root.parentNode.style.opacity = bookOpacity;
    parts.book.root.parentNode.style.visibility = bookOpacity > 0.001 ? "visible" : "hidden";
    parts.book.root.style.transform = "translateY(" + lift + "px)";
    for (var i = 0; i < 3; i++) {
      var start = 2 + i * 6;
      var rot = interp(bf, [start, start + 7], [0, -170], ease);
      var f = parts.book.flips[i];
      if (rot === 0 || rot <= -170) {
        f.style.display = "none";
      } else {
        f.style.display = "block";
        f.style.transform = "rotateY(" + rot + "deg)";
      }
    }

    /* Camera: local 0-30 (global 28-58). */
    var cf = frame - 28;
    var camOpacity =
      interp(cf, [0, 6], [0, 1], easeOut) * interp(cf, [24, 30], [1, 0], ease);
    var camLayer = parts.cam.root.parentNode;
    camLayer.style.opacity = camOpacity;
    camLayer.style.visibility = camOpacity > 0.001 ? "visible" : "hidden";
    parts.cam.lens.style.left = interp(cf, [0, 14], [88, 50], easeOut) + "%";
    parts.cam.lens.style.top = interp(cf, [0, 14], [-12, 50], easeOut) + "%";
    parts.cam.lens.style.transform =
      "scale(" + interp(cf, [14, 17, 20], [1, 0.92, 1]) + ")";
    parts.cam.scan.style.top = interp(cf, [6, 18], [0, 100], ease) + "%";
    parts.cam.scan.style.opacity = interp(cf, [6, 7, 17, 18], [0, 1, 1, 0]);
    parts.cam.flash.style.opacity = interp(cf, [18, 20, 26], [0, 0.45, 0]);

    /* Phone: local 0-34 (global 56-90). */
    var pf = frame - 56;
    var phoneOpacity =
      interp(pf, [0, 8], [0, 1], easeOut) * interp(pf, [28, 34], [1, 0], ease);
    var phoneLayer = parts.phone.root.parentNode;
    phoneLayer.style.opacity = phoneOpacity;
    phoneLayer.style.visibility = phoneOpacity > 0.001 ? "visible" : "hidden";
    parts.phone.root.style.transform =
      "translateY(" + interp(pf, [0, 10], [40, 0], easeOut) + "px)";
    var pageX = interp(pf, [12, 22], [0, -100], ease);
    parts.phone.p1.style.transform = "translateX(" + pageX + "%)";
    parts.phone.p2.style.transform = "translateX(" + (100 + pageX) + "%)";
    parts.phone.finger.style.left = interp(pf, [10, 22], [115, -15], ease) + "%";
    parts.phone.finger.style.opacity = interp(pf, [10, 12, 20, 22], [0, 1, 1, 0]);
  }

  /* Scene boundaries, reused for the step captions. */
  var PHASES = [
    { from: 0, to: 28 },
    { from: 28, to: 56 },
    { from: 56, to: 96 }
  ];

  function mount(opts) {
    injectCss();
    var host = opts.el;
    if (!host) return null;
    host.classList.add("pgh");

    var scale = el("div", "pgh-scale");
    var book = buildBook();
    var cam = buildCam();
    var phone = buildPhone();
    [book, cam, phone].forEach(function (p) {
      var layer = el("div", "pgh-layer");
      layer.appendChild(p.root);
      scale.appendChild(layer);
    });
    host.appendChild(scale);
    var parts = { book: book, cam: cam, phone: phone };

    function fit() {
      var r = host.getBoundingClientRect();
      var s = Math.min(r.width, r.height) / BASE;
      scale.style.transform = "translate(-50%,-50%) scale(" + s + ")";
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(host);
    else window.addEventListener("resize", fit);

    var reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var lastPhase = -1;
    function emit(frame) {
      var phase = frame < 28 ? 0 : frame < 56 ? 1 : 2;
      var p = PHASES[phase];
      var progress = (frame - p.from) / (p.to - p.from);
      if (opts.onFrame) opts.onFrame(phase, progress, phase !== lastPhase);
      lastPhase = phase;
    }

    if (reduced) {
      /* Static end state: the EPUB on the phone. No loop, no step cycling. */
      render(parts, 66);
      if (opts.onReduced) opts.onReduced();
      else emit(66);
      return { reduced: true };
    }

    var raf = 0;
    var t0 = null;
    var running = false;

    function tick(now) {
      if (t0 === null) t0 = now;
      var frame = Math.floor(((now - t0) / 1000) * FPS) % TOTAL;
      render(parts, frame);
      emit(frame);
      raf = requestAnimationFrame(tick);
    }
    function start() {
      if (running) return;
      running = true;
      t0 = null;
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    /* Don't burn frames while the hero is scrolled out of view. */
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0.05 }).observe(host);
    } else {
      start();
    }
    render(parts, 0);
    return { start: start, stop: stop, reduced: false };
  }

  window.PergamentHero = { mount: mount, TOTAL: TOTAL, FPS: FPS, PHASES: PHASES };
})();
