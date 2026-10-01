/* =========================================================
   SHELL: the outside of a machine, and the moment it opens. Each machine starts closed under a stylized shell
   (a hood over a desktop box, a fan cover over a graphics card) with a printed spec plate. rig() lifts the shell
   away and raises the cooler from where it sits inside into the exploded view as k goes from 0 (closed) to 1 (open).
   mug() stands the same coffee mug next to every machine, at that machine's real scale.
   Generic pieces only: a machine file decides the shapes, sizes and where they sit.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.parts) return;
  const E = DSP.engine, P = DSP.parts, T = E.T, std = E.std;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ---------- outlines in the x/z plane, centred (a shape's y becomes the world's -z) ---------- */
  const rounded = r => (w, d) => P.rrShape(w, d, r);
  const chamfered = c => (w, d) => {
    const s = new T.Shape(), x = w / 2, y = d / 2;
    s.moveTo(-x + c, -y); s.lineTo(x - c, -y); s.lineTo(x, -y + c); s.lineTo(x, y - c);
    s.lineTo(x - c, y); s.lineTo(-x + c, y); s.lineTo(-x, y - c); s.lineTo(-x, -y + c); s.closePath();
    return s;
  };

  // A solid block from an outline, from y0 up to y1, with a soft bevel b round its edges. holes: [[x, z, r]] round holes
  // straight through (fan openings), relative to the block's centre. The geometry is centred on x and z.
  function block(outline, w, d, y0, y1, b, holes) {
    const s = outline(w - 2 * b, d - 2 * b);
    (holes || []).forEach(([x, z, r]) => { const h = new T.Path(); h.absarc(x, -z, r + b, 0, Math.PI * 2, true); s.holes.push(h); });
    const g = new T.ExtrudeGeometry(s, { depth: Math.max(0.01, y1 - y0 - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 28 });
    g.rotateX(-Math.PI / 2); g.translate(0, y0 + b, 0); g.computeVertexNormals();
    return g;
  }
  // A thin outline band (a trim line round a hood): outline minus the same outline inset by t, h tall.
  function band(outline, w, d, t, h) {
    const s = outline(w, d); s.holes.push(outline(w - 2 * t, d - 2 * t));
    const g = new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 28 });
    g.rotateX(-Math.PI / 2); return g;
  }

  /* ---------- a printed spec plate: name, memory, bandwidth, in the screenprint inks.
     o: { w, h, face: 'top' | 'front', at: [x, y, z], rotY }. Returns { group, print(spec) }; spec = { name, mem, bw }.
     Canvas text uses whatever font has loaded; the mission prints again once the web fonts are in. ---------- */
  const INK = '#1b1712', PAPER = '#efe5cf', SOFT = '#5a5144', RED = '#df3a2c', YEL = '#f2c230';
  const DISPLAY = '"Anton","Oswald","Impact","Arial Narrow",sans-serif', MONO = '"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace';
  function seeded(n) { let s = n >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function paper(x, w, h, seed) {
    const rnd = seeded(seed || 11);
    x.fillStyle = PAPER; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 90; i++) { x.fillStyle = 'rgba(27,23,18,' + (rnd() * 0.07).toFixed(3) + ')'; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
  }
  function halftone(x, cx, cy, R, color, step) {
    x.fillStyle = color;
    for (let yy = cy - R; yy < cy + R; yy += step) for (let xx = cx - R; xx < cx + R; xx += step) {
      const d = Math.hypot(xx - cx, yy - cy) / R; if (d >= 1) continue;
      x.beginPath(); x.arc(xx, yy, step * 0.42 * (1 - d), 0, 7); x.fill();
    }
  }
  function fitFont(x, text, family, weight, size, maxW) {
    let s = size; x.font = weight + ' ' + s + 'px ' + family;
    while (s > 8 && x.measureText(text).width > maxW) { s -= 2; x.font = weight + ' ' + s + 'px ' + family; }
    return s;
  }
  function plate(o) {
    const PXU = 120, cw = Math.round(o.w * PXU), ch = Math.round(o.h * PXU);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const map = new T.CanvasTexture(cv); map.encoding = T.sRGBEncoding; map.anisotropy = Math.min(8, E.renderer.capabilities.getMaxAnisotropy());
    const g = new T.Group(); g.position.set(...o.at); g.rotation.y = o.rotY || 0; E.add(g);
    const back = new T.Mesh(new T.BoxGeometry(o.w + 0.1, o.h + 0.1, 0.05), std(0x1b1712, 0.6, 0.1));
    const face = new T.Mesh(new T.PlaneGeometry(o.w, o.h), new T.MeshStandardMaterial({ map, color: 0x9a968e, roughness: 0.85, metalness: 0, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.06 }));
    face.material.userData.envTuned = true; face.material.envMapIntensity = 0.2;
    face.position.z = 0.03; back.castShadow = true; back.receiveShadow = face.receiveShadow = true;
    const holder = new T.Group(); holder.add(back, face); g.add(holder);
    if (o.face === 'top') holder.rotation.x = -Math.PI / 2;
    function print(spec) {
      const x = cv.getContext('2d'), w = cw, h = ch, m = Math.min(w, h) * 0.07;
      paper(x, w, h, 5);
      halftone(x, w - m * 0.5, m * 0.5, Math.min(w, h) * 0.42, 'rgba(242,194,48,.9)', Math.max(7, Math.min(w, h) * 0.05));
      x.strokeStyle = INK; x.lineWidth = Math.max(4, m * 0.28); x.strokeRect(m * 0.6, m * 0.6, w - m * 1.2, h - m * 1.2);
      x.lineWidth = Math.max(1.5, m * 0.08); x.strokeRect(m * 1.05, m * 1.05, w - m * 2.1, h - m * 2.1);
      const L = m * 1.7, R = w - m * 1.7, inner = R - L;
      const portrait = h > w * 1.05;
      x.textBaseline = 'alphabetic'; x.fillStyle = INK;
      const nameSize = fitFont(x, spec.name.toUpperCase(), DISPLAY, '400', Math.round(h * (portrait ? 0.2 : 0.34)), inner);
      const ny = m * 1.6 + nameSize * 0.92;
      x.fillText(spec.name.toUpperCase(), L, ny);
      x.fillStyle = RED; x.fillRect(L, ny + nameSize * 0.14, inner, Math.max(3, nameSize * 0.09));
      const rows = [['MEMORY', spec.mem], ['BANDWIDTH', spec.bw]];
      const rowsTop = ny + nameSize * 0.34, rowH = (h - m * 1.7 - rowsTop) / rows.length;
      rows.forEach(([k, v], i) => {
        const base = rowsTop + rowH * (i + 0.72);
        if (portrait) {
          const ls = fitFont(x, k, MONO, '500', Math.round(rowH * 0.26), inner); x.fillStyle = SOFT; x.fillText(k, L, base - rowH * 0.36);
          fitFont(x, v, MONO, '500', Math.round(rowH * 0.44), inner); x.fillStyle = INK; x.fillText(v, L, base + ls * 0.3);
        } else {
          fitFont(x, k, MONO, '500', Math.round(rowH * 0.42), inner * 0.5); x.fillStyle = SOFT; x.fillText(k, L, base);
          fitFont(x, v, MONO, '500', Math.round(rowH * 0.56), inner * 0.5); x.fillStyle = INK; x.textAlign = 'right'; x.fillText(v, R, base); x.textAlign = 'left';
        }
        if (i < rows.length - 1) { x.fillStyle = 'rgba(27,23,18,.35)'; x.fillRect(L, rowsTop + rowH * (i + 1) - 2, inner, 2); }
      });
      map.needsUpdate = true;
    }
    return { group: g, print };
  }

  /* ---------- the same coffee mug next to every machine: 82 mm across, 95 mm tall, cream glaze with a red band.
     k is the machine's scale in scene units per mm, so the mug shows how big the machine really is. ---------- */
  function mug(k, x, z, rotY) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotY || 0; E.add(g);
    const prof = [[0, 0], [35, 0], [39.5, 1.2], [41, 5], [41, 91.5], [40.4, 95], [37.8, 95], [37, 92.5], [37, 8], [0, 8]].map(([r, y]) => new T.Vector2(r * k, y * k));
    const glaze = new T.MeshPhysicalMaterial({ color: 0x8a8272, roughness: 0.3, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 0.5 });
    glaze.userData.envTuned = true;
    const add = (geo, mat, px, py, pz) => { const m = new T.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    add(new T.LatheGeometry(prof, 64), glaze, 0, 0, 0);
    const red = new T.MeshPhysicalMaterial({ color: 0x9c2620, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12 });
    add(new T.CylinderGeometry(41.12 * k, 41.12 * k, 11 * k, 64, 1, true), red, 0, 72 * k, 0);
    add(new T.CylinderGeometry(41.12 * k, 41.12 * k, 2.2 * k, 64, 1, true), red, 0, 63.5 * k, 0);
    const coffee = add(new T.CircleGeometry(37 * k, 48), new T.MeshStandardMaterial({ color: 0x2a140a, roughness: 0.15, metalness: 0 }), 0, 83 * k, 0);
    coffee.rotation.x = -Math.PI / 2; coffee.castShadow = false;
    const handle = add(new T.TorusGeometry(22 * k, 5.6 * k, 16, 40, Math.PI * 1.25), glaze, 49.4 * k, 52 * k, 0);
    handle.rotation.z = -Math.PI * 0.625;
    return g;
  }

  /* ---------- rig(o): the shell comes off and the cooler rises, driven by k (0 closed, 1 open).
     o: { lid: Group, parts: [{ g: Group, seat: [dx, dy, dz], y: [from, to], z: [from, to] }], guides: material of the
     dashed exploded-view lines, glow: [lid materials], pipes(k): rebuilds anything stretched between two parts,
     park: [up, back] where the open lid hangs, relative to its seat (default [9.5, 10]) }.
     seat is where a part sits when the machine is closed, relative to its exploded place. The lid pops, rises and
     stays hanging high above the machine, tipped back, like a part in an exploded view: the top of the frame shows
     its underside, and dragging it back down closes the machine. The cooler rises under it from k = 0.3. ---------- */
  function rig(o) {
    const base = o.parts.map(p => p.g.position.clone()), lid0 = o.lid.position.clone();
    const park = o.park || [9.5, 10];
    let k = -1, glowK = 0, awayK = 0;
    o.glow.forEach(m => { m.emissive = m.emissive || new T.Color(0x000000); });
    // the hanging lid's place; away (0-1) lifts it further, out of a close-up's view
    function placeLid() {
      const pop = smooth(0, 0.12, k), rise = smooth(0.08, 0.78, k), settle = Math.sin(smooth(0.6, 1, k) * Math.PI) * 0.04, up = smooth(0, 1, awayK) * rise;
      o.lid.position.set(lid0.x, lid0.y + 0.45 * pop + park[0] * rise + 26 * up, lid0.z - park[1] * rise - 6 * up);
      o.lid.rotation.set(-0.3 * rise - settle, 0, 0.05 * rise);
      o.lid.visible = up < 0.98;
    }
    function away(f, dt) {
      const a = awayK + (f - awayK) * Math.min(1, (dt || 0.016) * 4);
      if (Math.abs(a - awayK) < 1e-4 && a !== f) return;
      awayK = Math.abs(a - f) < 0.002 ? f : a; placeLid();
    }
    function set(v) {
      if (v === k) return;
      k = v;
      // unlatch (a small pop), then rise and tip back to where it hangs; a little sway as it settles
      placeLid();
      o.parts.forEach((p, i) => {
        const y = p.y || [0.3, 1], z = p.z || y;
        const ay = 1 - smooth(y[0], y[1], k), az = 1 - smooth(z[0], z[1], k);
        p.g.position.set(base[i].x + p.seat[0] * ay, base[i].y + p.seat[1] * ay, base[i].z + p.seat[2] * az);
      });
      if (o.guides) { o.guides.opacity = 0.55 * smooth(0.82, 1, k); o.guides.visible = k > 0.82; }
      if (o.pipes) o.pipes(k);
    }
    // hover: the lid warms up a little so it reads as something to grab
    function glow(on, dt) {
      glowK += ((on ? 1 : 0) - glowK) * Math.min(1, (dt || 0.016) * 12);
      o.glow.forEach(m => m.emissive.setRGB(0.3 * glowK, 0.22 * glowK, 0.05 * glowK));
    }
    return { set, glow, away, k: () => k };
  }

  DSP.shell = { rounded, chamfered, block, band, plate, mug, rig, smooth };
})(window.DSP = window.DSP || {});
