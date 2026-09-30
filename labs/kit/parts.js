/* =========================================================
   PARTS: rounded boxes, the material library, and a builder for each kind of part
   (main chip, memory package, inductor, capacitor, SSD, ports, heat pipe, fan...).
   A machine file in machines/ decides where each one sits.
   Y0 is the top of the board, x and z are on the board plane.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.engine) return;
  const E = DSP.engine, T = E.T, scene = E.scene, mesh = E.mesh, std = E.std, canvasTex = E.canvasTex;

  function rrShape(w, d, r) {
    const s = new T.Shape(), x = -w / 2, y = -d / 2; r = Math.max(0.0005, Math.min(r, w / 2, d / 2));
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }
  const geoCache = {};
  function rbox(w, h, d, r) {
    const k = [w, h, d, r].map(v => v.toFixed(3)).join('|');
    if (geoCache[k]) return geoCache[k];
    r = Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002);
    const depth = Math.max(0.001, h - 2 * r);
    const g = new T.ExtrudeGeometry(rrShape(w - 2 * r, d - 2 * r, r * 0.8), { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 5 });
    g.rotateX(-Math.PI / 2); g.translate(0, -depth / 2, 0); g.computeVertexNormals();
    geoCache[k] = g; return g;
  }
  // instanced helper for small parts: list of [x, y, z, rotationY]
  function scatter(geo, mat, list, cast) {
    const im = new T.InstancedMesh(geo, mat, list.length); const o = new T.Object3D();
    list.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[3] || 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = !!cast; im.receiveShadow = true; scene.add(im); return im;
  }

  /* ---------- material library ---------- */
  const foamBump = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      const cx = Math.random() * w, cy = Math.random() * h, r = 4 + Math.random() * 11;
      x.fillStyle = '#2e2e2e'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      x.strokeStyle = '#d2d2d2'; x.lineWidth = 1.6; x.stroke();
    }
  }, false);
  foamBump.wrapS = foamBump.wrapT = T.RepeatWrapping; foamBump.repeat.set(3, 1);
  const brushed = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#909090'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 110 + Math.random() * 60; x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; x.fillRect(0, Math.random() * h, w, 1); }
  }, false);
  brushed.wrapS = brushed.wrapT = T.RepeatWrapping;

  const M = {
    plinth: std(0x0a0b12, 0.42, 0.3, { envMapIntensity: 0.12 }),
    gold: std(0xb8914f, 0.28, 1, { roughnessMap: brushed, envMapIntensity: 0.55 }),
    foam: std(0xae8a4c, 0.6, 1, { bumpMap: foamBump, bumpScale: 0.06, envMapIntensity: 0.45 }),
    dark: std(0x1a1b22, 0.45, 0.6, { envMapIntensity: 0.6 }),
    epoxy: std(0x111217, 0.32, 0.15, { envMapIntensity: 0.9 }),
    substrate: std(0x283530, 0.5, 0.15, { envMapIntensity: 0.6 }),
    die: new T.MeshPhysicalMaterial({ color: 0x171923, roughness: 0.16, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 }),
    ind: std(0x3d4049, 0.5, 0.35, { envMapIntensity: 0.7 }),
    indTop: std(0x26282f, 0.6, 0.2),
    capBody: std(0x1b1c23, 0.4, 0.2),
    alu: std(0x9aa0ac, 0.34, 1, { roughnessMap: brushed, envMapIntensity: 0.5 }),
    copper: std(0xb3693a, 0.26, 1, { envMapIntensity: 0.6 }),
    mlcc: std(0xa9865d, 0.5, 0.1),
    black: std(0x0c0d11, 0.5, 0.1),
    ssd: std(0x0d2621, 0.5, 0.2)
  };

  // Call once, after everything is in the scene: the environment map lights dark surfaces too much,
  // so every material except the metals and the stand gets 0.55x (HANDOFF gotcha 4).
  function tuneEnv() {
    scene.traverse(o => { const m = o.material; if (m && m.envMapIntensity !== undefined && !m.userData.envTuned && m !== M.gold && m !== M.foam && m !== M.alu && m !== M.copper && m !== M.plinth) { m.envMapIntensity *= 0.55; m.userData.envTuned = true; } });
  }

  /* ---------- the display stand: plinth, placard, glowing floor edge ---------- */
  function stand(placardLeft, placardRight) {
    mesh(rbox(30, 3, 30, 0.5), M.plinth, 0, -1.5, 0);
    const placard = new T.Mesh(new T.PlaneGeometry(18, 1.35), new T.MeshStandardMaterial({
      map: canvasTex(2048, 154, (x, w, h) => {
        x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(160,168,220,.75)';
        x.font = '500 66px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
        x.fillText(placardLeft, 16, h / 2);
        x.fillStyle = 'rgba(255,201,60,.8)'; x.fillText(placardRight, w - 420, h / 2);
      }, true), transparent: true, roughness: 0.6, metalness: 0.3
    }));
    placard.position.set(0, -1.5, 15.02); scene.add(placard);
    // thin glowing edge on the floor, front and right
    const edgeM = new T.MeshBasicMaterial({ color: new T.Color(0x27f2d2).multiplyScalar(0.9) });
    mesh(new T.BoxGeometry(31.2, 0.05, 0.08), edgeM, 0, -2.97, 15.6, { noCast: true });
    mesh(new T.BoxGeometry(0.08, 0.05, 31.2), edgeM, 15.6, -2.97, 0, { noCast: true });
  }

  /* ---------- main chip: substrate, GPU die with 48 tiles, CPU die with 20 tiles ---------- */
  function gb10(Y0) {
    mesh(rbox(4.6, 0.22, 4.6, 0.06), M.substrate, 0, Y0 + 0.11, 0);
    const DIE_Y = Y0 + 0.22;
    mesh(rbox(2.55, 0.12, 3.3, 0.03), M.die, 0.6, DIE_Y + 0.06, 0);
    mesh(rbox(1.25, 0.12, 3.3, 0.03), M.die, -1.5, DIE_Y + 0.06, 0);
    const tileTop = DIE_Y + 0.126;
    const smTiles = new T.InstancedMesh(new T.BoxGeometry(0.33, 0.012, 0.33), new T.MeshBasicMaterial({ color: 0xffffff }), 48);
    let idx = 0;
    for (let a = 0; a < 6; a++) for (let b = 0; b < 8; b++) {
      const o = new T.Object3D(); o.position.set(0.6 - 0.9625 + a * 0.385, tileTop, -1.365 + b * 0.39); o.updateMatrix();
      smTiles.setMatrixAt(idx, o.matrix); smTiles.setColorAt(idx, new T.Color(0.012, 0.013, 0.02)); idx++;
    }
    scene.add(smTiles);
    const cpuTiles = new T.InstancedMesh(new T.BoxGeometry(0.5, 0.012, 0.24), new T.MeshBasicMaterial({ color: 0xffffff }), 20);
    idx = 0;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 10; b++) {
      const o = new T.Object3D(); o.position.set(-1.5 - 0.27 + a * 0.54, tileTop, -1.35 + b * 0.3); o.updateMatrix();
      cpuTiles.setMatrixAt(idx, o.matrix); cpuTiles.setColorAt(idx, new T.Color(0.05, 0.06, 0.12)); idx++;
    }
    scene.add(cpuTiles);
    // tiny parts on the substrate
    const sub = [];
    for (let i = 0; i < 14; i++) { sub.push([-2.05 + i * 0.31, DIE_Y + 0.03, 2.05]); sub.push([-2.05 + i * 0.31, DIE_Y + 0.03, -2.05]); }
    scatter(new T.BoxGeometry(0.16, 0.06, 0.1), std(0xb9a27a, 0.35, 0.7), sub);
    return { DIE_Y, tileTop, smTiles, cpuTiles };
  }

  /* ---------- memory: one package per chip, 16 cells on each (1 cell = 1 GB) ---------- */
  function memory(chips, Y0) {
    chips.forEach(ch => mesh(rbox(1.5, 0.13, 1.85, 0.04), M.epoxy, ch.x, Y0 + 0.065, ch.z));
    const CELL_Y = Y0 + 0.138;
    const cells = new T.InstancedMesh(new T.BoxGeometry(0.28, 0.014, 0.35), new T.MeshBasicMaterial({ color: 0xffffff }), chips.length * 16);
    const cellPos = [];
    let idx = 0;
    chips.forEach(ch => {
      for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) {
        const o = new T.Object3D(); o.position.set(ch.x - 0.51 + a * 0.34, CELL_Y, ch.z - 0.615 + b * 0.41); o.updateMatrix();
        cells.setMatrixAt(idx, o.matrix); cells.setColorAt(idx, new T.Color(0, 0, 0)); cellPos.push(o.position.clone()); idx++;
      }
    });
    scene.add(cells);
    return { cells, cellPos, CELL_Y };
  }

  /* ---------- power delivery: lists are [x, y, z, rotationY] ---------- */
  function inductors(list, Y0) {
    scatter(rbox(0.78, 0.6, 0.78, 0.07), M.ind, list, true);
    scatter(new T.BoxGeometry(0.5, 0.02, 0.5), M.indTop, list.map(p => [p[0], Y0 + 0.605, p[2]]));
  }
  function polymerCaps(list, Y0) {
    scatter(new T.CylinderGeometry(0.27, 0.27, 0.62, 20), M.capBody, list, true);
    scatter(new T.CylinderGeometry(0.265, 0.265, 0.02, 20), M.alu, list.map(p => [p[0], Y0 + 0.63, p[2]]));
  }
  const ceramicCaps = list => scatter(new T.BoxGeometry(0.2, 0.1, 0.12), M.mlcc, list);
  const resistors = list => scatter(new T.BoxGeometry(0.16, 0.06, 0.09), M.black, list);

  /* ---------- SSD (M.2) with a label ---------- */
  function ssd(Y0) {
    const SSD_Y = Y0 + 0.36;
    mesh(new T.BoxGeometry(0.55, 0.36, 2.2), M.black, -6.35, Y0 + 0.18, 5.6);
    mesh(rbox(8, 0.1, 2.2, 0.04), M.ssd, -2.2, SSD_Y, 5.6);
    mesh(rbox(1.3, 0.12, 1.3, 0.03), M.epoxy, -4.8, SSD_Y + 0.11, 5.6);
    mesh(rbox(1.9, 0.13, 1.6, 0.03), M.epoxy, -2.5, SSD_Y + 0.115, 5.6);
    mesh(rbox(1.9, 0.13, 1.6, 0.03), M.epoxy, -0.2, SSD_Y + 0.115, 5.6);
    const sticker = new T.Mesh(new T.PlaneGeometry(4.5, 1.8), std(0xc9ccd8, 0.7, 0, {
      map: canvasTex(1024, 410, (x, w, h) => {
        x.fillStyle = '#e9ebf2'; x.fillRect(0, 0, w, h);
        x.fillStyle = '#12131c'; x.font = '700 66px "Archivo Narrow", "Arial Narrow", sans-serif'; x.fillText('4 TB NVMe SSD', 40, 110);
        x.font = '400 34px "IBM Plex Mono", monospace'; x.fillStyle = '#4a4e66'; x.fillText('M.2 2280   PCIe', 40, 170);
        x.fillText('where models wait', 40, 220);
        for (let i = 0; i < 60; i++) { x.fillStyle = '#12131c'; x.fillRect(560 + i * 7, 250, Math.random() < 0.5 ? 3 : 5, 110); }
        x.fillStyle = '#ffc93c'; x.fillRect(40, 300, 150, 12);
      }, true)
    }));
    sticker.rotation.x = -Math.PI / 2; sticker.position.set(-1.35, SSD_Y + 0.185, 5.6); sticker.receiveShadow = true; scene.add(sticker);
    mesh(new T.CylinderGeometry(0.18, 0.18, 0.12, 16), M.gold, 1.75, SSD_Y + 0.08, 5.6);
    return { SSD_Y };
  }

  /* ---------- network chip with a small heatsink ---------- */
  function nic(Y0) {
    mesh(rbox(1.9, 0.15, 1.9, 0.04), M.epoxy, 4.2, Y0 + 0.075, 5.4);
    mesh(new T.BoxGeometry(1.7, 0.1, 1.7), M.alu, 4.2, Y0 + 0.2, 5.4);
    const nicFins = []; for (let i = 0; i < 9; i++) nicFins.push([3.45 + i * 0.19, Y0 + 0.55, 5.4]);
    scatter(new T.BoxGeometry(0.06, 0.6, 1.6), M.alu, nicFins, true);
  }

  /* ---------- back ports ---------- */
  function ports(Y0) {
    [-5.0, -3.1].forEach(x => mesh(new T.BoxGeometry(1.7, 1.15, 2.4), M.alu, x, Y0 + 0.575, -6.85));
    mesh(new T.BoxGeometry(1.4, 1.2, 1.8), M.alu, -1.1, Y0 + 0.6, -7.05);
    [0.7, 1.8, 2.9, 4.0].forEach(x => mesh(rbox(0.9, 0.34, 1.3, 0.15), M.alu, x, Y0 + 0.17, -7.3));
    mesh(new T.BoxGeometry(1.5, 0.6, 1.4), M.alu, 5.6, Y0 + 0.3, -7.2);
  }

  /* ---------- cooler, lifted off (exploded view): copper plate, three heat pipes, fin stack ---------- */
  function cooler(COOL_Y) {
    mesh(rbox(4.4, 0.36, 4.4, 0.08), M.copper, 0.1, COOL_Y, 0);
    [-1.2, 0, 1.2].forEach((x, k) => {
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(x, COOL_Y + 0.25, 1.5), new T.Vector3(x, COOL_Y + 0.25, -1.4),
        new T.Vector3(x, 7.25 + 0.42 * k, -2.9), new T.Vector3(x, 7.25 + 0.42 * k, -6.5)]);
      mesh(new T.TubeGeometry(curve, 60, 0.17, 12), M.copper, 0, 0, 0);
    });
    const fins = []; for (let i = 0; i < 22; i++) fins.push([0, 7.65, -3.3 - i * 0.14]);
    scatter(new T.BoxGeometry(6.6, 2.4, 0.05), M.alu, fins, true);
  }

  /* ---------- fan on top of the fins: housing, spinning rotor (returned as .fan), glowing ring ---------- */
  function fan(FAN) {
    mesh(rbox(3.6, 0.45, 3.6, 0.12), M.dark, FAN.x, FAN.y - 0.05, FAN.z);
    const rotor = new T.Group(); rotor.position.copy(FAN).setY(FAN.y + 0.22); scene.add(rotor);
    const hub = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 0.2, 28), std(0x2a2c36, 0.4, 0.4)); hub.castShadow = true; rotor.add(hub);
    const bladeM = std(0x30323d, 0.45, 0.3);
    for (let i = 0; i < 9; i++) {
      const piv = new T.Group(); piv.rotation.y = i / 9 * Math.PI * 2; rotor.add(piv);
      const b = new T.Mesh(new T.BoxGeometry(1.1, 0.04, 0.42), bladeM); b.position.x = 1.05; b.rotation.x = 0.4; b.castShadow = true; piv.add(b);
    }
    const ringM = new T.MeshBasicMaterial({ color: new T.Color(0x27f2d2).multiplyScalar(0.5) });
    const ring = new T.Mesh(new T.TorusGeometry(1.7, 0.03, 8, 64), ringM); ring.rotation.x = Math.PI / 2; ring.position.copy(FAN).setY(FAN.y + 0.2); scene.add(ring);
    return { fan: rotor, ringM };
  }

  DSP.parts = { M, rbox, scatter, tuneEnv, stand, gb10, memory, inductors, polymerCaps, ceramicCaps, resistors, ssd, nic, ports, cooler, fan };
})(window.DSP = window.DSP || {});
