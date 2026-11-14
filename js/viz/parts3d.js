/* =====================================================================
 * viz/parts3d.js — PEÇAS 3D LOW-POLY (estilo arcade) feitas em código
 *
 *   MS.parts3d.build(look)          → THREE.Group da peça (centrada)
 *   MS.parts3d.thumb(source, id)    → URL de uma imagem 3D da peça
 *                                     (renderizada uma vez e guardada)
 *   MS.parts3d.lowPolyEarth(r, det) → Terra low-poly (usada também no 3D)
 *
 * A aparência vem de MS.looks.resolve (js/viz/looks.js), que lê os
 * dados do catálogo. Sem Three.js (sem internet), thumb() devolve '' e
 * os cartões aparecem sem imagem.
 *
 * Unidade de desenho: 1U (cubo de 10 cm) = 0,34. Frente da peça = +Z.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var THREE = root.THREE;
  var parts = MS.parts3d = { available: !!THREE };
  if (!THREE) { parts.thumb = function () { return ''; }; return; }

  var U = 0.34, DEG = Math.PI / 180;
  var V3 = THREE.Vector3;

  // ------------------------------------------------------------ Materiais
  // Criados uma vez e compartilhados por todas as peças (não descartar).
  var M = null;
  // Cores escritas em sRGB (como no CSS); o renderizador trabalha em linear.
  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function std(color, o) {
    o = Object.assign({ roughness: 0.55, metalness: 0.15, flatShading: true }, o || {});
    if (typeof o.emissive === 'number') o.emissive = lin(o.emissive);
    var mt = new THREE.MeshStandardMaterial(Object.assign(o, { color: lin(color) }));
    mt.userData.shared = true; // compartilhado: quem usa a peça não descarta
    return mt;
  }
  function basic(color, o) { var mt = new THREE.MeshBasicMaterial(Object.assign({ color: lin(color) }, o || {})); mt.userData.shared = true; return mt; }
  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }
  // Células solares: grade azul com moldura prateada.
  function cellTexture() {
    return canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#b9c0cc'; g.fillRect(0, 0, w, h);
      var n = 4, s = w / n, p = 3;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        var gr = g.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
        gr.addColorStop(0, '#1f3a8f'); gr.addColorStop(1, '#2f57c4');
        g.fillStyle = gr; g.fillRect(i * s + p, j * s + p, s - 2 * p, s - 2 * p);
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(i * s + p, j * s + s / 2, s - 2 * p, 1);
      }
    });
  }
  // Placa de circuito: verde com trilhas douradas.
  function pcbTexture() {
    return canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#1f6b3a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(230,190,90,0.85)'; g.lineWidth = 2;
      var seed = 7;
      function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      for (var k = 0; k < 22; k++) {
        var x = rnd() * w, y = rnd() * h;
        g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + (rnd() - 0.5) * 70, y); g.lineTo(x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 70);
        g.stroke();
      }
    });
  }
  function materials() {
    if (M) return M;
    var cells = cellTexture();
    cells.wrapS = cells.wrapT = THREE.RepeatWrapping;
    M = {
      whiteDouble: std(0xe8ecf2, { side: THREE.DoubleSide }),
      white: std(0xe8ecf2), offwhite: std(0xd5dae2), grey: std(0x7d8696, { metalness: 0.45, roughness: 0.45 }),
      dark: std(0x2a303c), black: std(0x121419, { roughness: 0.4 }),
      innerBlack: std(0x06070a, { side: THREE.DoubleSide, roughness: 0.9 }),
      alu: std(0xc4cad4, { metalness: 0.7, roughness: 0.32 }),
      gold: std(0xdaa63f, { metalness: 0.85, roughness: 0.28 }),
      copper: std(0xc9773b, { metalness: 0.85, roughness: 0.3 }),
      orange: std(0xff8a2b), red: std(0xd8473b), tape: std(0xe6d06a, { metalness: 0.4 }),
      glass: std(0x16306e, { metalness: 0.9, roughness: 0.06 }),
      flame: basic(0xffa83a),
      cells: new THREE.MeshStandardMaterial({ map: cells, roughness: 0.32, metalness: 0.45 }),
      pcb: new THREE.MeshStandardMaterial({ map: pcbTexture(), roughness: 0.6, metalness: 0.1 }),
      snow: std(0xf1f4f9), grass: std(0x5d9a4b), concrete: std(0xa9aeb6), leaf: std(0x3f8a45),
      ring: basic(0xffd36a)
    };
    M.cells.userData.shared = true; M.pcb.userData.shared = true;
    return M;
  }

  // ------------------------------------------------------------ Primitivas
  function mesh(geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function box(w, h, d, mat, x, y, z) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }
  // Cilindro em pé (eixo Y). seg baixo = visual low-poly.
  function cyl(rt, rb, h, mat, seg, x, y, z) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat, x, y, z); }
  // Cilindro deitado ao longo do eixo Z (lentes, bocais horizontais).
  function cylZ(r, h, mat, seg, x, y, z) {
    var m = cyl(r, r, h, mat, seg, x, y, z);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  // Painel solar com grade de células na frente (rx × ry células de 4×4).
  var cellMats = {};
  function cellsMat(rx, ry) {
    var key = rx + 'x' + ry;
    if (!cellMats[key]) {
      var base = materials().cells, t = base.map.clone();
      t.needsUpdate = true; t.repeat.set(rx, ry);
      cellMats[key] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.32, metalness: 0.45 });
      cellMats[key].userData.shared = true;
    }
    return cellMats[key];
  }
  function panel(w, h, rx, ry) {
    var m = materials();
    // faces: +x, -x, +y, -y, +z (frente: células), -z (verso)
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.025), [m.alu, m.alu, m.alu, m.alu, cellsMat(rx, ry), m.offwhite]);
  }

  // ---------------------------------------------------------------- Câmera
  // Corpo com manta térmica dourada; lente cresce com a distância focal.
  function camera(L) {
    var m = materials(), g = new THREE.Group();
    g.add(box(0.62, 0.62, 0.5, m.gold));
    g.add(box(0.5, 0.5, 0.06, m.alu, 0, 0, -0.28)); // placa de montagem
    if (L.telescope) {
      var len = 1.6, r = 0.34;
      var tube = cyl(r, r, len, m.white, 14);
      tube.rotation.x = Math.PI / 2; tube.position.z = 0.25 + len / 2; g.add(tube);
      var inner = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.93, r * 0.93, len * 0.98, 14, 1, true), m.innerBlack);
      inner.rotation.x = Math.PI / 2; inner.position.z = tube.position.z; g.add(inner);
      g.add(cylZ(r * 1.04, 0.05, m.alu, 14, 0, 0, 0.25 + len)); // anel da boca
      // Espelho secundário preso por uma "aranha" de 3 hastes.
      g.add(cylZ(0.09, 0.05, m.glass, 10, 0, 0, 0.25 + len - 0.12));
      for (var k = 0; k < 3; k++) {
        var a = k * Math.PI * 2 / 3, rod = box(0.012, r * 0.9, 0.012, m.alu);
        rod.position.set(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, 0.25 + len - 0.12);
        rod.rotation.z = a - Math.PI / 2; g.add(rod);
      }
    } else {
      var lenL = 0.3 + L.focal_mm / 110 * 0.35, rL = L.focal_mm < 80 ? 0.15 : 0.21;
      var barrel = cyl(rL * 0.92, rL, lenL, m.black, 12);
      barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.25 + lenL / 2; g.add(barrel);
      g.add(cylZ(rL * 1.08, 0.06, m.alu, 12, 0, 0, 0.25 + lenL * 0.35)); // anel de foco
      g.add(cylZ(rL * 1.05, 0.04, m.alu, 12, 0, 0, 0.25 + lenL));
      g.add(cylZ(rL * 0.82, 0.02, m.glass, 12, 0, 0, 0.27 + lenL));
      // Mais bandas de cor = mais filtros: pequenos LEDs coloridos no corpo.
      var colors = [0x3d7bff, 0x34c759, 0xff453a, 0xffd60a];
      for (var b = 0; b < Math.min(4, L.bands || 1); b++) {
        g.add(box(0.07, 0.07, 0.02, std(colors[b], { emissive: colors[b], emissiveIntensity: 0.6 }), -0.2 + b * 0.13, 0.22, 0.26));
      }
    }
    return g;
  }

  // ------------------------------------------------------------ Estrutura
  // Trilhos de alumínio do CubeSat, anéis a cada 1U e painéis pretos atrás.
  function frame(L) {
    var m = materials(), g = new THREE.Group();
    var wide = L.units >= 6 ? 2 : 1, w = wide * U, d = U, h = 3 * U, t = 0.035;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      g.add(box(t, h + 0.06, t, m.alu, c[0] * w / 2, 0, c[1] * d / 2));
      g.add(cyl(0.022, 0.022, 0.05, m.grey, 8, c[0] * w / 2, h / 2 + 0.05, c[1] * d / 2)); // pés
      g.add(cyl(0.022, 0.022, 0.05, m.grey, 8, c[0] * w / 2, -h / 2 - 0.05, c[1] * d / 2));
    });
    if (wide === 2) { g.add(box(t, h, t, m.alu, 0, 0, d / 2)); g.add(box(t, h, t, m.alu, 0, 0, -d / 2)); }
    for (var i = 0; i <= 3; i++) {
      var y = -h / 2 + i * U;
      g.add(box(w, t, t, m.alu, 0, y, d / 2)); g.add(box(w, t, t, m.alu, 0, y, -d / 2));
      g.add(box(t, t, d, m.alu, w / 2, y, 0)); g.add(box(t, t, d, m.alu, -w / 2, y, 0));
    }
    g.add(box(w - t, h - t, 0.012, m.dark, 0, 0, -d / 2 + 0.01)); // fundo
    g.add(box(0.012, h - t, d - t, m.dark, -w / 2 + 0.01, 0, 0)); // lateral
    return g;
  }

  // -------------------------------------------------------------- Energia
  // Bloco de baterias coberto de células; versão "asas" abre dois painéis.
  function solar(L) {
    var m = materials(), g = new THREE.Group();
    var w = U, h = 2 * U, d = U;
    var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      [cellsMat(1, 2), cellsMat(1, 2), m.black, m.black, cellsMat(1, 2), cellsMat(1, 2)]);
    g.add(body);
    g.add(box(w * 0.6, 0.05, d * 0.6, m.gold, 0, h / 2 + 0.025, 0)); // tampa
    if (L.wings) {
      [-1, 1].forEach(function (s) {
        var wing = new THREE.Group();
        for (var k = 0; k < 2; k++) {
          var p = panel(w * 1.0, h, 1, 2);
          p.position.set(s * (w / 2 + 0.04 + w * 0.5 + k * (w + 0.03)), 0, 0);
          wing.add(p);
        }
        wing.add(cyl(0.02, 0.02, h * 0.5, m.grey, 8, s * (w / 2 + 0.02), 0, 0)); // dobradiça
        wing.rotation.y = s * -0.18;
        g.add(wing);
      });
    }
    return g;
  }

  // ------------------------------------------------------ Controle de atitude
  // Rodas de reação (3 discos nos 3 eixos) + rastreador de estrelas,
  // ou magnetorques (bastões de cobre enrolados e uma bobina chata).
  function adcs(L) {
    var m = materials(), g = new THREE.Group();
    if (L.wheels) {
      g.add(box(0.8, 0.06, 0.8, m.alu, 0, -0.03, 0));
      var w1 = cyl(0.2, 0.2, 0.08, m.grey, 14, -0.18, 0.18, -0.15); // eixo Y
      var w2 = cyl(0.2, 0.2, 0.08, m.grey, 14, 0.2, 0.22, -0.18); w2.rotation.z = Math.PI / 2; // eixo X
      var w3 = cyl(0.2, 0.2, 0.08, m.grey, 14, 0.05, 0.22, 0.2); w3.rotation.x = Math.PI / 2; // eixo Z
      [w1, w2, w3].forEach(function (wh) {
        g.add(wh);
        var hub = cyl(0.06, 0.06, 0.1, m.black, 10); hub.position.copy(wh.position); hub.rotation.copy(wh.rotation); g.add(hub);
      });
      var tracker = new THREE.Group();
      tracker.add(box(0.16, 0.16, 0.16, m.black));
      var baffle = cyl(0.1, 0.07, 0.2, m.black, 10, 0, 0.18, 0); tracker.add(baffle);
      tracker.add(cyl(0.065, 0.065, 0.01, m.glass, 10, 0, 0.285, 0));
      tracker.position.set(-0.24, 0.1, 0.24); tracker.rotation.set(0.5, 0, -0.4);
      g.add(tracker);
    } else {
      g.add(box(0.8, 0.04, 0.6, m.pcb, 0, -0.02, 0));
      [-0.16, 0.16].forEach(function (z) {
        var rod = cyl(0.045, 0.045, 0.62, m.copper, 10, 0, 0.08, z);
        rod.rotation.z = Math.PI / 2; g.add(rod);
        [-0.33, 0.33].forEach(function (x) {
          var cap = cyl(0.05, 0.05, 0.04, m.dark, 10, x, 0.08, z);
          cap.rotation.z = Math.PI / 2; g.add(cap);
        });
      });
      var coil = mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 18), m.copper, 0.05, 0.03, 0);
      coil.rotation.x = Math.PI / 2; g.add(coil);
    }
    return g;
  }

  // ----------------------------------------------------------------- Rádio
  // UHF: fitas-antena (como fita métrica); S: antena de placa; X: pratinho.
  function radio(L) {
    var m = materials(), g = new THREE.Group();
    g.add(box(0.5, 0.1, 0.5, m.alu));
    var plug = cyl(0.025, 0.025, 0.08, m.gold, 8, 0.27, 0, 0.12); // conector
    plug.rotation.z = Math.PI / 2; g.add(plug);
    if (L.band === 'UHF') {
      for (var k = 0; k < 4; k++) {
        var a = Math.PI / 4 + k * Math.PI / 2, tape = box(0.72, 0.006, 0.035, m.tape);
        tape.position.set(Math.cos(a) * (0.25 + 0.36), 0.04, Math.sin(a) * (0.25 + 0.36));
        tape.rotation.y = -a; tape.rotation.z = -0.06;
        g.add(tape);
      }
    } else if (L.band === 'X') {
      var dish = new THREE.Mesh(parabola(0.22, 0.16, 10), m.offwhite);
      dish.position.y = 0.08; g.add(dish);
      g.add(cyl(0.012, 0.012, 0.16, m.grey, 6, 0, 0.16, 0));
    } else {
      g.add(box(0.42, 0.03, 0.42, m.offwhite, 0, 0.065, 0));
      g.add(box(0.24, 0.014, 0.24, m.gold, 0, 0.085, 0));
      g.add(box(0.05, 0.016, 0.05, m.alu, 0, 0.094, 0));
    }
    return g;
  }

  // Prato parabólico (aberto para +Y): raio R, distância focal f.
  function parabola(R, f, seg) {
    var pts = [];
    for (var i = 0; i <= 8; i++) { var x = R * i / 8; pts.push(new THREE.Vector2(x, x * x / (4 * f))); }
    var geo = new THREE.LatheGeometry(pts, seg || 14);
    return geo;
  }

  // ------------------------------------------------------------ Computador
  function computer(L) {
    var m = materials(), g = new THREE.Group();
    function board(y) {
      g.add(box(0.72, 0.035, 0.52, m.pcb, 0, y, 0));
      g.add(box(0.16, 0.03, 0.16, m.black, -0.12, y + 0.03, 0.02));
      g.add(box(0.1, 0.025, 0.08, m.black, 0.16, y + 0.028, -0.12));
      g.add(box(0.08, 0.025, 0.08, m.black, 0.18, y + 0.028, 0.12));
      g.add(box(0.5, 0.05, 0.05, m.gold, 0, y + 0.04, -0.23)); // conector
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
        g.add(cyl(0.018, 0.018, 0.2, m.alu, 6, c[0] * 0.32, y + 0.1, c[1] * 0.22));
      });
    }
    board(0);
    if (L.boards >= 2) board(0.22);
    if (L.heatsink) {
      var top = L.boards >= 2 ? 0.22 : 0;
      for (var k = 0; k < 6; k++) g.add(box(0.02, 0.12, 0.18, m.alu, -0.2 + k * 0.032, top + 0.1, 0.02));
    }
    return g;
  }

  // ------------------------------------------------------ Terra low-poly
  // Cada face pinta a cor do mapa real (MS.earth) no seu centro.
  var EARTH_COLORS = [
    [0x1f5f9e, 0x2a6fb0, 0x24689f], // oceano
    [0x3f7f35, 0x4c8f3b, 0x5a9a44], // vegetação
    [0xc19a5f, 0xcfa86a, 0xb88e55], // seco
    [0xe9eef5, 0xf4f7fb, 0xdde5ee]  // gelo
  ];
  function lowPolyEarth(r, detail) {
    var geo = new THREE.IcosahedronGeometry(r, detail == null ? 3 : detail);
    var pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    var a = new V3(), b = new V3(), c = new V3(), n = new V3(), tmp = new THREE.Color();
    for (var i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      n.copy(a).add(b).add(c).normalize();
      var lat = Math.asin(n.y) / DEG, lon = Math.atan2(-n.z, n.x) / DEG;
      var k = MS.earth ? MS.earth.classAt(lat, lon) : null;
      if (k == null) k = Math.abs(lat) > 70 ? 3 : 0;
      var shade = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1; // variação leve por face
      tmp.setHex(EARTH_COLORS[k][Math.floor(shade * 3)]).convertSRGBToLinear();
      for (var v = 0; v < 3; v++) { col[(i + v) * 3] = tmp.r; col[(i + v) * 3 + 1] = tmp.g; col[(i + v) * 3 + 2] = tmp.b; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 }));
  }

  // Mini estação espacial (treliça, painéis e módulos).
  function miniStation(s) {
    var m = materials(), g = new THREE.Group();
    g.add(box(0.5 * s, 0.03 * s, 0.03 * s, m.alu));
    [-0.21, -0.13, 0.13, 0.21].forEach(function (x) { g.add(box(0.07 * s, 0.002, 0.22 * s, cellsMat(1, 3), x * s, 0, 0)); });
    var mod = cyl(0.03 * s, 0.03 * s, 0.22 * s, m.white, 8); mod.rotation.x = Math.PI / 2; g.add(mod);
    return g;
  }

  // ---------------------------------------------------------------- Órbita
  function orbit(L) {
    var m = materials(), g = new THREE.Group(), R = 0.8;
    var earth = lowPolyEarth(R, 3);
    earth.rotation.set(-0.25, -0.5, 0); // América do Sul de frente para a câmera
    g.add(earth);
    var rr = R * (1 + L.altitude_km / 6371 * 6); // altitude exagerada 6×
    var tilt = new THREE.Group(), yaw = new THREE.Group();
    var ring = mesh(new THREE.TorusGeometry(rr, 0.022, 6, 120), L.station ? std(0xff9a3c, { emissive: 0x7a3a00 }) : m.ring);
    ring.rotation.x = Math.PI / 2;
    tilt.add(ring);
    var sat = L.station ? miniStation(0.9) : box(0.07, 0.07, 0.07, m.gold);
    var ang = 0.75;
    sat.position.set(Math.cos(ang) * rr, 0, Math.sin(ang) * rr);
    tilt.add(sat);
    tilt.rotation.z = L.inclination_deg * DEG;
    yaw.add(tilt); yaw.rotation.y = -0.6;
    g.add(yaw);
    return g;
  }

  // --------------------------------------------------------------- Foguete
  // 2 estágios brancos com faixa laranja; no topo, carenagem ou nave de
  // carga; versão "rebocador" mostra o pequeno veículo ao lado.
  function rocket(L) {
    var m = materials(), g = new THREE.Group(), r = 0.2;
    // Estágio 1: corpo, faixa laranja, motores, aletas e chama.
    var s1 = new THREE.Group();
    s1.add(cyl(r, r, 1.5, m.white, 14, 0, 0.75, 0));
    s1.add(cyl(r * 1.01, r * 1.01, 0.12, m.orange, 14, 0, 1.12, 0));
    s1.add(cyl(r * 1.01, r * 1.01, 0.05, m.black, 14, 0, 0.3, 0));
    [[0, 0], [0.09, 0.05], [-0.09, 0.05], [0, -0.1]].forEach(function (p) {
      s1.add(cyl(0.035, 0.07, 0.14, m.dark, 10, p[0], -0.07, p[1]));
    });
    for (var k = 0; k < 4; k++) {
      var fin = box(0.025, 0.34, 0.16, m.red), a = k * Math.PI / 2;
      fin.position.set(Math.cos(a) * (r + 0.07), 0.17, Math.sin(a) * (r + 0.07));
      fin.rotation.y = -a; s1.add(fin);
    }
    var flame1 = cyl(0.11, 0.0, 0.42, m.flame, 10, 0, -0.35, 0);
    s1.add(flame1);
    g.add(s1);
    // Estágio 2: inter-estágio, corpo e um motor pequeno (chama só em voo).
    var s2 = new THREE.Group();
    s2.add(cyl(r, r, 0.14, m.black, 14, 0, 1.57, 0));
    s2.add(cyl(r, r, 0.6, m.white, 14, 0, 1.94, 0));
    s2.add(cyl(0.05, 0.09, 0.12, m.dark, 10, 0, 1.58, 0));
    var flame2 = cyl(0.07, 0.0, 0.3, m.flame, 10, 0, 1.38, 0);
    flame2.visible = false;
    s2.add(flame2);
    g.add(s2);
    // Topo: nave de carga ou carenagem em duas metades (que se abrem em voo).
    var upper = new THREE.Group(), fairing = [];
    if (L.upper === 'capsule') {
      upper.add(cyl(r * 0.92, r, 0.24, m.offwhite, 14, 0, 2.36, 0));
      upper.add(cyl(r * 0.93, r * 0.93, 0.03, m.dark, 14, 0, 2.49, 0));
      upper.add(cyl(0.07, r * 0.9, 0.34, m.white, 12, 0, 2.67, 0));
      [-1, 1].forEach(function (s) { var w = panel(0.42, 0.12, 3, 1); w.position.set(s * (r + 0.24), 2.36, 0); upper.add(w); });
    } else {
      var pts = [];
      for (var i = 0; i <= 10; i++) { var t = i / 10; pts.push(new THREE.Vector2(r * 1.04 * Math.sqrt(1 - t * t * 0.98), 0.62 * t)); }
      [0, Math.PI].forEach(function (phi) {
        var half = mesh(new THREE.LatheGeometry(pts, 8, phi, Math.PI), m.white, 0, 2.24, 0);
        half.material = m.whiteDouble;
        fairing.push(half); upper.add(half);
      });
      upper.add(cyl(r * 1.05, r * 1.05, 0.02, m.black, 14, 0, 2.25, 0));
    }
    g.add(upper);
    var tug = null;
    if (L.tug) {
      tug = new THREE.Group();
      tug.add(box(0.2, 0.2, 0.2, m.gold));
      tug.add(cyl(0.04, 0.08, 0.1, m.dark, 10, 0, -0.15, 0));
      [-1, 1].forEach(function (s) { var w = panel(0.3, 0.14, 2, 1); w.position.set(s * 0.26, 0, 0); tug.add(w); });
      tug.position.set(0.62, 2.55, 0); tug.rotation.z = -0.5;
      g.add(tug);
    }
    // Para a simulação separar os estágios (js/viz/mission3d.js).
    g.userData = { s1: s1, s2: s2, upper: upper, fairing: fairing, flame1: flame1, flame2: flame2, tug: tug, height: 2.9 };
    return g;
  }

  // -------------------------------------------------------- Estação em solo
  function station(L) {
    var m = materials(), g = new THREE.Group(), s = L.dish_m / 3.7;
    g.add(cyl(1.0, 1.06, 0.1, L.snow ? m.snow : m.grass, 12, 0, -0.05, 0));
    g.add(box(0.46, 0.3, 0.34, m.white, -0.48, 0.15, 0.28));
    g.add(box(0.1, 0.18, 0.01, m.dark, -0.48, 0.09, 0.455));
    g.add(box(0.36, 0.05, 0.01, m.glass, -0.48, 0.23, 0.455));
    g.add(cyl(0.07, 0.1, 0.55 * s + 0.1, m.offwhite, 10, 0.2, (0.55 * s + 0.1) / 2, -0.15));
    var dish = new THREE.Group();
    dish.add(mesh(parabola(0.62 * s, 0.4 * s, 16), m.offwhite));
    var fy = 0.4 * s; // foco
    dish.add(cyl(0.035, 0.035, 0.08, m.grey, 8, 0, fy, 0));
    for (var k = 0; k < 3; k++) {
      var a = k * Math.PI * 2 / 3, rx = Math.cos(a) * 0.5 * s, rz = Math.sin(a) * 0.5 * s;
      var ry = (0.5 * s) * (0.5 * s) / (4 * 0.4 * s);
      var len = Math.hypot(rx, fy - ry, rz), rod = cyl(0.008, 0.008, len, m.grey, 5);
      rod.position.set(rx / 2, (fy + ry) / 2, rz / 2); // da borda do prato até o foco
      rod.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(-rx, fy - ry, -rz).normalize());
      dish.add(rod);
    }
    dish.position.set(0.2, 0.55 * s + 0.16, -0.15);
    dish.rotation.set(-0.7, 0.5, 0);
    g.add(dish);
    if (L.snow) {
      [[0.62, 0.45], [-0.15, 0.7], [0.7, -0.4]].forEach(function (p) {
        g.add(mesh(new THREE.IcosahedronGeometry(0.12, 0), m.snow, p[0], 0.02, p[1]));
      });
    } else {
      [[0.66, 0.42], [-0.62, -0.42]].forEach(function (p) {
        g.add(cyl(0.025, 0.025, 0.14, m.dark, 6, p[0], 0.07, p[1]));
        g.add(cyl(0.0, 0.13, 0.3, m.leaf, 7, p[0], 0.27, p[1]));
      });
    }
    return g;
  }

  // ------------------------------------------------- Estação Espacial (ISS)
  // Treliça comprida, 8 asas de painéis solares, radiadores, módulos
  // pressurizados ao longo do eixo Z (direção do voo) e a porta de acoplamento
  // na frente (+Z). userData.port = ponto de acoplamento (coordenadas locais).
  function iss() {
    var m = materials(), g = new THREE.Group();
    g.add(box(2.3, 0.07, 0.07, m.alu));
    [-1.1, -0.78, 0.78, 1.1].forEach(function (x) {
      [-1, 1].forEach(function (s) {
        var p = panel(0.24, 0.95, 1, 4);
        p.rotation.x = -Math.PI / 2; p.position.set(x, 0, s * 0.53);
        g.add(p);
      });
      g.add(box(0.05, 0.05, 0.12, m.grey, x, 0, 0));
    });
    [-0.38, 0.38].forEach(function (x) { g.add(box(0.2, 0.012, 0.45, m.white, x, -0.06, -0.3)); });
    function mod(len, r, x, y, z, axis, mat) {
      var c = cyl(r, r, len, mat || m.white, 10);
      if (axis === 'z') c.rotation.x = Math.PI / 2; else c.rotation.z = Math.PI / 2;
      c.position.set(x, y, z); g.add(c);
    }
    mod(1.1, 0.1, 0, -0.16, 0.05, 'z');               // módulos centrais
    mod(0.38, 0.085, 0, -0.16, 0.8, 'z', m.offwhite);  // nó da frente
    mod(0.4, 0.11, 0, -0.16, -0.7, 'z', m.offwhite);   // módulo de serviço
    mod(0.42, 0.09, 0.3, -0.16, 0.62, 'x');            // laboratório lateral (de onde saem CubeSats)
    mod(0.36, 0.09, -0.28, -0.16, 0.62, 'x');
    [-1, 1].forEach(function (s) { var w = panel(0.5, 0.14, 3, 1); w.position.set(s * 0.36, -0.16, -0.78); g.add(w); });
    var port = cyl(0.06, 0.06, 0.06, m.gold, 10); port.rotation.x = Math.PI / 2; port.position.set(0, -0.16, 1.02); g.add(port);
    g.userData.port = new THREE.Vector3(0, -0.16, 1.1);
    g.userData.airlock = new THREE.Vector3(0.52, -0.16, 0.62);
    return g;
  }

  // --------------------------------------------------------------- Montagem
  var BUILDERS = { camera: camera, frame: frame, solar: solar, adcs: adcs, radio: radio, computer: computer, orbit: orbit, rocket: rocket, station: station, iss: iss };
  function build(look) {
    var fn = look && BUILDERS[look.kind];
    if (fn) return fn(look);
    var g = new THREE.Group();
    g.add(box(0.5, 0.5, 0.5, materials().grey));
    return g;
  }

  // Pose de vitrine (3/4) para as miniaturas de cada tipo.
  var POSES = {
    camera: [0.28, -0.75, 0], frame: [0.3, 0.55, -1.15], solar: [0.32, -0.45, 0], adcs: [0.55, 0.65, 0],
    radio: [0.6, 0.6, 0], computer: [0.62, -0.5, 0], orbit: [0.12, 0, 0], rocket: [0.2, 0.3, -1.22], station: [0.35, -0.55, 0]
  };

  // ------------------------------------------------- Miniaturas dos cartões
  var W = 440, H = 230, rigObj = null, cache = {}, failed = false;
  function rig() {
    if (rigObj) return rigObj;
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0x000000, 0);
    var scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe8efff, 0x3a4357, 0.9));
    var key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(3, 4, 5); scene.add(key);
    var rim = new THREE.DirectionalLight(0x8fb4ff, 1.0); rim.position.set(-4, 2, -3); scene.add(rim);
    var camera = new THREE.PerspectiveCamera(28, W / H, 0.01, 100);
    rigObj = { renderer: renderer, scene: scene, camera: camera };
    return rigObj;
  }

  // Enquadramento justo: lê os vértices do modelo, centraliza e afasta a
  // câmera só o necessário para tudo caber (margin = fração do quadro usada).
  function fit(holder, camera, margin) {
    holder.updateMatrixWorld(true);
    var pts = [], v = new V3();
    holder.traverse(function (o) {
      if (!o.isMesh) return;
      var pa = o.geometry.attributes.position;
      for (var i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); pts.push(v.x, v.y, v.z); }
    });
    var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (var k = 0; k < pts.length; k += 3) for (var a = 0; a < 3; a++) { min[a] = Math.min(min[a], pts[k + a]); max[a] = Math.max(max[a], pts[k + a]); }
    var c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    holder.children[0].position.sub(new V3(c[0], c[1], c[2]));
    // Base da câmera (igual à que lookAt monta): Z = direção, X = up × Z, Y = Z × X.
    var Z = new V3(0, 0.28, 1).normalize(), X = new V3(0, 1, 0).cross(Z).normalize(), Y = Z.clone().cross(X);
    var tv = Math.tan(camera.fov * DEG / 2) * (margin || 0.9), th = tv * camera.aspect, dist = 0.1;
    for (var j = 0; j < pts.length; j += 3) {
      var px = pts[j] - c[0], py = pts[j + 1] - c[1], pz = pts[j + 2] - c[2];
      var dz = px * Z.x + py * Z.y + pz * Z.z;
      var dx = Math.abs(px * X.x + py * X.y + pz * X.z), dy = Math.abs(px * Y.x + py * Y.y + pz * Y.z);
      dist = Math.max(dist, dz + dx / th, dz + dy / tv);
    }
    camera.position.copy(Z.multiplyScalar(dist));
    camera.near = dist / 50; camera.far = dist * 10;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
  }

  function disposeGeometry(obj) { obj.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
  function toBlobURL(dataURL) {
    try {
      var bin = root.atob(dataURL.split(',')[1]), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([arr], { type: 'image/png' }));
    } catch (e) { return dataURL; }
  }

  // Imagem 3D de um item do catálogo (feita uma vez; depois vem do cache).
  function thumb(source, id) {
    var key = source + ':' + id;
    if (cache[key] !== undefined) return cache[key];
    if (failed) return '';
    var item = MS.data && MS.data.catalog[source] && MS.data.catalog[source][id];
    if (!item || !MS.looks) return (cache[key] = '');
    try {
      var r = rig(), look = MS.looks.resolve(source, item);
      var part = build(look), holder = new THREE.Group();
      var pose = POSES[look.kind] || [0.3, -0.5, 0];
      part.rotation.set(pose[0], pose[1], pose[2]);
      holder.add(part);
      r.scene.add(holder);
      fit(holder, r.camera, 0.86);
      r.renderer.render(r.scene, r.camera);
      cache[key] = toBlobURL(r.renderer.domElement.toDataURL('image/png'));
      r.scene.remove(holder);
      disposeGeometry(holder);
    } catch (e) {
      failed = true; // sem WebGL: cartões sem imagem, o resto funciona
      if (root.console) console.warn('Miniaturas 3D indisponíveis:', e && e.message);
      cache[key] = '';
    }
    return cache[key];
  }

  parts.U = U;
  parts.build = build;
  parts.thumb = thumb;
  parts.lowPolyEarth = lowPolyEarth;
  parts.materials = materials;
  parts.panel = panel;
  parts.miniStation = miniStation;
})(globalThis);
