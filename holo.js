/* ============================================================
   holo.js — holographic backdrop + 3D core
   Two layers, both cheap and both optional:
     1. aurora   — low-res canvas of drifting colour blobs (30fps)
     2. holo core— Three.js wireframe icosahedron rig with orbit
                   rings + particle halo, mouse parallax and a
                   scroll-linked camera drift.
   Everything degrades silently: no canvas, no THREE, or a
   prefers-reduced-motion user still gets a clean static page.
   ============================================================ */

(function () {
  'use strict';

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. aurora backdrop ---------- */
  (function aurora() {
    var c = document.getElementById('aurora');
    if (!c || !c.getContext) return;
    var x = c.getContext('2d');
    var SCALE = 3, W = 0, H = 0;
    var blobs = [
      { c:'94,231,255',  r:.42, sx:.13, sy:.19, s:.00013 },
      { c:'255,94,200',  r:.38, sx:.87, sy:.28, s:.00017 },
      { c:'255,184,77',  r:.34, sx:.30, sy:.86, s:.00011 },
      { c:'78,204,163',  r:.30, sx:.72, sy:.78, s:.00015 },
      { c:'140,110,255', r:.36, sx:.50, sy:.12, s:.00009 },
      { c:'94,231,255',  r:.26, sx:.22, sy:.55, s:.00019 },
      { c:'255,94,200',  r:.24, sx:.62, sy:.48, s:.00012 },
      { c:'255,184,77',  r:.22, sx:.42, sy:.36, s:.00016 }
    ];

    function size() {
      W = Math.ceil(window.innerWidth / SCALE);
      H = Math.ceil(window.innerHeight / SCALE);
      c.width = W; c.height = H;
      c.style.width = '100%'; c.style.height = '100%';
    }
    size();
    window.addEventListener('resize', size);

    function paint(t) {
      x.clearRect(0, 0, W, H);
      x.globalCompositeOperation = 'lighter';
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var cx = (b.sx + Math.sin(t * b.s + i * 1.7) * .11) * W;
        var cy = (b.sy + Math.cos(t * b.s * 1.24 + i) * .10) * H;
        var rad = b.r * Math.min(W, H);
        var g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, 'rgba(' + b.c + ',0.34)');
        g.addColorStop(.45, 'rgba(' + b.c + ',0.10)');
        g.addColorStop(1, 'rgba(' + b.c + ',0)');
        x.fillStyle = g;
        x.beginPath(); x.arc(cx, cy, rad, 0, 6.2832); x.fill();
      }
      x.globalCompositeOperation = 'source-over';
    }

    if (reduced) { paint(0); return; }

    var last = 0, FPS = 30, t0 = performance.now();
    (function frame(now) {
      requestAnimationFrame(frame);
      if (now - last < 1000 / FPS) return;
      last = now;
      paint(now - t0);
    })(t0);
  })();

  /* ---------- 2. Three.js holographic core ---------- */
  var coreBooted = false;
  function bootHoloCore() {
    if (coreBooted) return;
    var host = document.getElementById('holo-bg');
    if (!host) return;
    if (!window.THREE) return;
    coreBooted = true;
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04010d, 0.035);

    var cam = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, .1, 220);
    cam.position.set(0, 1.5, 12);

    var rend;
    try {
      rend = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) { return; }              // no WebGL — aurora alone is fine
    rend.setSize(window.innerWidth, window.innerHeight);
    rend.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    host.appendChild(rend.domElement);

    var rig = new THREE.Group();
    scene.add(rig);

    var core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.8, 1),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: .28 })
    );
    rig.add(core);

    var inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.6, 1),
      new THREE.MeshBasicMaterial({ color: 0xff00e5, wireframe: true, transparent: true, opacity: .22 })
    );
    rig.add(inner);

    var ringCols = [0x00f0ff, 0xff00e5, 0x7b2fff];
    for (var i = 0; i < 3; i++) {
      var r = new THREE.Mesh(
        new THREE.TorusGeometry(4.2 + i * .9, .018, 6, 128),
        new THREE.MeshBasicMaterial({ color: ringCols[i], transparent: true, opacity: .45 })
      );
      r.rotation.x = Math.PI / 2 + i * .42;
      rig.add(r);
    }

    var pts = [];
    for (var j = 0; j < 200; j++) {
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      var rad = 5 + Math.random() * 6;
      pts.push(
        rad * Math.sin(phi) * Math.cos(theta),
        rad * Math.sin(phi) * Math.sin(theta),
        rad * Math.cos(phi)
      );
    }
    var pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    var particles = new THREE.Points(pg, new THREE.PointsMaterial({
      color: 0x00f0ff, size: .08, transparent: true, opacity: .6,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    rig.add(particles);

    var tx = 0, ty = 0;
    window.addEventListener('mousemove', function (e) {
      tx = e.clientX / window.innerWidth - .5;
      ty = e.clientY / window.innerHeight - .5;
    });

    var running = true;
    // stop burning GPU when the hero is scrolled away
    window.addEventListener('scroll', function () {
      running = window.scrollY < window.innerHeight * 1.2;
    }, { passive: true });

    (function animate() {
      requestAnimationFrame(animate);
      if (reduced || !running) { rend.render(scene, cam); return; }
      rig.rotation.y += .002;
      core.rotation.x += .001;
      inner.rotation.y -= .002;
      inner.rotation.x -= .0015;
      particles.rotation.y += .0008;
      rig.position.x += (tx * 1.2 - rig.position.x) * .03;
      rig.position.y += (-ty * .8 - rig.position.y) * .03;
      cam.position.y = 1.5 - Math.min(window.scrollY / 900, 1) * 1.5;
      cam.lookAt(0, 0, 0);
      rend.render(scene, cam);
    })();

    window.addEventListener('resize', function () {
      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
      rend.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* ---------- 3. 3D extruded hero copy ---------- */
  function buildExtrude() {
    var el = document.querySelector('.hero .eyebrow-3d');
    if (!el || el.dataset.built === '1') return;
    el.dataset.built = '1';
    var txt = el.getAttribute('data-text') || el.textContent;
    el.textContent = '';
    var frag = document.createDocumentFragment();
    var pal = ['#5ee7ff', '#7b5cff', '#ff00e5', '#ffd700', '#4ade80'];
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      var span = document.createElement('i');
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      // per-letter arc: middle letters lift and push forward
      var mid = (txt.length - 1) / 2;
      var off = (i - mid) / (mid || 1);
      var lift = Math.cos(off * 1.35) * 10;
      var depth = Math.cos(off * 1.35) * 26;
      span.style.transform =
        'translateY(' + (-lift).toFixed(2) + 'px) translateZ(' + depth.toFixed(2) + 'px) ' +
        'rotateX(' + (off * -7).toFixed(2) + 'deg)';
      span.style.color = pal[i % pal.length];
      span.style.animationDelay = (-i * .12).toFixed(2) + 's';
      frag.appendChild(span);
    }
    el.appendChild(frag);
  }

  /* ---------- 4. pointer-tracked 3D tilt on photos ---------- */
  var tiltBound = false;
  function bindTilt() {
    if (tiltBound) return;
    tiltBound = true;

    function tiltTarget(el) {
      return el.closest && (el.closest('.meal-art') || el.closest('.pkg-hero'));
    }
    function tiltImg(host) {
      return host.querySelector('.dish-photo') || host.querySelector('.pkg-photo');
    }

    document.addEventListener('pointermove', function (e) {
      var t = tiltTarget(e.target);
      if (!t) return;
      var img = tiltImg(t);
      if (!img) return;
      var r = t.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - .5;
      var py = (e.clientY - r.top) / r.height - .5;
      img.style.animation = 'none';
      img.style.transform =
        'rotateY(' + (px * 13).toFixed(2) + 'deg) rotateX(' +
        (-py * 13).toFixed(2) + 'deg) translateZ(22px) scale(1.07)';
    }, { passive: true });

    document.addEventListener('pointerout', function (e) {
      var t = tiltTarget(e.target);
      if (!t) return;
      var img = tiltImg(t);
      if (img) { img.style.transform = ''; img.style.animation = ''; }
    }, { passive: true });
  }

  /* ---------- boot: run now + again whenever a page renders ---------- */
  function bootHolo() {
    bootHoloCore();
    buildExtrude();
    bindTilt();
  }

  window.holoBoot = bootHolo;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootHolo);
  } else {
    bootHolo();
  }

})();
