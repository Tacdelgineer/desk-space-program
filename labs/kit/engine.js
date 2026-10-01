/* =========================================================
   ENGINE: renderer, scene, lights, post chain, floor, camera shots, keys,
   label leader lines, particles, the frame loop.
   Knows nothing about any one machine or mission. Needs three.js r147 (browser globals).
   ========================================================= */
(function (DSP) {
  'use strict';
  const need = ['EffectComposer', 'RenderPass', 'ShaderPass', 'UnrealBloomPass', 'OrbitControls', 'RoomEnvironment'];
  if (!window.THREE || need.some(n => !window.THREE[n])) { document.getElementById('fallback').hidden = false; return; }
  const T = window.THREE;
  if (T.ColorManagement) T.ColorManagement.legacyMode = false;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Late-bound buttons the keys call. The mission sets launch, nextMachine and toggleCase, ui.js sets toggleUI and toggleBar.
  const actions = { launch() {}, nextMachine() {}, toggleUI() {}, toggleCase() {}, toggleBar() {} };

  /* =========================================================
     RENDERER, SCENE, CAMERA, POST
     ========================================================= */
  const canvas = document.getElementById('scene');
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const PR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  // NVIDIA's Linux Vulkan driver fails to build the shadow-pass pipelines that ANGLE asks for, and the page
  // draws black. Chrome only takes that path when forced onto Vulkan (its Linux default is OpenGL, which works),
  // so drop the shadows in that one case rather than show nothing.
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  if (/NVIDIA/.test(gpuName) && /Vulkan/.test(gpuName)) renderer.shadowMap.enabled = false;

  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;

  const camera = new T.PerspectiveCamera(30, 1, 0.5, 900);
  camera.position.set(27, 30, 36);
  const controls = new T.OrbitControls(camera, canvas);
  controls.target.set(0, 3.0, -1.0);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.minDistance = 9; controls.maxDistance = 120; controls.maxPolarAngle = 1.42;
  controls.autoRotateSpeed = 0.5;

  function canvasTex(w, h, draw, srgb) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    if (srgb) t.encoding = T.sRGBEncoding;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  const std = (color, rough, metal, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra || {}));
  // Everything a machine builds goes into its own group (setParent), so the whole machine can sink and rise.
  let parent = scene;
  const setParent = g => { parent = g || scene; };
  const add = o => { parent.add(o); return o; };
  function mesh(geo, mat, x, y, z, opts) {
    const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = !(opts && opts.noCast); m.receiveShadow = true; add(m); return m;
  }

  scene.background = new T.Color(0x050508);

  // Lights: warm key with soft shadows, cool rim, low fill
  scene.add(new T.HemisphereLight(0x9aa3ff, 0x07070b, 0.3));
  const key = new T.DirectionalLight(0xffd6a0, 3.2);
  // aimed at the middle of the stand and the console in front of it; same direction as before, a wider shadow box
  key.position.set(-12, 30, 26); key.target.position.set(4, 0, 6); scene.add(key.target); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 110 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  scene.add(key);
  const rimL = new T.DirectionalLight(0x6aa8ff, 0.9); rimL.position.set(18, 10, -22); scene.add(rimL);
  const glow = new T.PointLight(0x27f2d2, 0, 18, 2); glow.position.set(0, 3, 0); scene.add(glow);
  const heat = new T.PointLight(0xff8a3a, 0, 12, 2); heat.position.set(0.6, 2.4, 0); scene.add(heat);

  // Post: MSAA render -> bloom -> tilt-shift (H,V) -> grade (gamma, vignette, grain)
  const rt = new T.WebGLRenderTarget(1, 1, { samples: renderer.capabilities.isWebGL2 ? 4 : 0, type: T.HalfFloatType });
  const composer = new T.EffectComposer(renderer, rt);
  // The scene pass. Normally one camera. In a stacked frame (a 9:16 recording, see setFrame) the main camera draws
  // everything but the stacked object (the console), then a second camera draws that object alone, with the floor and
  // the lights, into a band along the bottom of the frame.
  const camB = new T.PerspectiveCamera(30, 1, 0.5, 900);
  const stack = { on: false, bandH: 0, object: null };
  class ScenePass extends T.Pass {
    constructor() { super(); this.needsSwap = false; }
    render(r, writeBuffer, readBuffer) {
      const auto = r.autoClear; r.autoClear = false;
      r.setRenderTarget(readBuffer); r.clear();
      if (!stack.on) { r.render(scene, camera); r.autoClear = auto; return; }
      const obj = stack.object, was = obj.visible;
      obj.visible = false; r.render(scene, camera); obj.visible = was;
      const hid = [];
      scene.children.forEach(c => { if (c !== obj && c !== floor && !c.isLight && c.visible) { c.visible = false; hid.push(c); } });
      readBuffer.scissor.set(0, 0, readBuffer.width, Math.round(stack.bandH * PR)); readBuffer.scissorTest = true;
      r.setRenderTarget(readBuffer); r.clear(); r.render(scene, camB);
      readBuffer.scissorTest = false; r.setRenderTarget(readBuffer);
      hid.forEach(c => { c.visible = true; });
      r.autoClear = auto;
    }
  }
  composer.addPass(new ScenePass());
  const bloom = new T.UnrealBloomPass(new T.Vector2(1, 1), 0.55, 0.45, 0.82);
  composer.addPass(bloom);
  const tiltShader = {
    uniforms: { tDiffuse: { value: null }, dir: { value: new T.Vector2() }, focus: { value: 0.5 }, band: { value: 0.16 }, amount: { value: 3.0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform vec2 dir; uniform float focus; uniform float band; uniform float amount; varying vec2 vUv;',
      'void main(){',
      '  float d = abs(vUv.y - focus);',
      '  float k = smoothstep(band, band + 0.38, d) * amount;',
      '  vec4 s = texture2D(tDiffuse, vUv) * 0.2270270270;',
      '  vec2 o1 = dir * 1.3846153846 * k; vec2 o2 = dir * 3.2307692308 * k;',
      '  s += texture2D(tDiffuse, vUv + o1) * 0.3162162162; s += texture2D(tDiffuse, vUv - o1) * 0.3162162162;',
      '  s += texture2D(tDiffuse, vUv + o2) * 0.0702702703; s += texture2D(tDiffuse, vUv - o2) * 0.0702702703;',
      '  gl_FragColor = s;',
      '}'].join('\n')
  };
  const tiltH = new T.ShaderPass(tiltShader), tiltV = new T.ShaderPass(tiltShader);
  composer.addPass(tiltH); composer.addPass(tiltV);
  const grade = new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new T.Vector2(1, 1) }, seam: { value: -1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; uniform float seam; varying vec2 vUv;',
      'vec3 toSRGB(vec3 c){ c = max(c, vec3(0.0)); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }',
      'void main(){',
      '  vec3 c = toSRGB(texture2D(tDiffuse, vUv).rgb);',
      '  vec2 q = (vUv - 0.5) * vec2(res.x / res.y, 1.0);',
      '  c *= mix(0.62, 1.0, smoothstep(1.05, 0.25, length(q)));',
      '  if (seam > 0.0) c *= mix(0.25, 1.0, smoothstep(0.0, 0.035, abs(vUv.y - seam)));',   // a stacked frame: both views fade into the seam
      '  float n = fract(sin(dot(vUv * res + fract(time) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);',
      '  c += (n - 0.5) * 0.028;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'].join('\n')
  });
  composer.addPass(grade);

  /* =========================================================
     FLOOR: the studio light pool
     ========================================================= */
  const floorTex = canvasTex(2048, 2048, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#1d1f36'); g.addColorStop(0.1, '#121326'); g.addColorStop(0.3, '#09090f'); g.addColorStop(1, '#050508');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const step = w / 52;
    for (let i = 0; i <= w; i += step) {
      x.strokeStyle = 'rgba(120,130,220,.045)'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke();
    }
    const v = x.createRadialGradient(w / 2, h / 2, w * 0.08, w / 2, h / 2, w / 2);
    v.addColorStop(0, 'rgba(5,5,8,0)'); v.addColorStop(1, 'rgba(5,5,8,1)');
    x.fillStyle = v; x.fillRect(0, 0, w, h);
  }, true);
  const floorMat = std(0x06060b, 0.8, 0.05, { envMapIntensity: 0.02 });
  floorMat.userData.envTuned = true; // parts.tuneEnv() leaves the floor's environment light alone
  floorMat.map = floorTex; floorMat.color.setHex(0xffffff); floorMat.roughness = 0.75;
  const floor = new T.Mesh(new T.PlaneGeometry(420, 420), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -3; floor.receiveShadow = true; scene.add(floor);

  /* =========================================================
     PARTICLES: loading arcs, answer packets, overflow spill
     ========================================================= */
  function pool(n, color, size) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ size, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false; add(pts);
    const items = []; for (let i = 0; i < n; i++) items.push({ life: 0 });
    const base = new T.Color(color); let cur = 0;
    return {
      spawn(o) { const it = items[cur]; cur = (cur + 1) % n; Object.assign(it, o, { age: 0 }); it.life = o.life; },
      update(dt) {
        items.forEach((it, i) => {
          if (it.life <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; return; }
          it.age += dt; const t = Math.min(1, it.age / it.life);
          if (it.path) { const p = it.path(t); pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; }
          else { it.v.y -= 9 * dt; it.p.addScaledVector(it.v, dt); pos[i * 3] = it.p.x; pos[i * 3 + 1] = it.p.y; pos[i * 3 + 2] = it.p.z; }
          const k = it.fade ? (1 - t) : Math.sin(t * Math.PI) * 0.6 + 0.4;
          col[i * 3] = base.r * k * 1.4; col[i * 3 + 1] = base.g * k * 1.4; col[i * 3 + 2] = base.b * k * 1.4;
          if (t >= 1) it.life = 0;
        });
        g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
      },
      clear() { items.forEach(it => { it.life = 0; }); }
    };
  }
  const qb = (a, b, c, t) => new T.Vector3().copy(a).multiplyScalar((1 - t) * (1 - t)).addScaledVector(b, 2 * (1 - t) * t).addScaledVector(c, t * t);

  /* =========================================================
     LABELS ON SIDE RAILS
     list: [{ id, at: Vector3, title }]. The anchors are split at the median screen x: the left half goes
     to a rail down the left edge of the free area, the right half to one down the right edge. Each rail
     is sorted by anchor height, cards are packed without overlap, and any two leader lines that still
     cross swap cards (which always shortens them), so leaders never cross.
     ========================================================= */
  const labelsEl = document.getElementById('labels'), svg = document.getElementById('leaders');
  let LABELS = [], labelsOn = true;
  function initLabels(list) {
    LABELS.forEach(L => { L.el.remove(); L.line.remove(); L.dot.remove(); });
    LABELS = list;
    LABELS.forEach(L => {
      L.el = document.createElement('div'); L.el.className = 'lab';
      L.el.innerHTML = '<b></b><span></span>'; L.el.querySelector('b').textContent = L.title; L.sub = L.el.querySelector('span');
      labelsEl.appendChild(L.el);
      L.line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); L.line.setAttribute('fill', 'none'); L.line.setAttribute('stroke', '#efe5cf'); L.line.setAttribute('stroke-width', '1.5');
      L.dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); L.dot.setAttribute('r', '4'); L.dot.setAttribute('fill', '#df3a2c'); L.dot.setAttribute('stroke', '#1b1712'); L.dot.setAttribute('stroke-width', '1.5');
      svg.append(L.line, L.dot);
    });
  }
  function setLab(id, text, cls) { const L = LABELS.find(l => l.id === id); if (!L) return; if (L.sub.textContent !== text) L.sub.textContent = text; const c = cls || ''; if (L.sub.className !== c) L.sub.className = c; }
  function showLabels(on) { labelsOn = on; }
  const pv = new T.Vector3();
  const hideLab = L => { L.el.style.display = 'none'; L.line.style.display = L.dot.style.display = 'none'; };
  // Do segments p1-p2 and p3-p4 cross?
  function crosses(a, b) {
    const d = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = d(b.p, b.q, a.p), d2 = d(b.p, b.q, a.q), d3 = d(a.p, a.q, b.p), d4 = d(a.p, a.q, b.q);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  // Labels stay above an object on the screen (the console): setAvoid(object3D) or setAvoid(null).
  let avoid = null;
  const avoidBox = new T.Box3();
  function setAvoid(o) { avoid = o; }
  function avoidTop() {
    if (!avoid || !avoid.visible) return Infinity;
    avoidBox.setFromObject(avoid);
    let top = Infinity;
    for (let i = 0; i < 8; i++) {
      pv.set(i & 1 ? avoidBox.max.x : avoidBox.min.x, i & 2 ? avoidBox.max.y : avoidBox.min.y, i & 4 ? avoidBox.max.z : avoidBox.min.z).project(camera);
      if (pv.z < 1) top = Math.min(top, (-pv.y * 0.5 + 0.5) * viewH);
    }
    return top;
  }
  function updateLabels() {
    if (!labelsOn || document.body.classList.contains('hide-ui') || window.innerWidth <= 900) { LABELS.forEach(hideLab); return; }
    const shown = [], floor = avoidTop() - 14;
    LABELS.forEach(L => {
      pv.copy(L.at).project(camera);
      if (!(pv.z < 1 && Math.abs(pv.x) < 1.02 && Math.abs(pv.y) < 1.02)) { hideLab(L); return; }
      L.x = (pv.x * 0.5 + 0.5) * viewW; L.y = (-pv.y * 0.5 + 0.5) * viewH;
      L.el.style.display = ''; L.line.style.display = L.dot.style.display = '';
      L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; shown.push(L);
    });
    shown.sort((a, b) => a.x - b.x);
    const half = Math.ceil(shown.length / 2), gap = 10;
    [[shown.slice(0, half), rails.left], [shown.slice(half), rails.right]].forEach(([list, rail]) => {
      const bottom = Math.max(rail.top + 60, Math.min(rail.bottom, floor));
      list.sort((a, b) => a.y - b.y);
      // slots: centred on the anchors' heights, pushed apart, then pulled back inside the rail
      const ys = list.map(L => L.y - L.h / 2);
      for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i ? ys[i - 1] + list[i - 1].h + gap : rail.top);
      for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], i < ys.length - 1 ? ys[i + 1] - list[i].h - gap : bottom - list[i].h);
      for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i ? ys[i - 1] + list[i - 1].h + gap : rail.top);
      const seg = (L, y) => { const x = rail.side < 0 ? rail.x + L.w : rail.x - L.w; return { p: [L.x, L.y], q: [x, y + L.h / 2] }; };
      const slot = list.map((L, i) => i);
      for (let round = 0; round < 12; round++) {
        let swapped = false;
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          if (crosses(seg(list[i], ys[slot[i]]), seg(list[j], ys[slot[j]]))) { const t = slot[i]; slot[i] = slot[j]; slot[j] = t; swapped = true; }
        }
        if (!swapped) break;
      }
      list.forEach((L, i) => {
        if (ys[slot[i]] + L.h > bottom + 1) { hideLab(L); return; } // no room left on this rail
        const y = ys[slot[i]], bx = rail.side < 0 ? rail.x : rail.x - L.w, s = seg(L, y);
        L.el.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        L.line.setAttribute('points', s.p[0].toFixed(1) + ',' + s.p[1].toFixed(1) + ' ' + s.q[0].toFixed(1) + ',' + s.q[1].toFixed(1));
        L.dot.setAttribute('cx', L.x.toFixed(1)); L.dot.setAttribute('cy', L.y.toFixed(1));
      });
    });
  }

  /* =========================================================
     CAMERA SHOTS, FRAMING, KEYS
     ========================================================= */
  const SHOTS = {
    '1': { pos: [27, 30, 36], tgt: [0, 2.2, -0.5] },
    '2': { pos: [12.5, 9, 8.5], tgt: [4.2, 1.2, 0] },
    '3': { pos: [5.5, 5.2, 8.2], tgt: [0.3, 1.4, 0.2] },
    '4': { pos: [-7.5, 7.5, 14], tgt: [-2.2, 1.4, 5.4] }
  };
  // A machine brings its own close-ups (2, 3, 4); shot 1 is framed from the free screen area in resize().
  const SHOTS_DEFAULT = JSON.parse(JSON.stringify(SHOTS));
  function setShots(own) { ['2', '3', '4'].forEach(k => { SHOTS[k] = (own && own[k]) || SHOTS_DEFAULT[k]; }); }
  // A tall window (9:16) sees less sideways, so close-ups back off to keep the part in frame.
  function shotPos(s) {
    const pos = new T.Vector3(...s.pos), tgt = new T.Vector3(...s.tgt);
    if (frameAspect < 1 && s !== SHOTS['1']) pos.sub(tgt).multiplyScalar(Math.min(2.2, 1.25 / frameAspect)).add(tgt);
    return pos;
  }
  // The tilt-shift keeps a band in focus: the whole overview (machine and console) on shot 1, the classic narrow band on the close-ups.
  const TILT_CLOSE = { focus: 0.5, band: 0.16 };
  let tiltWide = { focus: 0.5, band: 0.3 };
  function setTilt(t) { [tiltH, tiltV].forEach(p => { p.uniforms.focus.value = t.focus; p.uniforms.band.value = t.band; }); }
  let shot = null, shotKey = '1';
  function goShot(k, instant) {
    const s = SHOTS[k]; shotKey = k; setTilt(k === '1' ? tiltWide : stack.on ? { focus: 0.5, band: 1 } : TILT_CLOSE);
    shot = { pos: shotPos(s), tgt: new T.Vector3(...s.tgt), t: 0 }; controls.autoRotate = false;
    if (instant) { camera.position.copy(shot.pos); controls.target.copy(shot.tgt); shot = null; }
  }
  controls.addEventListener('start', () => { shot = null; });

  // Shot 1 looks down from SHOT1_DIR and fits boxes into the free part of the screen. setFrame({ wide, tall, small, focus, stack })
  // gives a list of Box3 for each layout: wide (a landscape window), tall (a 9:16 recording), small (a phone with the
  // interface showing) and focus (a screen area handed over by setArea, e.g. a guided tour). stack: { bottom: [Box3],
  // object } stacks a tall frame: the tall boxes fill the width at the top, as large as they would be alone, and a
  // second camera draws the object (the console) across the full width of a band along the bottom.
  // onLayout(fn) hears which layout is in use before the fit (the console hides on a phone).
  const SHOT1_DIR = new T.Vector3(0.2, 0.64, 0.74).normalize();
  let frames = null, layoutMode = 'wide', onLayoutFn = null, areaFn = null;
  const fitCam = new T.PerspectiveCamera();
  // align: 'bottom' sets the boxes on the rect's bottom edge instead of centring them
  function fit(boxes, rect, cam, align) {
    fitCam.copy(cam || camera);
    const pts = [], all = new T.Box3(), v = new T.Vector3(), right = new T.Vector3(), up = new T.Vector3();
    boxes.forEach(b => { all.union(b); for (let i = 0; i < 8; i++) pts.push(new T.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z)); });
    const tgt = all.getCenter(new T.Vector3()), tanV = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    let dist = 80, ext = null;
    const project = () => {
      fitCam.position.copy(tgt).addScaledVector(SHOT1_DIR, dist); fitCam.lookAt(tgt); fitCam.updateMatrixWorld();
      ext = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
      pts.forEach(p => {
        v.copy(p).project(fitCam);
        const sx = (v.x + 1) / 2 * viewW, sy = (1 - v.y) / 2 * viewH;
        ext.x0 = Math.min(ext.x0, sx); ext.x1 = Math.max(ext.x1, sx); ext.y0 = Math.min(ext.y0, sy); ext.y1 = Math.max(ext.y1, sy);
      });
    };
    for (let it = 0; it < 12; it++) {
      project();
      const wpp = 2 * dist * tanV / viewH;                  // world units per pixel at the target's distance
      const want = align === 'bottom' ? 2 * rect.bottom - (ext.y1 - ext.y0) : rect.top + rect.bottom;
      right.setFromMatrixColumn(fitCam.matrixWorld, 0); up.setFromMatrixColumn(fitCam.matrixWorld, 1);
      tgt.addScaledVector(right, ((ext.x0 + ext.x1) - (rect.left + rect.right)) / 2 * wpp).addScaledVector(up, (want - (ext.y0 + ext.y1)) / 2 * wpp);
      dist *= Math.max((ext.x1 - ext.x0) / (rect.right - rect.left), (ext.y1 - ext.y0) / (rect.bottom - rect.top));
    }
    project();
    return { pos: fitCam.position.toArray(), tgt: tgt.toArray(), ext };
  }
  // A page part can take over where the scene is framed: setArea(fn), fn() -> { left, right, top, bottom } in pixels, or
  // null to give it back. While it returns a rect the layout is 'focus' and shot 1 fits frames.focus into that rect.
  function setArea(fn) { areaFn = fn; resize(); }

  const dock = document.getElementById('dock');
  let viewW = 1, viewH = 1;
  const rails = { left: { x: 30, side: -1, top: 0, bottom: 1 }, right: { x: 1, side: 1, top: 0, bottom: 1 } };
  function resize() {
    const hidden = document.body.classList.contains('hide-ui');
    const area = areaFn ? areaFn() : null;
    const mobile = window.innerWidth <= 900 && !hidden && !area;
    const dockH = mobile ? dock.getBoundingClientRect().height : 0;
    viewW = window.innerWidth; viewH = Math.max(220, window.innerHeight - dockH);
    canvas.style.height = viewH + 'px';
    renderer.setSize(viewW, viewH, false);
    composer.setPixelRatio(PR); composer.setSize(viewW, viewH);
    bloom.setSize(viewW * PR, viewH * PR);
    camera.aspect = viewW / viewH; camera.updateProjectionMatrix();
    tiltH.uniforms.dir.value.set(1 / (viewW * PR), 0); tiltV.uniforms.dir.value.set(0, 1 / (viewH * PR));
    grade.uniforms.res.value.set(viewW * PR, viewH * PR);
    layoutMode = area ? 'focus' : mobile ? 'small' : hidden && camera.aspect < 1 ? 'tall' : 'wide';
    if (onLayoutFn) onLayoutFn(layoutMode);
    let left = 12, right = viewW - 12, top = 12, bottom = viewH - 12;
    const desktop = !area && window.innerWidth > 900 && !hidden;
    if (area) ({ left, right, top, bottom } = area);
    else if (desktop) {
      // the free area: right of the page's edge, left of the answer and race panels, above the controls bar when it is pinned open
      // on a short screen the title is compact and the machine goes below it (the stylesheet hides the sticker there)
      left = 30; top = viewH <= 820 ? document.querySelector('.title').getBoundingClientRect().bottom + 10 : 70;
      right = Math.min(document.querySelector('.answer').getBoundingClientRect().left, document.querySelector('.race').getBoundingClientRect().left) - 16;
      bottom = document.body.classList.contains('bar-on') ? document.querySelector('.controls').getBoundingClientRect().top - 12 : viewH - 18;
      if (right - left < viewW * 0.3 || bottom - top < viewH * 0.3) { left = 12; right = viewW - 12; top = 12; bottom = viewH - 12; }
    }
    // a stacked tall frame: the console's band first (full width, as tall as the console comes out), the machine above it
    stack.on = layoutMode === 'tall' && !!(frames && frames.stack && frames.stack.object.visible);
    if (stack.on) {
      stack.object = frames.stack.object;
      camera.clearViewOffset();
      const probe = fit(frames.stack.bottom, { left: 0, right: viewW, top: 0, bottom: viewH });
      const pad = Math.round(viewW * 0.02);
      stack.bandH = Math.min(viewH * 0.42, (viewW - 2 * pad) * (probe.ext.y1 - probe.ext.y0) / (probe.ext.x1 - probe.ext.x0) + 2 * pad);
      bottom = viewH - stack.bandH;
      camB.copy(camera);
      camB.setViewOffset(viewW, viewH, 0, -(viewH - stack.bandH / 2 - viewH / 2), viewW, viewH);
      const fb = fit(frames.stack.bottom, { left: pad, right: viewW - pad, top: bottom + pad, bottom: viewH - pad }, camB);
      camB.position.fromArray(fb.pos); camB.lookAt(new T.Vector3().fromArray(fb.tgt)); camB.updateMatrixWorld();
    }
    grade.uniforms.seam.value = stack.on ? stack.bandH / viewH : -1;
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    if (desktop || area || stack.on) camera.setViewOffset(viewW, viewH, -(cx - viewW / 2), -(cy - viewH / 2), viewW, viewH); else camera.clearViewOffset();
    frameAspect = (right - left) / Math.max(1, bottom - top);
    if (frames && frames[layoutMode] && frames[layoutMode].length) {
      const f = fit(frames[layoutMode], { left, right, top, bottom }, camera, stack.on ? 'bottom' : null);
      SHOTS['1'].pos = f.pos; SHOTS['1'].tgt = f.tgt;
      const y0 = 1 - f.ext.y1 / viewH, y1 = 1 - f.ext.y0 / viewH;        // the fitted boxes in texture v (up)
      tiltWide = stack.on ? { focus: 0.5, band: 1 } : { focus: (y0 + y1) / 2, band: Math.max(0.16, (y1 - y0) / 2 + 0.02) };
      if (shotKey === '1') setTilt(tiltWide);
    }
    if (stack.on && shotKey !== '1') setTilt({ focus: 0.5, band: 1 });
    const titleR = document.querySelector('.title').getBoundingClientRect();
    Object.assign(rails.left, { x: left, top: Math.max(top, titleR.bottom + 16), bottom });
    Object.assign(rails.right, { x: right, top, bottom });
  }
  let frameAspect = 1;
  function setFrame(f) { frames = f; resize(); }
  function onLayout(fn) { onLayoutFn = fn; }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) { const ro = new ResizeObserver(resize); ro.observe(dock); document.querySelectorAll('.panel').forEach(el => ro.observe(el)); }

  /* =========================================================
     POINTER: things in the scene you can press and drag (the console's controls, a machine's lid), with mouse,
     touch or pen. grab(handle) registers one:
       { meshes, cursor, enabled(), hover(on), down(p), move(p), up(p), wheel(dir) }
     p = { x, y, x0, y0, moved, ray (a THREE.Ray, world space), hit (the first hit, on down) }.
     A press that lands on one never reaches the orbit controls. block(meshes): solid things that stop the pointer
     (the console's body), so nothing is grabbed through them. Meshes may use an invisible material as a bigger hit zone.
     ========================================================= */
  const caster = new T.Raycaster(), ndc = new T.Vector2();
  const grabs = [], blockers = [];
  let hoverG = null, drag = null;
  const shownDeep = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  function aim(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1);
    caster.setFromCamera(ndc, stack.on && ev.clientY - r.top > viewH - stack.bandH ? camB : camera);   // the stacked console has its own camera
  }
  function pick(ev) {
    aim(ev);
    const list = [];
    grabs.forEach(g => { if (!g.enabled || g.enabled()) g.meshes.forEach(m => { if (shownDeep(m)) list.push(m); }); });
    blockers.forEach(m => { if (shownDeep(m)) list.push(m); });
    const hit = caster.intersectObjects(list, false)[0];
    return hit && hit.object.userData.grab ? { g: hit.object.userData.grab, hit } : null;
  }
  function grab(h) { h.meshes.forEach(m => { m.userData.grab = h; }); grabs.push(h); return h; }
  function block(meshes) { blockers.push(...meshes); }
  function setHover(g) {
    if (g === hoverG) return;
    if (hoverG && hoverG.hover) hoverG.hover(false);
    hoverG = g; if (g && g.hover) g.hover(true);
    canvas.style.cursor = g ? (g.cursor || 'pointer') : '';
  }
  const pInfo = (ev, extra) => Object.assign({ x: ev.clientX, y: ev.clientY, ray: caster.ray, ev }, extra);
  window.addEventListener('pointerdown', ev => {
    if (ev.target !== canvas || drag || ev.button > 0) return;
    const t = pick(ev); if (!t) return;
    ev.stopPropagation(); ev.preventDefault();                   // capture phase: the orbit controls never see this press
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* the pointer is already gone */ }
    drag = { g: t.g, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, moved: false };
    controls.enabled = false; setHover(t.g);
    if (t.g.cursor === 'grab') canvas.style.cursor = 'grabbing';
    if (t.g.down) t.g.down(pInfo(ev, { x0: ev.clientX, y0: ev.clientY, moved: false, hit: t.hit }));
  }, true);
  window.addEventListener('pointermove', ev => {
    if (drag) {
      if (ev.pointerId !== drag.id) return;
      aim(ev);
      if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) > 5) drag.moved = true;
      if (drag.g.move) drag.g.move(pInfo(ev, { x0: drag.x0, y0: drag.y0, moved: drag.moved }));
      return;
    }
    if (ev.pointerType !== 'mouse' || ev.target !== canvas || ev.buttons) { if (ev.target !== canvas) setHover(null); return; }
    const t = pick(ev); setHover(t ? t.g : null);
  });
  function endDrag(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const d = drag; drag = null; controls.enabled = true;
    aim(ev);
    if (d.g.up) d.g.up(pInfo(ev, { x0: d.x0, y0: d.y0, moved: d.moved, cancel: ev.type === 'pointercancel' }));
    if (ev.pointerType !== 'mouse') setHover(null); else canvas.style.cursor = hoverG ? (hoverG.cursor || 'pointer') : '';
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { if (!drag) setHover(null); });
  // the scroll wheel over a control turns it instead of zooming
  window.addEventListener('wheel', ev => {
    if (ev.target !== canvas || !hoverG || !hoverG.wheel || drag) return;
    ev.stopPropagation(); ev.preventDefault();
    hoverG.wheel(ev.deltaY < 0 ? 1 : -1);
  }, { capture: true, passive: false });
  // where a pointer ray meets a plane, or null
  const hitPlane = (ray, plane) => ray.intersectPlane(plane, new T.Vector3());
  // owner: the object the point belongs to (the stacked console is drawn by its own camera)
  const toScreen = (p, out, owner) => { pv.copy(p).project(stack.on && owner && owner === stack.object ? camB : camera); out = out || {}; out.x = (pv.x * 0.5 + 0.5) * viewW; out.y = (-pv.y * 0.5 + 0.5) * viewH; return out; };

  window.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (/INPUT|SELECT|TEXTAREA/.test(tag) && k.length === 1 && k !== ' ') return;
    if (k === ' ') { if (/INPUT|BUTTON|SUMMARY|SELECT/.test(tag)) return; e.preventDefault(); actions.launch(); return; }
    if (k === 'c') { controls.autoRotate = !controls.autoRotate; shot = null; }
    else if (k === 'h') actions.toggleUI();
    else if (k === 'm') actions.nextMachine();
    else if (k === 'o') actions.toggleCase();
    else if (k === 'b') actions.toggleBar();
    else if (k === 'f') { if (!document.fullscreenElement) { const d = document.documentElement; if (d.requestFullscreen) d.requestFullscreen().catch(() => {}); } else if (document.exitFullscreen) document.exitFullscreen(); }
    else if (SHOTS[k]) goShot(k);
  });

  /* =========================================================
     LOOP: step(dt, time) runs the simulation, ui() runs about 12 times a second.
     ========================================================= */
  // pause(true) stops drawing the scene (the panels keep updating): live mode uses it while the Spark benchmarks
  // itself, since a lab open on the Spark draws on the same GPU the model runs on.
  let paused = false;
  const pause = on => { paused = !!on; };
  function run(step, ui) {
    const clock = new T.Clock();
    let first = true, uiTick = 0;
    (function frame() {
      const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
      if (paused && !first) { uiTick += dt; if (uiTick > 0.08) { uiTick = 0; ui(); } requestAnimationFrame(frame); return; }
      step(dt, time);
      if (shot) {
        shot.t += dt; const k = 1 - Math.exp(-dt * (reduceMotion ? 30 : 3.2));
        camera.position.lerp(shot.pos, k); controls.target.lerp(shot.tgt, k);
        if (camera.position.distanceTo(shot.pos) < 0.02 || shot.t > 4) shot = null;
      }
      controls.update();
      uiTick += dt; if (uiTick > 0.08) { uiTick = 0; ui(); }
      grade.uniforms.time.value = time;
      composer.render();
      updateLabels();
      if (first) { first = false; document.getElementById('loading').classList.add('gone'); }
      requestAnimationFrame(frame);
    })();
  }

  DSP.actions = actions;
  DSP.engine = { T, reduceMotion, canvas, renderer, scene, camera, controls, canvasTex, std, mesh, add, setParent, glow, heat, pool, qb, initLabels, setLab, showLabels, setAvoid, SHOTS, setShots, goShot, shotNow: () => shotKey, resize, setFrame, setArea, onLayout, layout: () => layoutMode, stacked: () => stack.on, grab, block, hitPlane, toScreen, view: () => ({ w: viewW, h: viewH }), run, pause };
})(window.DSP = window.DSP || {});
