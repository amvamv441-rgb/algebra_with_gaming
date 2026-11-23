/* =========================================================
   حسابان ۱ — 3D labs (Three.js r158, classic script)
   ========================================================= */
(function () {
  'use strict';
  const AWG = window.AWG;
  const U = AWG.util;

  const instances = new Set();
  let _supported = null;

  function supported() {
    if (_supported !== null) return _supported;
    try {
      _supported = !!(window.THREE && window.WebGLRenderingContext);
    } catch (e) { _supported = false; }
    return _supported;
  }

  /* ---------- helpers ---------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmt(v) {
    if (!isFinite(v)) return '—';
    const r = Math.round(v * 100) / 100;
    return String(r).replace(/\.0+$/, '');
  }
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  let _glowTex = null;
  function glowTexture() {
    if (_glowTex) return _glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,.85)');
    g.addColorStop(0.45, 'rgba(255,255,255,.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    _glowTex = new THREE.CanvasTexture(c);
    _glowTex.colorSpace = THREE.SRGBColorSpace;
    _glowTex.userData.shared = true;
    return _glowTex;
  }

  function makeLabel(text, color, opts) {
    opts = opts || {};
    const fs = opts.fontSize || 44;
    const pad = opts.pad || 14;
    const font = `600 ${fs}px Vazirmatn, Estedad, sans-serif`;
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = font;
    const tw = Math.ceil(measure.measureText(text).width);
    const w = tw + pad * 2;
    const h = fs + pad * 2;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'ltr';
    if (opts.bg !== false) {
      ctx.fillStyle = opts.bg || 'rgba(8,15,12,.82)';
      roundRect(ctx, 1, 1, w - 2, h - 2, 9);
      ctx.fill();
      if (opts.border) {
        ctx.strokeStyle = opts.border;
        ctx.lineWidth = 2;
        roundRect(ctx, 1, 1, w - 2, h - 2, 9);
        ctx.stroke();
      }
    }
    ctx.fillStyle = color || '#f3f0e4';
    ctx.fillText(text, w / 2, h / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const sc = opts.scale || 0.0062;
    s.scale.set(w * sc, h * sc, 1);
    s.renderOrder = 20;
    s.userData.isLabel = true;
    return s;
  }

  function glowSphere(radius, color, intensity) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 20),
      new THREE.MeshBasicMaterial({ color })
    );
    g.add(core);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color, transparent: true, opacity: (intensity || 0.85),
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.scale.setScalar(radius * 7);
    g.add(halo);
    g.userData.core = core;
    g.userData.halo = halo;
    return g;
  }

  function disposeObject(obj) {
    if (!obj) return;
    const textures = new Set();
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          for (const k in m) {
            const v = m[k];
            if (v && v.isTexture && !textures.has(v) && !v.userData.shared) { textures.add(v); v.dispose(); }
          }
          m.dispose();
        });
      }
    });
  }

  function clearGroup(group) {
    if (!group) return;
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      disposeObject(child);
    }
  }

  function tubeFromPoints(points, radius, color, opacity) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, Math.max(24, points.length * 2), radius || 0.04, 8, false);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: opacity != null, opacity: opacity == null ? 1 : opacity
    });
    return new THREE.Mesh(geo, mat);
  }

  function dashedLine(a, b, color, dash, gap) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineDashedMaterial({
      color, dashSize: dash || 0.16, gapSize: gap || 0.12, transparent: true, opacity: 0.8
    });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    return line;
  }

  function makeArrow(from, to, color, headLength) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const arrow = new THREE.ArrowHelper(dir.normalize(), from, len, color, headLength || 0.35, headLength ? headLength * 0.55 : 0.2);
    arrow.line.material.transparent = true;
    arrow.line.material.opacity = 0.7;
    arrow.cone.material.transparent = true;
    arrow.cone.material.opacity = 0.9;
    return arrow;
  }

  function addGrid(group, size, divisions, color1, color2, opacity, y) {
    const grid = new THREE.GridHelper(size, divisions, color1, color2);
    grid.position.y = y == null ? 0 : y;
    grid.material.transparent = true;
    grid.material.opacity = opacity == null ? 0.28 : opacity;
    group.add(grid);
    return grid;
  }

  /* ---------- base ---------- */
  class SceneBase {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.opts = opts || {};
      this.destroyed = false;
      this.visible = true;
      this.raf = null;
      this.zoomLevel = 1;
      this.rot = { x: 0.26, y: 0 };
      this.target = { x: 0.26, y: 0 };
      this.dragging = false;
      this.lastX = 0; this.lastY = 0;
      this.pinchDist = 0;
      this.autoRotate = this.opts.autoRotate !== false;
      this.rotateSpeed = this.opts.rotateSpeed != null ? this.opts.rotateSpeed : 0.08;
      this.sway = false;
      this.target.y = this.rot.y = this.opts.yaw || 0;
      this.ac = new AbortController();
      this.signal = this.ac.signal;

      this.renderer = new THREE.WebGLRenderer({
        canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.setClearColor(0x000000, 0);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
      this.camPos = new THREE.Vector3(0, 4.2, 9.5);
      this.lookAt = new THREE.Vector3(0, 0.6, 0);
      this.pivot = new THREE.Group();
      this.scene.add(this.pivot);
      this.content = new THREE.Group();
      this.pivot.add(this.content);

      this.clock = new THREE.Clock();
      this.lights();
      this.bind();
      this.observe();
      this.resize();
      if (this.build) this.build(this.opts.params || {});
      this.loop();
    }

    lights() {
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
      const key = new THREE.DirectionalLight(0xffffff, 1.35);
      key.position.set(5, 9, 7);
      this.scene.add(key);
      const rim = new THREE.DirectionalLight(0x7fe7c4, 1.0);
      rim.position.set(-7, 4, -6);
      this.scene.add(rim);
      const fill = new THREE.PointLight(0xf2e85c, 0.7, 34);
      fill.position.set(0, 2, 5);
      this.scene.add(fill);
    }

    bind() {
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => {
        this.dragging = true;
        this.lastX = e.clientX; this.lastY = e.clientY;
        try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }, { signal: this.signal });
      c.addEventListener('pointermove', (e) => {
        if (!this.dragging) return;
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.lastX = e.clientX; this.lastY = e.clientY;
        this.target.y -= dx * 0.008;
        this.target.x = clamp(this.target.x + dy * 0.006, -0.15, 1.15);
      }, { signal: this.signal });
      const up = (e) => {
        this.dragging = false;
        try { c.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      };
      c.addEventListener('pointerup', up, { signal: this.signal });
      c.addEventListener('pointercancel', up, { signal: this.signal });
      c.addEventListener('pointerleave', up, { signal: this.signal });
      c.addEventListener('wheel', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        this.zoom(e.deltaY > 0 ? -0.12 : 0.12);
      }, { passive: false, signal: this.signal });
      // pinch zoom
      c.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          this.pinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      }, { passive: true, signal: this.signal });
      c.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && this.pinchDist) {
          const d = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          this.zoom((d - this.pinchDist) * 0.002);
          this.pinchDist = d;
        }
      }, { passive: true, signal: this.signal });
      c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, { signal: this.signal });
    }

    // zoomLevel is a magnification: larger = closer. zoom(+d) zooms in.
    zoom(delta) {
      this.zoomLevel = clamp(this.zoomLevel * (1 + delta), 0.5, 3.2);
    }

    observe() {
      if (typeof IntersectionObserver !== 'undefined') {
        this.io = new IntersectionObserver((entries) => {
          this.visible = entries[0] ? entries[0].isIntersecting : true;
        }, { threshold: 0.01 });
        this.io.observe(this.canvas);
      }
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(() => this.resize());
        this.ro.observe(this.canvas.parentElement || this.canvas);
      }
      window.addEventListener('resize', () => this.resize(), { signal: this.signal });
    }

    resize() {
      if (this.destroyed) return;
      const parent = this.canvas.parentElement;
      if (!parent) return;
      const w = Math.max(1, parent.clientWidth);
      const h = Math.max(1, parent.clientHeight);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    loop() {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(() => this.loop());
      if (!this.visible) { this.clock.getDelta(); return; }
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;
      this.update(dt, t);
      this.rot.x += (this.target.x - this.rot.x) * 0.08;
      this.rot.y += (this.target.y - this.rot.y) * 0.08;
      if (this.autoRotate && !this.dragging) this.target.y += dt * this.rotateSpeed;
      this.pivot.rotation.x = this.rot.x;
      // graph-like scenes keep a readable orientation and only sway gently
      this.pivot.rotation.y = this.rot.y + (this.sway && !this.dragging ? Math.sin(t * 0.6) * 0.09 : 0);
      const z = 1 / this.zoomLevel;
      this.camera.position.set(
        this.lookAt.x + (this.camPos.x - this.lookAt.x) * z,
        this.lookAt.y + (this.camPos.y - this.lookAt.y) * z,
        this.lookAt.z + (this.camPos.z - this.lookAt.z) * z
      );
      this.camera.lookAt(this.lookAt);
      this.renderer.render(this.scene, this.camera);
    }

    update() {}

    dispose() {
      this.destroyed = true;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.ac.abort();
      if (this.io) this.io.disconnect();
      if (this.ro) this.ro.disconnect();
      try { disposeObject(this.scene); } catch (e) { /* ignore */ }
      try { this.renderer.dispose(); } catch (e) { /* ignore */ }
      instances.delete(this);
    }
  }

  /* =========================================================
     HERO — paraboloid hologram
     ========================================================= */
  class HeroScene extends SceneBase {
    constructor(canvas, params) {
      super(canvas, { autoRotate: true, rotateSpeed: 0.07, params: params || {} });
      this.camPos.set(0, 4.4, 10.5);
      this.lookAt.set(0, 0.2, 0);
      this.target.x = 0.3;
    }

    build() {
      const R = 3.3, rings = 28, segs = 64;
      const pos = [], idx = [];
      for (let i = 0; i <= rings; i++) {
        const r = R * i / rings;
        for (let j = 0; j <= segs; j++) {
          const a = j / segs * Math.PI * 2;
          pos.push(Math.cos(a) * r, r * r * 0.20, Math.sin(a) * r);
        }
      }
      for (let i = 0; i < rings; i++) {
        for (let j = 0; j < segs; j++) {
          const a = i * (segs + 1) + j;
          const b = a + segs + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();

      const solid = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0x0c2f26, transparent: true, opacity: 0.34, side: THREE.DoubleSide,
        metalness: 0.55, roughness: 0.35
      }));
      this.content.add(solid);
      const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0x7fe7c4, wireframe: true, transparent: true, opacity: 0.22
      }));
      this.content.add(wire);

      [1.0, 1.9, 2.7].forEach((r, i) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.012, 6, 120),
          new THREE.MeshBasicMaterial({ color: i === 1 ? 0xf2e85c : 0x7fe7c4, transparent: true, opacity: 0.55 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = r * r * 0.20;
        this.content.add(ring);
      });

      // meridian curves
      for (let k = 0; k < 4; k++) {
        const pts = [];
        const a = k * Math.PI / 4;
        for (let i = 0; i <= 40; i++) {
          const r = R * i / 40;
          pts.push(new THREE.Vector3(Math.cos(a) * r, r * r * 0.20, Math.sin(a) * r));
        }
        this.content.add(tubeFromPoints(pts, 0.012, 0x7fe7c4, 0.4));
      }

      const count = 170, ppos = [];
      for (let i = 0; i < count; i++) {
        const r = 1.3 + Math.random() * 4.6;
        const a = Math.random() * Math.PI * 2;
        const y = (Math.random() - 0.25) * 3.2;
        ppos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(ppos, 3));
      this.particles = new THREE.Points(pg, new THREE.PointsMaterial({
        color: 0xf2e85c, size: 0.055, map: glowTexture(), transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      this.content.add(this.particles);

      this.sprites = [];
      [['x²', -3.7, 2.7, 0], ['√', 3.6, 3.1, 0], ['∑', -2.4, -1.7, 0], ['π', 2.9, -2.3, 0], ['Δ', -1.0, 3.6, 0]].forEach(([txt, x, y, z]) => {
        const s = makeLabel(txt, '#f3f0e4', { fontSize: 62, scale: 0.0062, bg: 'rgba(8,15,12,.55)', border: 'rgba(127,231,196,.25)' });
        s.position.set(x, y, z);
        s.userData.baseY = y;
        s.userData.phase = Math.random() * 6.28;
        this.content.add(s);
        this.sprites.push(s);
      });

      const grid = new THREE.GridHelper(11, 22, 0x2b6b58, 0x173a30);
      grid.position.y = -2.7;
      grid.material.transparent = true;
      grid.material.opacity = 0.32;
      this.content.add(grid);
    }

    update(dt, t) {
      if (this.particles) this.particles.rotation.y += dt * 0.06;
      if (this.sprites) {
        this.sprites.forEach((s, i) => {
          s.position.y = s.userData.baseY + Math.sin(t * 0.75 + s.userData.phase) * 0.18;
          s.material.rotation = Math.sin(t * 0.5 + i) * 0.04;
        });
      }
    }
  }

  /* =========================================================
     SEQUENCE LAB
     ========================================================= */
  class SequenceScene extends SceneBase {
    constructor(canvas, params) {
      super(canvas, { autoRotate: false, sway: true, yaw: 0, params: params || {} });
      this.sway = true;
      this.camPos.set(0, 5.8, 11.5);
      this.lookAt.set(0, 1.6, 0);
      this.target.x = 0.24;
    }

    build(p) {
      this.group = new THREE.Group();
      this.content.add(this.group);
      addGrid(this.content, 12, 24, 0x2b6b58, 0x173a30, 0.3, 0);
      this.bars = [];
      this.setParams(p);
    }

    setParams(p) {
      p = p || { a: 1, d: 1, n: 7, q: 2, mode: 'arith' };
      this.params = p;
      clearGroup(this.group);
      this.bars = [];
      const n = clamp(Math.round(p.n || 7), 3, 10);
      const geoMode = p.mode === 'geo';
      const values = [];
      for (let i = 0; i < n; i++) {
        values.push(geoMode ? (p.a || 1) * Math.pow(p.q || 2, i) : (p.a || 1) + i * (p.d || 1));
      }
      const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
      const scale = 3.5 / maxAbs;
      const spacing = n > 1 ? 9 / (n - 1) : 0;
      const color = geoMode ? 0xff8a70 : 0x7fe7c4;
      const tops = [];
      const barW = Math.min(0.62, spacing * 0.62);

      values.forEach((v, i) => {
        const h = v * scale;
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(barW, 1, barW),
          new THREE.MeshStandardMaterial({
            color, emissive: color, emissiveIntensity: 0.35, metalness: 0.25, roughness: 0.45
          })
        );
        // RTL reading order: the first term sits on the right
        const x = ((n - 1) / 2 - i) * spacing;
        bar.position.set(x, h / 2, 0);
        bar.scale.y = Math.max(0.04, Math.abs(h));
        if (h < 0) bar.position.y = h / 2;
        this.group.add(bar);
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xf2e85c })
        );
        cap.position.set(x, h, 0);
        this.group.add(cap);
        tops.push(new THREE.Vector3(x, h, 0));
        this.bars.push({ bar, value: v, x, y: h });
        // value label for every term (always above the bar top so it never sinks under the grid)
        const vl = makeLabel(`${fmt(v)}`, '#cfe3d8', { fontSize: 30, scale: 0.0052, bg: 'rgba(8,15,12,.72)' });
        vl.position.set(x, Math.max(0, h) + (h >= 0 ? 0.42 : 0.42), 0);
        this.group.add(vl);
      });

      if (tops.length > 1) {
        this.group.add(tubeFromPoints(tops, 0.028, 0xf2e85c, 0.75));
      }

      // axis
      this.group.add(makeArrow(new THREE.Vector3(-5.4, 0, 0), new THREE.Vector3(5.4, 0, 0), 0x8fa398, 0.18));
      this.group.add(makeArrow(new THREE.Vector3(0, 0, -3.5), new THREE.Vector3(0, 0, 3.5), 0x8fa398, 0.18));

      // term labels: a₁ (right end) and aₙ (left end), floating above the value labels
      const first = this.bars[0];
      const last = this.bars[this.bars.length - 1];
      if (first) {
        const l = makeLabel(`a₁ = ${fmt(first.value)}`, '#f3f0e4', { fontSize: 36, scale: 0.006, bg: 'rgba(8,15,12,.78)' });
        l.position.set(first.x, Math.max(0, first.y) + 1.05, 0);
        this.group.add(l);
      }
      if (last && last !== first) {
        const l = makeLabel(`aₙ = ${fmt(last.value)}`, '#f2e85c', { fontSize: 36, scale: 0.006, bg: 'rgba(8,15,12,.78)' });
        l.position.set(last.x, Math.max(0, last.y) + 1.05, 0);
        this.group.add(l);
      }
    }

    update(dt, t) {
      this.bars.forEach((b, i) => {
        if (b.bar && b.bar.material) {
          b.bar.material.emissiveIntensity = 0.3 + Math.sin(t * 2 + i * 0.5) * 0.08;
        }
      });
    }
  }

  /* =========================================================
     PARABOLA LAB
     ========================================================= */
  class ParabolaScene extends SceneBase {
    constructor(canvas, params) {
      super(canvas, { autoRotate: false, params: params || {} });
      this.sway = true;
      this.camPos.set(0, 3.2, 12.5);
      this.lookAt.set(0, 0.6, 0);
      this.target.x = 0.12;
      this.target.y = this.rot.y = -0.28;
    }

    build(p) {
      addGrid(this.content, 13, 26, 0x2b6b58, 0x173a30, 0.26, 0);
      this.curveGroup = new THREE.Group();
      this.content.add(this.curveGroup);
      this.axes = new THREE.Group();
      this.content.add(this.axes);
      this.axes.add(makeArrow(new THREE.Vector3(-6.2, 0, 0), new THREE.Vector3(6.2, 0, 0), 0x8fa398, 0.2));
      this.axes.add(makeArrow(new THREE.Vector3(0, -6.2, 0), new THREE.Vector3(0, 6.2, 0), 0x8fa398, 0.2));
      const lx = makeLabel('x', '#8fa398', { fontSize: 34, scale: 0.006, bg: false });
      lx.position.set(6.45, 0.3, 0); this.axes.add(lx);
      const ly = makeLabel('y', '#8fa398', { fontSize: 34, scale: 0.006, bg: false });
      ly.position.set(0.35, 6.35, 0); this.axes.add(ly);
      this.setParams(p);
    }

    setParams(p) {
      p = p || { a: 1, b: -4, c: 3 };
      this.params = p;
      clearGroup(this.curveGroup);
      const a = p.a || 0.001, b = p.b || 0, c = p.c || 0;
      const pts = [], raw = [];
      for (let i = 0; i <= 180; i++) {
        const x = -5 + 10 * i / 180;
        const y = a * x * x + b * x + c;
        raw.push(y);
        pts.push(new THREE.Vector3(x, 0, 0));
      }
      const maxY = Math.max(1, ...raw.map(Math.abs));
      const ys = Math.min(0.55, 6.2 / maxY);
      pts.forEach((pt, i) => { pt.y = raw[i] * ys; });
      this.ys = ys;

      this.curveGroup.add(tubeFromPoints(pts, 0.05, 0xf2e85c));

      const d = b * b - 4 * a * c;
      this.roots = [];
      if (d >= 0) {
        const r1 = (-b + Math.sqrt(d)) / (2 * a);
        const r2 = (-b - Math.sqrt(d)) / (2 * a);
        [r1, r2].forEach((r, i) => {
          if (Math.abs(r) <= 6) {
            const s = glowSphere(0.1, 0xff8a70);
            s.position.set(r, 0, 0);
            this.curveGroup.add(s);
            this.roots.push(s);
            const l = makeLabel(i === 0 ? 'x₁' : 'x₂', '#ff8a70', { fontSize: 38, scale: 0.006, bg: 'rgba(8,15,12,.7)' });
            l.position.set(r, 0.55, 0);
            this.curveGroup.add(l);
          }
        });
      }

      const xv = -b / (2 * a);
      const yv = (a * xv * xv + b * xv + c) * ys;
      this.vertex = glowSphere(0.085, 0x7fe7c4);
      this.vertex.position.set(xv, yv, 0);
      this.curveGroup.add(this.vertex);
      const vl = makeLabel('V', '#7fe7c4', { fontSize: 38, scale: 0.006, bg: 'rgba(8,15,12,.7)' });
      vl.position.set(xv, yv + (yv >= 0 ? 0.5 : -0.5), 0);
      this.curveGroup.add(vl);
      this.curveGroup.add(dashedLine(
        new THREE.Vector3(xv, yv, 0), new THREE.Vector3(xv, 0, 0), 0x8fa398, 0.14, 0.1
      ));
    }

    update(dt, t) {
      if (this.roots) this.roots.forEach((s, i) => {
        const k = 1 + Math.sin(t * 2.4 + i) * 0.15;
        s.scale.setScalar(k);
      });
      if (this.vertex) this.vertex.scale.setScalar(1 + Math.sin(t * 2) * 0.1);
    }
  }

  /* =========================================================
     RADICAL LAB — extraneous root
     ========================================================= */
  class RadicalScene extends SceneBase {
    constructor(canvas, params) {
      super(canvas, { autoRotate: false, params: params || {} });
      this.sway = true;
      this.camPos.set(0, 3.0, 12.5);
      this.lookAt.set(0, 0.3, 0);
      this.target.x = 0.1;
      this.target.y = this.rot.y = 0.22;
    }

    build() {
      addGrid(this.content, 14, 28, 0x2b6b58, 0x173a30, 0.24, 0);
      const shift = -4;
      const c1 = [], c2 = [];
      for (let i = 0; i <= 160; i++) {
        const x = -2 + 10 * i / 160;            // domain of √(x+2) starts at x = −2
        c1.push(new THREE.Vector3(x + shift, Math.sqrt(x + 2), 0));
      }
      for (let i = 0; i <= 80; i++) {
        const x = -0.5 + 8.5 * i / 80;          // y = x − 4, kept inside the axis box
        c2.push(new THREE.Vector3(x + shift, x - 4, 0));
      }
      this.curve1 = tubeFromPoints(c1, 0.045, 0x7fe7c4);
      this.curve2 = tubeFromPoints(c2, 0.045, 0xff8a70);
      this.content.add(this.curve1, this.curve2);

      // axes
      this.content.add(makeArrow(new THREE.Vector3(-5.5, 0, 0), new THREE.Vector3(5.5, 0, 0), 0x8fa398, 0.18));
      this.content.add(makeArrow(new THREE.Vector3(0, -4.5, 0), new THREE.Vector3(0, 4.5, 0), 0x8fa398, 0.18));

      // intersection
      this.hit = glowSphere(0.12, 0x7fe7c4);
      this.hit.position.set(7 + shift, 3, 0);
      this.content.add(this.hit);
      const hl = makeLabel('(7, 3)', '#7fe7c4', { fontSize: 36, scale: 0.006, bg: 'rgba(8,15,12,.8)' });
      hl.position.set(7 + shift, 3.6, 0);
      this.content.add(hl);

      // extraneous point
      this.ghost = glowSphere(0.1, 0xff5d5d, 0.7);
      this.ghost.position.set(2 + shift, 2, 0);
      this.content.add(this.ghost);
      const gl = makeLabel('(2, 2) ✗', '#ff8a70', { fontSize: 34, scale: 0.006, bg: 'rgba(8,15,12,.8)' });
      gl.position.set(2 + shift, 2.6, 0);
      this.content.add(gl);
      // same x = 2: the curve gives +2, the line gives −2 → no intersection here
      const ghostLine = dashedLine(
        new THREE.Vector3(2 + shift, 2, 0), new THREE.Vector3(2 + shift, -2, 0), 0xff5d5d, 0.13, 0.1
      );
      this.content.add(ghostLine);
      this.ghostOnLine = glowSphere(0.07, 0xff5d5d, 0.7);
      this.ghostOnLine.position.set(2 + shift, -2, 0);
      this.content.add(this.ghostOnLine);
      const gl2 = makeLabel('x = 2', '#ff8a70', { fontSize: 30, scale: 0.005, bg: 'rgba(8,15,12,.8)' });
      gl2.position.set(2 + shift, -2.55, 0);
      this.content.add(gl2);

      const l1 = makeLabel('y = √(x+2)', '#7fe7c4', { fontSize: 34, scale: 0.0058, bg: 'rgba(8,15,12,.75)' });
      l1.position.set(-2.2, 3.5, 0);
      this.content.add(l1);
      const l2 = makeLabel('y = x − 4', '#ff8a70', { fontSize: 34, scale: 0.0058, bg: 'rgba(8,15,12,.75)' });
      l2.position.set(2.6, -3.4, 0);
      this.content.add(l2);

      // scanning line + points
      this.scan = new THREE.Group();
      this.scanLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 8.6, 0.02),
        new THREE.MeshBasicMaterial({ color: 0xf2e85c, transparent: true, opacity: 0.55 })
      );
      this.scan.add(this.scanLine);
      this.p1 = glowSphere(0.07, 0x7fe7c4, 0.8);
      this.p2 = glowSphere(0.07, 0xff8a70, 0.8);
      this.scan.add(this.p1, this.p2);
      this.content.add(this.scan);
      this.scanT = 0;
    }

    update(dt, t) {
      if (this.paused) return;
      this.scanT += dt * (this.speed || 0.22);
      const u = (Math.sin(this.scanT) + 1) / 2;
      const x = u * 8;
      const y1 = Math.sqrt(x + 2);
      const y2 = x - 4;
      this.scan.position.x = x - 4;
      this.p1.position.y = y1;
      this.p2.position.y = y2;
      const near = Math.abs(y1 - y2) < 0.12;
      this.hit.scale.setScalar(near ? 1.35 : 1);
      this.p1.scale.setScalar(near ? 1.5 : 1);
      this.p2.scale.setScalar(near ? 1.5 : 1);
      this.ghost.scale.setScalar(1 + Math.sin(t * 1.8) * 0.12);
    }
  }

  /* =========================================================
     ABSOLUTE LAB — folding the graph
     ========================================================= */
  class AbsoluteScene extends SceneBase {
    constructor(canvas, params) {
      super(canvas, { autoRotate: false, params: params || {} });
      this.sway = true;
      this.camPos.set(0, 3.2, 12);
      this.lookAt.set(0, 0.5, 0);
      this.target.x = 0.12;
      this.target.y = this.rot.y = -0.22;
      this.fold = 0;
    }

    build(p) {
      addGrid(this.content, 13, 26, 0x2b6b58, 0x173a30, 0.26, 0);
      this.content.add(makeArrow(new THREE.Vector3(-5.5, 0, 0), new THREE.Vector3(5.5, 0, 0), 0x8fa398, 0.18));
      this.content.add(makeArrow(new THREE.Vector3(0, -5.5, 0), new THREE.Vector3(0, 5.5, 0), 0x8fa398, 0.18));
      this.curveGroup = new THREE.Group();
      this.content.add(this.curveGroup);
      this.base = new THREE.Group();
      this.content.add(this.base);
      this.setParams(p);
    }

    // One tube for y = f(x) and one for y = |f(x)| share the same vertex layout,
    // so the fold is a cheap per-frame position lerp (no geometry rebuild).
    applyFold(t) {
      if (!this.foldMesh || !this.basePos || !this.foldPos) return;
      const attr = this.foldMesh.geometry.attributes.position;
      const arr = attr.array;
      const bp = this.basePos, fp = this.foldPos;
      for (let i = 0; i < arr.length; i++) arr[i] = bp[i] + (fp[i] - bp[i]) * t;
      attr.needsUpdate = true;
      this.foldMesh.geometry.computeBoundingSphere();
    }

    setParams(p) {
      p = p || { a: 1, b: 0, c: -4 };
      this.params = p;
      const a = p.a || 0.001, b = p.b || 0, c = p.c || 0;
      clearGroup(this.curveGroup);
      clearGroup(this.base);
      const pts = [], raw = [];
      for (let i = 0; i <= 160; i++) {
        const x = -4.5 + 9 * i / 160;
        const y = a * x * x + b * x + c;
        raw.push(y);
        pts.push(new THREE.Vector3(x, 0, 0));
      }
      const maxY = Math.max(1, ...raw.map(Math.abs));
      const ys = Math.min(0.5, 5.5 / maxY);
      this.ys = ys;
      this.raw = raw;
      this.xs = pts.map((p2) => p2.x);
      const basePts = pts.map((pt, i) => new THREE.Vector3(pt.x, raw[i] * ys, 0));
      this.base.add(tubeFromPoints(basePts, 0.035, 0x8fa398, 0.55));

      this.buildFoldMeshes();
      this.applyFold(this.fold || 0);
    }

    buildFoldMeshes() {
      if (this.foldMesh) { this.curveGroup.remove(this.foldMesh); disposeObject(this.foldMesh); this.foldMesh = null; }
      if (!this.raw) return;
      const n = this.raw.length;
      const basePts = [], foldPts = [];
      for (let i = 0; i < n; i++) {
        const y = this.raw[i] * this.ys;
        basePts.push(new THREE.Vector3(this.xs[i], y, 0));
        foldPts.push(new THREE.Vector3(this.xs[i], Math.abs(y), 0));
      }
      const segs = Math.max(24, n * 2);
      const baseGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(basePts), segs, 0.055, 8, false);
      const foldGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(foldPts), segs, 0.055, 8, false);
      this.basePos = baseGeo.attributes.position.array.slice();
      this.foldPos = foldGeo.attributes.position.array.slice();
      foldGeo.dispose();
      const mat = new THREE.MeshBasicMaterial({ color: 0x7fe7c4 });
      this.foldMesh = new THREE.Mesh(baseGeo, mat);
      this.curveGroup.add(this.foldMesh);
    }

    setFold(t) {
      this.fold = clamp(t, 0, 1);
      this.applyFold(this.fold);
      if (this.onFold) this.onFold(this.fold);
    }

    update(dt, time) {
      // auto breathe only when no explicit fold control
      if (!this.holdFold && !this.paused) {
        const t = (Math.sin(time * 0.55 - Math.PI / 2) + 1) / 2;
        this.setFold(t);
      }
    }
  }

  /* =========================================================
     GEOMETRY LAB
     ========================================================= */
  class GeometryScene extends SceneBase {
    constructor(canvas, params) {
      super(canvas, { autoRotate: false, params: params || {} });
      this.sway = true;
      this.camPos.set(5.5, 5.5, 11.5);
      this.lookAt.set(0, 0.5, 0);
      this.target.x = 0.2;
      this.target.y = this.rot.y = -0.3;
    }

    build(p) {
      const grid = new THREE.GridHelper(14, 28, 0x2b6b58, 0x173a30);
      grid.rotation.x = Math.PI / 2;
      grid.material.transparent = true;
      grid.material.opacity = 0.24;
      this.content.add(grid);
      this.content.add(makeArrow(new THREE.Vector3(-6.5, 0, 0), new THREE.Vector3(6.5, 0, 0), 0x8fa398, 0.2));
      this.content.add(makeArrow(new THREE.Vector3(0, -6.5, 0), new THREE.Vector3(0, 6.5, 0), 0x8fa398, 0.2));
      this.content.add(makeArrow(new THREE.Vector3(0, 0, -3.2), new THREE.Vector3(0, 0, 3.2), 0x8fa398, 0.18));
      const lx = makeLabel('x', '#8fa398', { fontSize: 32, scale: 0.006, bg: false }); lx.position.set(6.7, 0.25, 0); this.content.add(lx);
      const ly = makeLabel('y', '#8fa398', { fontSize: 32, scale: 0.006, bg: false }); ly.position.set(0.3, 6.7, 0); this.content.add(ly);
      const lz = makeLabel('z', '#8fa398', { fontSize: 32, scale: 0.006, bg: false }); lz.position.set(0, 0.25, 3.4); this.content.add(lz);

      this.group = new THREE.Group();
      this.content.add(this.group);
      this.setParams(p);
    }

    setParams(p) {
      p = p || { x1: -2, y1: 1, x2: 3, y2: 4 };
      this.params = p;
      clearGroup(this.group);
      const A = new THREE.Vector3(p.x1, p.y1, 0);
      const B = new THREE.Vector3(p.x2, p.y2, 0);
      const M = new THREE.Vector3((p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2, 0);

      // legs
      this.group.add(dashedLine(A, new THREE.Vector3(p.x2, p.y1, 0), 0x8fa398, 0.14, 0.1));
      this.group.add(dashedLine(new THREE.Vector3(p.x2, p.y1, 0), B, 0x8fa398, 0.14, 0.1));

      // segment
      this.group.add(tubeFromPoints([A, B], 0.05, 0xf2e85c));

      // points
      this.a = glowSphere(0.14, 0x7fe7c4); this.a.position.copy(A); this.group.add(this.a);
      this.b = glowSphere(0.14, 0xff8a70); this.b.position.copy(B); this.group.add(this.b);
      this.m = glowSphere(0.1, 0xf2e85c); this.m.position.copy(M); this.group.add(this.m);

      // labels
      const la = makeLabel(`A(${fmt(p.x1)}, ${fmt(p.y1)})`, '#7fe7c4', { fontSize: 34, scale: 0.0056, bg: 'rgba(8,15,12,.78)' });
      la.position.set(A.x, A.y + 0.55, 0); this.group.add(la);
      const lb = makeLabel(`B(${fmt(p.x2)}, ${fmt(p.y2)})`, '#ff8a70', { fontSize: 34, scale: 0.0056, bg: 'rgba(8,15,12,.78)' });
      lb.position.set(B.x, B.y + 0.55, 0); this.group.add(lb);
      const lm = makeLabel('M', '#f2e85c', { fontSize: 34, scale: 0.0056, bg: 'rgba(8,15,12,.78)' });
      lm.position.set(M.x, M.y - 0.55, 0); this.group.add(lm);

      const dist = Math.sqrt((p.x2 - p.x1) ** 2 + (p.y2 - p.y1) ** 2);
      const ld = makeLabel(`AB = ${fmt(dist)}`, '#f3f0e4', { fontSize: 32, scale: 0.0054, bg: 'rgba(8,15,12,.8)' });
      ld.position.set((A.x + B.x) / 2, (A.y + B.y) / 2 + 0.5, 0);
      this.group.add(ld);

      // pulse along segment
      this.pulse = glowSphere(0.06, 0xffffff, 0.6);
      this.group.add(this.pulse);
      this.A = A; this.B = B;
    }

    update(dt, t) {
      if (this.pulse) {
        const u = (Math.sin(t * 1.2 - Math.PI / 2) + 1) / 2;
        this.pulse.position.lerpVectors(this.A, this.B, u);
      }
      if (this.a) this.a.scale.setScalar(1 + Math.sin(t * 2.2) * 0.08);
      if (this.b) this.b.scale.setScalar(1 + Math.sin(t * 2.2 + 1) * 0.08);
    }
  }

  /* =========================================================
     Registry
     ========================================================= */
  const SCENES = {
    hero: HeroScene,
    sequence: SequenceScene,
    parabola: ParabolaScene,
    radical: RadicalScene,
    absolute: AbsoluteScene,
    geometry: GeometryScene
  };

  function mount(canvas, name, params) {
    if (!canvas || !name) return null;
    if (!supported()) return null;
    const Ctor = SCENES[name];
    if (!Ctor) return null;
    try {
      const inst = new Ctor(canvas, params || {});
      instances.add(inst);
      return inst;
    } catch (e) {
      console.warn('3D scene failed:', name, e);
      return null;
    }
  }

  function disposeAll() {
    Array.from(instances).forEach((s) => {
      try { s.dispose(); } catch (e) { /* ignore */ }
    });
    instances.clear();
  }

  AWG.Scenes = {
    supported,
    mount,
    disposeAll,
    has: (name) => !!SCENES[name],
    count: () => instances.size
  };
})();
