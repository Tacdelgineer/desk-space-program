/* =========================================================
   BOARD: what every machine does as the simulation runs, so the three machines light up
   by the same rules. A machine file builds its parts, then hands them to lightUp().
   - bus(): one glowing lane per 32 bits of memory bus, with data flowing along it
   - lightUp(): memory cells (1 cell = 1 GB), one prompt-memory group per request,
     GPU blocks lit in proportion to the math used, the "GPU maxed out" marker, fans, particles
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.parts) return;
  const E = DSP.engine, T = E.T, add = E.add, qb = E.qb, reduceMotion = E.reduceMotion;

  /* ---------- the bus: lanes [{ s: Vector3, e: Vector3 }], each lane is 32 bits wide ---------- */
  function bus(lanes, Y0, o) {
    o = Object.assign({ width: 0.8, per: 30, size: 0.13 }, o);
    const laneMat = new T.MeshBasicMaterial({ color: 0x27f2d2, transparent: true, opacity: 0.0, blending: T.AdditiveBlending, depthWrite: false });
    lanes.forEach(L => {
      L.dir = L.e.clone().sub(L.s).normalize();
      const g = new T.PlaneGeometry(L.s.distanceTo(L.e), o.width); g.rotateX(-Math.PI / 2);
      const m = new T.Mesh(g, laneMat); m.position.copy(L.s).add(L.e).multiplyScalar(0.5); m.position.y = Y0 + 0.012;
      m.rotation.y = -Math.atan2(L.e.z - L.s.z, L.e.x - L.s.x); add(m);
    });
    const per = o.per, n = lanes.length * per;
    const pos = new Float32Array(n * 3), ft = new Float32Array(n), fo = new Float32Array(n);
    for (let i = 0; i < n; i++) { ft[i] = Math.random(); fo[i] = (Math.random() - 0.5) * o.width * 0.875; }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({ color: 0x5ffbe3, size: o.size, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; add(pts);
    return {
      count: lanes.length,
      update(sim, dt) {
        const busy = sim.phase === 'reading' || sim.phase === 'writing';
        laneMat.opacity = 0.02 + sim.bus * 0.16;
        mat.opacity = busy ? 0.25 + 0.75 * sim.bus : 0.12;
        const speed = (0.15 + sim.bus * 2.4) * (busy ? 1 : 0.2);
        for (let l = 0; l < lanes.length; l++) {
          const L = lanes[l];
          for (let j = 0; j < per; j++) {
            const i = l * per + j;
            ft[i] += dt * speed * (0.8 + 0.4 * ((j * 7) % 5) / 5); if (ft[i] > 1) ft[i] -= 1;
            const t = ft[i];
            pos[i * 3] = L.s.x + (L.e.x - L.s.x) * t - L.dir.z * fo[i];
            pos[i * 3 + 1] = Y0 + 0.06;
            pos[i * 3 + 2] = L.s.z + (L.e.z - L.s.z) * t + L.dir.x * fo[i];
          }
        }
        geo.attributes.position.needsUpdate = true;
      }
    };
  }

  /* ---------- a flat frame around a rectangle on the board: the "maxed out" marker ---------- */
  function frame(x, z, w, d, y, color) {
    const mat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    const g = new T.Group(), t = 0.09;
    [[0, -d / 2, w + t, t], [0, d / 2, w + t, t], [-w / 2, 0, t, d], [w / 2, 0, t, d]].forEach(([dx, dz, bw, bd]) => {
      const m = new T.Mesh(new T.BoxGeometry(bw, 0.03, bd), mat); m.position.set(x + dx, y, z + dz); g.add(m);
    });
    g.visible = false; add(g);
    return { g, mat };
  }

  /* ---------- the machine lights up ----------
     o: { mem: memory() result, gpu and cpu: tiles() results (one, a list, or none for cpu), bus: bus() result,
          fans: [fan() results], gpuBox: [x, z, w, d, y], loadFrom: Vector3, loadP, spillP } */
  function lightUp(o) {
    const { mem, gpu, cpu, fans, loadFrom, loadP, spillP } = o;
    const gpus = [].concat(gpu), cpus = cpu ? [].concat(cpu) : [];
    const N = mem.n, NG = gpus.reduce((a, m) => a + m.count, 0), NC = cpus.reduce((a, m) => a + m.count, 0);
    const setTile = (list, i, c) => { for (const m of list) { if (i < m.count) { m.setColorAt(i, c); return; } i -= m.count; } };
    const nOver = Math.max(3, Math.round(N * 0.08)), nSpill = Math.floor(N * 0.875);
    const rank = i => (i * 37 + 11) % NG; // a fixed scattered order, so blocks light up across the die as the crew grows
    const col = new T.Color(), hitC = new T.Color(0.7, 1.6, 1.45);
    const C_EMPTY = new T.Color(0.018, 0.02, 0.03), C_SYS = new T.Color(0.09, 0.1, 0.22), C_W = new T.Color(0.09, 0.95, 0.8), C_KV = new T.Color(0.85, 0.87, 1.0), C_OVER = new T.Color(1.4, 0.18, 0.55);
    const KV_A = new T.Color(0.95, 0.93, 1.0), KV_B = new T.Color(0.55, 0.62, 1.15);
    const marker = frame(...o.gpuBox, new T.Color(1.6, 0.25, 0.15));

    // prompt memory: one sliver per request per cell it touches, drawn over the cells
    const cap = N + 70;
    const kv = new T.InstancedMesh(new T.BoxGeometry(1, 0.012, 1), new T.MeshBasicMaterial({ color: 0xffffff }), cap);
    for (let i = 0; i < cap; i++) kv.setColorAt(i, C_EMPTY); // colours exist from the first frame, so the shader is built with them
    kv.count = 0; kv.frustumCulled = false; add(kv);
    const kvOwner = new Int16Array(cap), ob = new T.Object3D();
    let kvKey = '';
    function layoutKv(start, per, n, end) {
      const key = [start, per, n, end].map(v => v.toFixed(4)).join('|');
      if (key === kvKey) return; kvKey = key;
      let k = 0;
      for (let r = 0; r < n && k < cap; r++) {
        const a = start + r * per, b = Math.min(end, a + per);
        if (a >= end) break;
        for (let c = Math.floor(a); c < b && c < N && k < cap; c++) {
          const f0 = Math.max(a, c) - c, f1 = Math.min(b, c + 1) - c;
          const gap = Math.min(0.03, (f1 - f0) * 0.2), len = (f1 - f0) * mem.cw - gap * mem.cw * 2;
          if (len <= 0.004) continue;
          const lx = -mem.cw / 2 + (f0 + f1) / 2 * mem.cw, rot = mem.cellRot[c], p = mem.cellPos[c];
          ob.position.set(p.x + Math.cos(rot) * lx, mem.CELL_Y + 0.01, p.z - Math.sin(rot) * lx);
          ob.rotation.set(0, rot, 0); ob.scale.set(len, 1, mem.cd * 0.78); ob.updateMatrix();
          kv.setMatrixAt(k, ob.matrix); kvOwner[k] = r; k++;
        }
      }
      kv.count = k; kv.instanceMatrix.needsUpdate = true;
    }

    return function animate(sim, model, dt, time) {
      const p = sim.plan;
      fans.forEach(f => { f.fan.rotation.y = reduceMotion ? 0 : f.fan.rotation.y + sim.fan * dt * 6; });

      // memory cells: system reserve, weights, prompt memory, empty; overflow in magenta
      const usable = p.usable, wC = Math.min(usable, p.weightsGB), kC = p.fits ? p.kvTotal : Math.max(0, usable - wC);
      const shownW = wC * sim.load, shownK = kC * Math.max(0, sim.load * 1.4 - 0.4);
      const tokPhase = sim.tokens - Math.floor(sim.tokens);
      const nW = Math.ceil(wC);
      for (let i = 0; i < N; i++) {
        if (i >= usable) { col.copy(C_SYS); }
        else if (i < shownW) {
          const part = Math.min(1, shownW - i);
          col.copy(C_W).multiplyScalar(0.28 + 0.5 * part);
          if (sim.phase === 'writing') {
            let hit = 0;
            if (model.moe) hit = sim.activeSet && sim.activeSet.has(i) ? sim.flash : 0;
            else { const d = Math.abs(i / Math.max(1, nW) - tokPhase); hit = Math.max(0, 1 - d * 9); }
            col.lerp(hitC, hit * 0.8);
          } else if (sim.phase === 'reading') col.multiplyScalar(1.15 + 0.25 * Math.sin(time * 7 + i));
        } else if (i < shownW + shownK) { col.copy(C_KV).multiplyScalar(0.12); }
        else col.copy(C_EMPTY);
        if (!p.fits && sim.load >= 1 && i < usable && i >= usable - nOver) col.copy(C_OVER).multiplyScalar(0.55 + 0.45 * Math.sin(time * 9));
        mem.cells.setColorAt(i, col);
      }
      mem.cells.instanceColor.needsUpdate = true;

      // one prompt-memory group per request: dim while reserved, lit as each prompt is read
      layoutKv(wC, p.kvGB, p.crew, Math.min(usable, wC + shownK));
      const readUpTo = sim.phase === 'reading' ? p.crew * Math.min(1, sim.t / Math.max(1e-6, p.readS)) : sim.phase === 'writing' || sim.phase === 'done' ? p.crew : 0;
      for (let k = 0; k < kv.count; k++) {
        const r = kvOwner[k];
        col.copy(r % 2 ? KV_B : KV_A).multiplyScalar(r < readUpTo ? 0.85 : 0.22);
        kv.setColorAt(k, col);
      }
      if (kv.instanceColor) kv.instanceColor.needsUpdate = true;

      if (!p.fits && sim.load >= 1 && Math.random() < dt * 30) {
        const c = mem.cellPos[Math.floor(Math.random() * nSpill)];
        spillP.spawn({ life: 1.6, fade: true, p: c.clone().setY(c.y + 0.1), v: new T.Vector3(Math.sign(c.x || 1) * (2 + Math.random() * 2), 3 + Math.random() * 2, (Math.random() - 0.5) * 2) });
      }
      // loading arcs into the cells
      if (sim.phase === 'loading' && sim.load < 0.95 && Math.random() < dt * 60) {
        const target = mem.cellPos[Math.floor(Math.random() * Math.max(1, Math.min(nW, N - 8)))];
        const mid = loadFrom.clone().add(target).multiplyScalar(0.5).setY(4.5);
        loadP.spawn({ life: 0.8, path: t => qb(loadFrom, mid, target, t) });
      }

      // GPU blocks: all blazing while reading; while writing, lit in proportion to the math used
      const lit = p.gpuMax ? NG : Math.max(1, Math.round(p.busyWrite * NG));
      for (let i = 0; i < NG; i++) {
        let h = 0;
        if (sim.phase === 'reading') h = 0.75 + 0.35 * Math.random();
        else if (sim.phase === 'writing' && rank(i) < lit) h = p.gpuMax ? 0.8 + 0.3 * Math.random() : (0.3 + 0.7 * sim.flash) * (0.75 + 0.25 * Math.random());
        col.setRGB(0.012 + 1.7 * h, 0.013 + 0.75 * Math.pow(h, 1.5), 0.02 + 0.25 * h * h * h);
        setTile(gpus, i, col);
      }
      gpus.forEach(m => { m.instanceColor.needsUpdate = true; });
      for (let i = 0; i < NC; i++) {
        const h = (sim.phase === 'reading' ? 0.3 : sim.phase === 'writing' ? 0.12 : 0.03) * (0.6 + 0.4 * Math.sin(time * 3 + i * 1.7));
        col.setRGB(0.012 + 0.3 * h, 0.014 + 0.4 * h, 0.03 + 1.1 * h); setTile(cpus, i, col);
      }
      cpus.forEach(m => { m.instanceColor.needsUpdate = true; });
      E.heat.intensity = sim.gpu * 7 + sim.flash * 2;
      marker.g.visible = p.gpuMax && p.fits && sim.load >= 1;
      marker.mat.opacity = 0.55 + 0.45 * Math.sin(time * 6);

      o.bus.update(sim, dt);
      E.glow.intensity = sim.bus * 1.1;
      fans.forEach(f => f.ringM.color.setRGB(0.15 + 0.4 * sim.gpu, 0.5 + 0.8 * sim.gpu * 0.3 + 0.2, 0.5));
      o.loadP.update(dt); o.outP.update(dt); spillP.update(dt);
    };
  }

  DSP.board = { bus, lightUp };
})(window.DSP = window.DSP || {});
