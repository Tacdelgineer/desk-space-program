/* =========================================================
   ROOM: a low-detail desk corner around the display stand, in the screenprint inks: the desk the stand sits on, a
   back wall with our own space-race poster (original art, no real logos), a side wall with a window on a night sky,
   a monitor showing the answer terminal and a desk lamp. Kept dark and plain so the machines stay the stars.
     place({ x0, x1, z0, z1 })  the stand's footprint; the room is laid out around it (built again if it is on)
     set(on), on()              show or hide it (R in the mission); the studio floor hides while the desk shows
     terminal(lines)            what the monitor shows: [{ text, color }] lines, redrawn only when they change
     boxes()                    the monitor and the lamp, for the camera to fit when the room is on
   Its canvases draw from their own seeded numbers, never from Math.random (the screenshots seed that one).
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.engine) return;
  const E = DSP.engine, T = E.T, std = E.std;
  const INK = '#1b1712', PAPER = '#efe5cf', RED = '#df3a2c', YEL = '#f2c230', TEAL = '#1f8783';
  const DISPLAY = '"Anton","Oswald","Impact",sans-serif', MONO = '"IBM Plex Mono",ui-monospace,Menlo,monospace';
  const seeded = n => { let s = n >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const tex = (w, h, draw, srgb) => { const t = E.canvasTex(w, h, draw, srgb !== false); return t; };

  /* ---------- the art ---------- */
  function deskTex() {
    const t = tex(1024, 1024, (x, w, h) => {
      const r = seeded(7);
      x.fillStyle = '#3b2b20'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {                              // wood grain: long wavy strokes
        const y = r() * h, a = 0.05 + r() * 0.12;
        x.strokeStyle = r() < 0.5 ? 'rgba(20,12,8,' + a + ')' : 'rgba(120,90,60,' + a * 0.6 + ')'; x.lineWidth = 1 + r() * 3;
        x.beginPath(); x.moveTo(0, y); for (let px = 0; px <= w; px += 64) x.lineTo(px, y + Math.sin(px / 140 + i) * 6); x.stroke();
      }
    });
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2, 2);
    return t;
  }
  function posterTex() {
    return tex(600, 860, (x, w, h) => {
      const r = seeded(11);
      x.fillStyle = PAPER; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { x.fillStyle = 'rgba(27,23,18,' + (r() * 0.06).toFixed(3) + ')'; x.fillRect(r() * w, r() * h, 2, 2); }
      // space: an ink field with stars
      const sky = h * 0.66;
      x.fillStyle = INK; x.fillRect(30, 30, w - 60, sky - 30);
      for (let i = 0; i < 140; i++) { x.fillStyle = r() < 0.2 ? YEL : PAPER; const s = r() < 0.1 ? 4 : 2; x.fillRect(30 + r() * (w - 60), 30 + r() * (sky - 60), s, s); }
      // the sun, printed twice a little out of register, and its halftone
      x.fillStyle = YEL; x.beginPath(); x.arc(w * 0.7 + 6, sky * 0.3 + 5, 92, 0, 7); x.fill();
      x.fillStyle = RED; x.beginPath(); x.arc(w * 0.7, sky * 0.3, 92, 0, 7); x.fill();
      x.fillStyle = YEL;
      for (let yy = sky * 0.3 - 92; yy < sky * 0.3 + 92; yy += 12) for (let xx = w * 0.7 - 92; xx < w * 0.7 + 92; xx += 12) {
        const d = Math.hypot(xx - w * 0.7, yy - sky * 0.3) / 92; if (d > 1 || d < 0.45) continue;
        x.beginPath(); x.arc(xx, yy, 4.5 * (d - 0.45), 0, 7); x.fill();
      }
      // a ringed planet low on the left
      x.fillStyle = TEAL; x.beginPath(); x.arc(w * 0.24, sky * 0.78, 58, 0, 7); x.fill();
      x.strokeStyle = PAPER; x.lineWidth = 7; x.beginPath(); x.ellipse(w * 0.24, sky * 0.78, 100, 22, -0.3, 0, 7); x.stroke();
      // the rocket: our own shape, climbing to the right, a flame of two inks
      x.save(); x.translate(w * 0.46, sky * 0.62); x.rotate(0.5);
      x.fillStyle = YEL; x.beginPath(); x.moveTo(-22, 96); x.lineTo(0, 190); x.lineTo(22, 96); x.fill();
      x.fillStyle = RED; x.beginPath(); x.moveTo(-14, 96); x.lineTo(0, 150); x.lineTo(14, 96); x.fill();
      x.fillStyle = PAPER; x.beginPath(); x.moveTo(0, -120); x.quadraticCurveTo(42, -60, 34, 96); x.lineTo(-34, 96); x.quadraticCurveTo(-42, -60, 0, -120); x.fill();
      x.fillStyle = RED; x.beginPath(); x.moveTo(0, -120); x.quadraticCurveTo(22, -95, 27, -70); x.lineTo(-27, -70); x.quadraticCurveTo(-22, -95, 0, -120); x.fill();
      [-1, 1].forEach(s => { x.beginPath(); x.moveTo(s * 32, 40); x.lineTo(s * 70, 110); x.lineTo(s * 30, 96); x.fill(); });
      x.fillStyle = INK; x.beginPath(); x.arc(0, -20, 16, 0, 7); x.fill();
      x.fillStyle = TEAL; x.beginPath(); x.arc(0, -20, 10, 0, 7); x.fill();
      x.restore();
      // the words
      x.fillStyle = INK; x.textBaseline = 'alphabetic';
      x.font = '400 92px ' + DISPLAY; x.fillText('LIFTOFF', 34, sky + 104);
      x.fillStyle = RED; x.font = '400 40px ' + DISPLAY; x.fillText('DESK SPACE PROGRAM', 36, sky + 150);
      x.fillStyle = INK; x.font = '500 20px ' + MONO; x.fillText('MISSION 01  ·  TO THE DESK AND BEYOND', 38, sky + 190);
      x.strokeStyle = INK; x.lineWidth = 6; x.strokeRect(14, 14, w - 28, h - 28);
    });
  }
  function skyTex() {
    return tex(512, 512, (x, w, h) => {
      const r = seeded(23), g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#070a1c'); g.addColorStop(1, '#1b2350');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 220; i++) { x.fillStyle = 'rgba(239,229,207,' + (0.4 + r() * 0.6).toFixed(2) + ')'; const s = r() < 0.08 ? 3 : 1.5; x.fillRect(r() * w, r() * h * 0.85, s, s); }
      x.fillStyle = PAPER; x.beginPath(); x.arc(w * 0.7, h * 0.28, 38, 0, 7); x.fill();
      x.fillStyle = '#0b0f26'; x.beginPath(); x.arc(w * 0.7 + 16, h * 0.28 - 9, 34, 0, 7); x.fill();
      // far rooftops
      x.fillStyle = '#05060f'; let px = 0; while (px < w) { const bw = 30 + r() * 60, bh = 20 + r() * 70; x.fillRect(px, h - bh, bw, bh); px += bw; }
    });
  }

  /* ---------- the monitor's screen: the answer terminal ---------- */
  const SW = 1024, SH = 576;
  let screen = null, screenKey = '';
  function drawScreen(lines) {
    const x = screen.image.getContext('2d');
    x.fillStyle = '#0d0c0a'; x.fillRect(0, 0, SW, SH);
    x.fillStyle = PAPER; x.fillRect(0, 0, SW, 46);
    x.fillStyle = INK; x.font = '500 24px ' + MONO; x.textBaseline = 'middle'; x.fillText('ANSWER', 22, 24);
    x.fillStyle = RED; x.fillText('DESK SPACE PROGRAM', SW - 290, 24);
    x.textBaseline = 'alphabetic'; x.font = '500 27px ' + MONO;
    let y = 96;
    const wrap = (text, color) => {
      x.fillStyle = color; const words = String(text).split(' '); let line = '';
      words.forEach(wd => { const t = line ? line + ' ' + wd : wd; if (x.measureText(t).width > SW - 60) { x.fillText(line, 28, y); y += 38; line = wd; } else line = t; });
      x.fillText(line, 28, y); const end = 28 + x.measureText(line).width; y += 38; return end;
    };
    let end = 28;
    (lines || []).forEach(l => { end = wrap(l.text, l.color === 'prompt' ? YEL : PAPER); });
    x.fillStyle = TEAL; x.fillRect(end + 6, y - 38 - 24, 16, 28);         // the cursor after the last word
    screen.needsUpdate = true;
  }

  /* ---------- building it round a footprint ---------- */
  let group = null, light = null, isOn = false, foot = { x0: -13, x1: 22, z0: -13, z1: 10.5 }, lamp = null, monitor = null, lastLines = null;
  let art = null;
  function build() {
    if (group) { E.scene.remove(group); group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    art = art || { desk: deskTex(), poster: posterTex(), sky: skyTex() };
    if (!screen) { const c = document.createElement('canvas'); c.width = SW; c.height = SH; screen = new T.CanvasTexture(c); screen.encoding = T.sRGBEncoding; }
    group = new T.Group(); group.visible = isOn; E.scene.add(group);
    const { x0, x1, z0, z1 } = foot, add = (geo, mat, px, py, pz, opt) => { const m = new T.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = !(opt && opt.noCast); m.receiveShadow = true; group.add(m); return m; };
    const xL = x0 - 18, xR = x1 + 34, zB = z0 - 8, zF = z1 + 26, H = 50;
    // the desk: its top is the floor the stand stands on (a hair lower, so the stand's glowing edge doesn't flicker on it)
    const deskM = std(0x5e554b, 0.78, 0.04, { map: art.desk, envMapIntensity: 0.05 }); deskM.userData.envTuned = true;
    add(new T.BoxGeometry(xR - xL, 1.6, zF - zB), deskM, (xL + xR) / 2, -3.84, (zB + zF) / 2);
    // the walls: dark, cool paper, so the warm key light doesn't turn them brown
    const wallM = std(0x14141b, 0.96, 0, { envMapIntensity: 0.04 }); wallM.userData.envTuned = true;
    add(new T.BoxGeometry(xR - xL, H, 0.6), wallM, (xL + xR) / 2, H / 2 - 3, zB - 0.3);
    add(new T.BoxGeometry(0.6, H, zF - zB), wallM, xL - 0.3, H / 2 - 3, (zB + zF) / 2);
    // the poster, on the back wall to the left of the stand
    const posterM = new T.MeshStandardMaterial({ map: art.poster, color: 0x8a857c, roughness: 0.9, emissive: 0xffffff, emissiveMap: art.poster, emissiveIntensity: 0.06, envMapIntensity: 0.1 });
    posterM.userData.envTuned = true;
    const pw = 11, ph = pw * 860 / 600;
    add(new T.PlaneGeometry(pw, ph), posterM, x0 - 2, 5 + ph / 2, zB + 0.02, { noCast: true });
    // the window, on the side wall: a night sky in a pale frame with a cross of glazing bars
    const ww = 20, wh = 15, wz = zB + 5 + ww / 2, wy = 6 + wh / 2;
    const skyM = new T.MeshBasicMaterial({ map: art.sky, color: new T.Color(0.75, 0.75, 0.8) });
    add(new T.PlaneGeometry(ww, wh), skyM, xL + 0.03, wy, wz, { noCast: true }).rotation.y = Math.PI / 2;
    const frameM = std(0x6f685d, 0.7, 0.05); frameM.userData.envTuned = true;
    [[0, wh / 2 + 0.4, ww + 1.6, 0.8], [0, -wh / 2 - 0.4, ww + 1.6, 0.8], [ww / 2 + 0.4, 0, 0.8, wh], [-ww / 2 - 0.4, 0, 0.8, wh], [0, 0, ww, 0.35], [0, 0, 0.35, wh]].forEach(([dz, dy, w, h]) => {
      add(new T.BoxGeometry(0.5, h, w), frameM, xL + 0.25, wy + dy, wz + dz, { noCast: true });
    });
    // the monitor, on the desk at the back right, turned a little towards you
    const mon = monitor = new T.Group(); mon.position.set(x1 + 3, -3, zB + 5); mon.rotation.y = -0.35; group.add(mon);
    const bodyM = std(0x15161b, 0.55, 0.3); bodyM.userData.envTuned = true;
    const madd = (geo, mat, px, py, pz) => { const m = new T.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; mon.add(m); return m; };
    madd(new T.BoxGeometry(5, 0.35, 3.4), bodyM, 0, 0.18, 0);
    madd(new T.BoxGeometry(1.1, 5, 0.7), bodyM, 0, 2.6, -0.5);
    madd(new T.BoxGeometry(16.4, 9.6, 0.8), bodyM, 0, 9.4, 0);
    const scr = new T.Mesh(new T.PlaneGeometry(15.4, 8.66), new T.MeshBasicMaterial({ map: screen, color: new T.Color(0.8, 0.8, 0.8) }));
    scr.position.set(0, 9.4, 0.41); mon.add(scr);
    // the lamp, on the desk by the poster, leaning in towards the stand
    const lg = lamp = new T.Group(); lg.position.set(x0 - 4, -3, zB + 4); lg.rotation.y = -0.6; group.add(lg);
    const lampM = std(0x7c241d, 0.45, 0.35); lampM.userData.envTuned = true;
    const ladd = (geo, mat, px, py, pz, rz) => { const m = new T.Mesh(geo, mat); m.position.set(px, py, pz); if (rz) m.rotation.z = rz; m.castShadow = true; m.receiveShadow = true; lg.add(m); return m; };
    ladd(new T.CylinderGeometry(1.8, 2.0, 0.5, 32), bodyM, 0, 0.25, 0);
    ladd(new T.CylinderGeometry(0.2, 0.2, 10, 12), lampM, 1.2, 5.3, 0, -0.24);
    ladd(new T.CylinderGeometry(0.18, 0.18, 7.5, 12), lampM, 4.9, 11.4, 0, -1.2);
    const shade = ladd(new T.ConeGeometry(1.9, 2.8, 32, 1, true), lampM, 8.6, 11.0, 0, 0.55); shade.material = lampM.clone(); shade.material.side = T.DoubleSide;
    const bulb = new T.Mesh(new T.SphereGeometry(0.62, 16, 12), new T.MeshBasicMaterial({ color: new T.Color(1.6, 1.3, 0.85) })); bulb.position.set(8.95, 10.05, 0); lg.add(bulb);
    light = new T.PointLight(0xffc98a, 1.4, 34, 2); light.position.set(9.2, 9.4, 0); lg.add(light);
    E.floor.visible = !isOn;
    if (lastLines) { screenKey = ''; terminal(lastLines); } else drawScreen([]);
  }

  function place(f) { foot = Object.assign({}, f); if (group) build(); }
  function set(on) {
    isOn = !!on;
    if (isOn && !group) build();
    if (group) group.visible = isOn;
    E.floor.visible = !isOn;
  }
  function terminal(lines) {
    lastLines = lines;
    if (!screen || !isOn) return;
    const key = JSON.stringify(lines);
    if (key === screenKey) return;
    screenKey = key; drawScreen(lines);
  }
  // the monitor and the lamp, for the camera fit (Box3s in world space)
  function boxes() {
    if (!group || !isOn) return [];
    group.updateMatrixWorld(true);
    return [new T.Box3().setFromObject(monitor), new T.Box3().setFromObject(lamp)];
  }

  DSP.room = { place, set, on: () => isOn, terminal, boxes };
})(window.DSP = window.DSP || {});
