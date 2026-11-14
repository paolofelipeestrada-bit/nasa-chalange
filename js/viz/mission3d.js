/* =====================================================================
 * viz/mission3d.js — VISUALIZAÇÃO 3D DA MISSÃO (Three.js)
 *
 * Só mostra o que o motor já calculou: lê MS.sim.run(state) e o roteiro
 * de viz/schedule.js. Nada aqui muda o state nem os resultados.
 *
 *   MS.viz.attachAll(rootEl, state)  chamado após cada render(): liga o
 *        visual a qualquer <div data-viz="mission"> da tela (ou pausa).
 *   MS.viz.fxNames  efeitos disponíveis para o campo "fx" dos eventos.
 *
 * Escala: Terra com raio 1; altitude exagerada 3× para dar para ver;
 * tempo acelerado (uma órbita a cada ~10 s).
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, viz = MS.viz = MS.viz || {};
  var THREE = root.THREE;
  var t = MS.i18n.t, Lx = MS.i18n.L;
  viz.fxNames = MS.vizSchedule.FX;
  viz.available = !!(THREE && THREE.OrbitControls);

  if (!viz.available) {
    viz.attachAll = function (rootEl) {
      rootEl.querySelectorAll('[data-viz]').forEach(function (n) {
        n.innerHTML = '<p class="muted small" style="padding:16px">' + MS.ui.h.esc(t('viz.noThree')) + '</p>';
      });
    };
    return;
  }

  var DEG = Math.PI / 180;
  var ALT_SCALE = 3 / 6371;        // km → unidades, exagerado 3×
  var ORBIT_RATE = 2 * Math.PI / 10; // rad/s de animação
  var EARTH_RATE = 0.03;           // rad/s de animação (~17° de deriva por órbita)
  var V = null;                    // a "vista" persistente (criada uma vez)

  // ------------------------------------------------------------ Utilidades
  function latLon(lat, lon, r) {
    lat *= DEG; lon *= DEG;
    return new THREE.Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(lon));
  }
  function circleOnSphere(lat, lon, radDeg, r, n) {
    var c = latLon(lat, lon, 1), u = new THREE.Vector3(0, 1, 0).cross(c).normalize();
    if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
    var v = c.clone().cross(u), a = radDeg * DEG, pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n * Math.PI * 2;
      pts.push(c.clone().multiplyScalar(Math.cos(a))
        .add(u.clone().multiplyScalar(Math.cos(t) * Math.sin(a)))
        .add(v.clone().multiplyScalar(Math.sin(t) * Math.sin(a))).multiplyScalar(r));
    }
    return pts;
  }
  function line(points, color, opacity) {
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity == null ? 1 : opacity }));
  }
  function phong(color, extra) { return new THREE.MeshPhongMaterial(Object.assign({ color: color, shininess: 30 }, extra || {})); }
  function dispose(obj) {
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }

  // Ruído simples para gerar continentes fictícios (visual original).
  function hash(i, j) { var n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); }
  function noise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) { var s = 0, amp = 0.5, f = 1; for (var i = 0; i < 5; i++) { s += amp * noise(x * f, y * f); amp *= 0.5; f *= 2; } return s; }

  function earthTexture(aoi) {
    var w = 1024, h = 512, c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (var y = 0; y < h; y++) {
      var lat = 90 - (y + 0.5) / h * 180, cl = Math.cos(lat * DEG), sl = Math.sin(lat * DEG);
      for (var x = 0; x < w; x++) {
        var lon = (x + 0.5) / w * 360 - 180;
        var px = cl * Math.cos(lon * DEG), pz = cl * Math.sin(lon * DEG);
        var f = fbm(px * 1.7 + pz * 0.9 + 7, sl * 1.9 + pz * 1.1 + 3);
        var dAoi = aoi ? Math.hypot(lat - aoi.latitude_deg, (lon - aoi.longitude_deg) * Math.cos(lat * DEG)) : 99;
        var land = f > 0.53 || dAoi < (aoi && aoi.radius_deg || 0) * 0.9;
        var r, gg, b, i = (y * w + x) * 4;
        if (Math.abs(lat) > 74) { r = 230; gg = 238; b = 245; }
        else if (land) {
          var k = fbm(px * 6 + 1, sl * 6 + pz * 6);
          var green = dAoi < 16 ? 1 : Math.max(0, 1 - Math.abs(lat) / 50);
          r = 72 + 70 * k * (1 - green) + 6 * green; gg = 82 + 42 * k + 18 * green; b = 48 + 24 * k;
        } else { var deep = Math.min(1, (0.53 - f) * 6); r = 18 - 8 * deep; gg = 60 - 25 * deep; b = 120 - 30 * deep; }
        d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  // ---------------------------------------------------- Vista persistente
  // Criada uma vez e reaproveitada (o canvas muda de lugar a cada render).
  function createView() {
    var wrap = document.createElement('div');
    wrap.className = 'viz3d';
    wrap.innerHTML =
      '<div class="viz-hud viz-top"><div class="viz-when"></div><div class="viz-title"></div><div class="viz-text"></div></div>' +
      '<div class="viz-hud viz-flags"></div>' +
      '<div class="viz-legend"><span class="lg-aoi">' + t('viz.aoi') + '</span><span class="lg-cov">' + t('viz.cov') + '</span>' +
      '<span class="lg-con">' + t('viz.con') + '</span></div>' +
      '<div class="viz-bar">' +
      '<button type="button" class="btn small" data-viz-act="play">⏸ ' + t('viz.pause') + '</button>' +
      '<button type="button" class="btn small" data-viz-act="restart">↺ ' + t('viz.restart') + '</button>' +
      '<button type="button" class="btn small" data-viz-act="end">⏭ ' + t('viz.skipEnd') + '</button>' +
      '<button type="button" class="btn small" data-viz-act="speed">' + t('viz.speed') + ' 1×</button>' +
      '<button type="button" class="btn small" data-viz-act="cam">' + t('viz.cam.auto') + '</button>' +
      '<span class="viz-progress"><span></span></span></div>';

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    wrap.insertBefore(renderer.domElement, wrap.firstChild);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060c);
    var camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.005, 200);
    camera.position.set(0.6, 1.2, 3.4);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false;
    controls.minDistance = 1.15; controls.maxDistance = 9;

    scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    var sunLight = new THREE.DirectionalLight(0xffffff, 1.25);
    sunLight.position.set(6, 1.5, 3);
    scene.add(sunLight);

    // Estrelas
    var starPos = [];
    for (var i = 0; i < 1800; i++) {
      var v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(60 + Math.random() * 30);
      starPos.push(v.x, v.y, v.z);
    }
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, sizeAttenuation: true })));

    // Terra + atmosfera (a textura entra quando a missão é montada)
    var earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), phong(0xffffff, { shininess: 12 }));
    scene.add(earth);
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.03, 64, 32),
      new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.13, side: THREE.BackSide })));

    // Partículas reaproveitáveis (explosões, tempestade, reentrada)
    var N = 600, pPos = new Float32Array(N * 3), pCol = new Float32Array(N * 3);
    var pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    var particles = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.02, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
    scene.add(particles);

    V = {
      wrap: wrap, renderer: renderer, scene: scene, camera: camera, controls: controls,
      sunDir: sunLight.position.clone().normalize(), earth: earth, textureKey: null,
      particles: particles, pData: Array.from({ length: N }, function () { return { life: 0, v: new THREE.Vector3() }; }), pNext: 0,
      mission: null, key: null, t: 0, playing: true, speed: 1, camMode: 'auto', raf: null, last: 0
    };

    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('[data-viz-act]');
      if (b) onControl(b.getAttribute('data-viz-act'));
    });
    if (root.ResizeObserver) new root.ResizeObserver(resize).observe(wrap);
    return V;
  }

  function resize() {
    var w = V.wrap.clientWidth || 600, h = V.wrap.clientHeight || 400;
    V.renderer.setSize(w, h, false);
    V.camera.aspect = w / h;
    V.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------ Montar a missão
  // Tudo o que depende do projeto: órbita, satélite, estação, área, foguete.
  function buildMission(state, result) {
    if (V.mission) { V.scene.remove(V.mission.group); V.earth.remove(V.mission.onEarth); dispose(V.mission.group); dispose(V.mission.onEarth); }
    var sc = MS.data.scenarios[state.scenarioId], sel = result.selection;
    var orbit = sel.orbit, gs = sel.groundStation, struct = sel.structure, pw = sel.power, L = sel.launcher;

    if (V.textureKey !== sc.id) {
      if (V.earth.material.map) V.earth.material.map.dispose();
      V.earth.material.map = earthTexture(sc.aoi);
      V.earth.material.needsUpdate = true;
      V.textureKey = sc.id;
    }

    var group = new THREE.Group(), onEarth = new THREE.Group();
    V.scene.add(group); V.earth.add(onEarth);
    var rOrb = 1 + orbit.altitude_km * ALT_SCALE;

    // Plano da órbita: inclinação real; posição inicial sobre a base de lançamento.
    var plane = new THREE.Group();
    plane.rotation.x = orbit.inclination_deg * DEG;
    group.add(plane);
    var ring = [];
    for (var i = 0; i <= 128; i++) { var a = i / 128 * Math.PI * 2; ring.push(new THREE.Vector3(Math.cos(a) * rOrb, 0, -Math.sin(a) * rOrb)); }
    var orbitLine = line(ring, 0x8fb4ff, 0.35);
    plane.add(orbitLine);

    // Área de interesse e estação em solo (giram com a Terra)
    var aoi = sc.aoi;
    onEarth.add(line(circleOnSphere(aoi.latitude_deg, aoi.longitude_deg || 0, aoi.radius_deg || 10, 1.004, 72), 0xffd54a, 0.9));
    var aoiCenter = latLon(aoi.latitude_deg, aoi.longitude_deg || 0, 1);
    var stLocal = latLon(gs.latitude_deg, gs.longitude_deg || 0, 1.0);
    var station = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    station.position.copy(stLocal.clone().multiplyScalar(1.02));
    station.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), stLocal.clone().normalize());
    onEarth.add(station);

    // Imagens feitas: pontos acumulados na superfície
    var COV = 5000, covGeo = new THREE.BufferGeometry();
    covGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COV * 3), 3));
    covGeo.setDrawRange(0, 0);
    var coverage = new THREE.Points(covGeo, new THREE.PointsMaterial({ color: 0x5cf2a0, size: 0.014, transparent: true, opacity: 0.8, depthWrite: false }));
    onEarth.add(coverage);

    // Satélite: corpo do formato escolhido, painéis, lente para a Terra (+Z)
    var sat = new THREE.Group(), w6 = struct.formFactor === '6U';
    var bodyMat = phong(pw.id === 'eps_body' ? 0x24357a : 0xb9bcc4, { emissive: 0x000000, specular: 0x666666 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(w6 ? 0.06 : 0.03, 0.09, 0.03), bodyMat);
    sat.add(body);
    var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 16), phong(0x111111));
    lens.rotation.x = Math.PI / 2; lens.position.z = 0.017; sat.add(lens);
    var antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.05, 6), phong(0xdddddd));
    antenna.position.set(0, 0.07, 0); sat.add(antenna);
    var wings = [];
    if (pw.id !== 'eps_body') {
      [-1, 1].forEach(function (s) {
        var wing = new THREE.Group();
        var panel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.002), phong(0x2b4bb3, { emissive: 0x000000, specular: 0x8899ff }));
        panel.position.x = s * 0.05; wing.add(panel);
        wing.position.x = s * (w6 ? 0.03 : 0.015);
        wing.userData.side = s; wing.userData.panel = panel;
        sat.add(wing); wings.push(wing);
      });
    }
    sat.visible = false;
    group.add(sat);

    // Faixa imageada: cone da câmera até o chão
    var hCone = rOrb - 1;
    var coneGeo = new THREE.ConeGeometry(Math.min(0.08, (result.metrics.swath_km.value || 100) * ALT_SCALE * 0.5 + 0.01), hCone, 24, 1, true);
    coneGeo.rotateX(-Math.PI / 2); coneGeo.translate(0, 0, hCone / 2);
    var cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x5cf2a0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    cone.visible = false; sat.add(cone);

    // Linhas de contato (estação) e de comando (correção de software)
    var contact = line([new THREE.Vector3(), new THREE.Vector3()], 0x4cff7a, 0.9);
    contact.visible = false; group.add(contact);

    // Foguete
    var rocket = new THREE.Group();
    var rBody = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 16), phong(0xf2f2f2));
    var nose = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 16), phong(0xd94a3a));
    nose.position.y = 0.055;
    var flame = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.05, 12), new THREE.MeshBasicMaterial({ color: 0xffa630, transparent: true, opacity: 0.9 }));
    flame.rotation.x = Math.PI; flame.position.y = -0.065;
    rocket.add(rBody, nose, flame);
    group.add(rocket);

    // Detrito (imprevisto)
    var debris = new THREE.Mesh(new THREE.DodecahedronGeometry(0.012), phong(0x8a8a8a));
    debris.visible = false; group.add(debris);

    // Ponto de partida: a órbita começa logo acima da base (aprox.)
    var u0 = 0.3;
    var schedule = MS.vizSchedule.build(result);

    V.mission = {
      state: state, result: result, schedule: schedule, group: group, onEarth: onEarth, plane: plane,
      rOrb: rOrb, u0: u0, sat: sat, body: body, bodyMat: bodyMat, wings: wings, cone: cone,
      contact: contact, station: station, stLocal: stLocal, aoiCenter: aoiCenter, aoiRad: (aoi.radius_deg || 10) * DEG,
      coverage: coverage, covCount: 0, covMax: COV, covTimer: 0,
      rocket: rocket, flame: flame, debris: debris, exploded: false, siteName: L.site ? Lx(L.site.name) : Lx(L.name),
      minEl: (gs.minElevation_deg || 10) * DEG
    };
    sat.scale.setScalar(0.65);

    // Alinha a Terra para que a 1ª passagem depois do início das imagens
    // caia sobre a área de interesse (senão quase nunca se vê fotografando).
    var mm = V.mission, img = MS.vizSchedule.firstStarted(schedule, 'image', 1e9);
    mm.earthOffset = 0;
    if (img) {
      var best = null;
      for (var tt = img.t0 + 0.5; tt < img.t0 + 10; tt += 0.05) {
        var pp = orbitPoint(u0 + (tt - schedule.orbitStart) * ORBIT_RATE, 1).normalize();
        var lat = Math.asin(pp.y) / DEG, err = Math.abs(lat - aoi.latitude_deg);
        if (pp.dot(V.sunDir) < 0.3) err += 90; // precisa ser de dia (câmera óptica)
        if (!best || err < best.err) best = { err: err, t: tt, lon: Math.atan2(-pp.z, pp.x) };
      }
      mm.earthOffset = best.lon - (aoi.longitude_deg || 0) * DEG - (best.t - schedule.orbitStart) * EARTH_RATE;
    }
    V.earth.rotation.y = mm.earthOffset;
    V.t = 0; V.playing = true;
    if (V.camMode !== 'free') V.camMode = 'auto';
  }

  // ------------------------------------------------------------ Partículas
  function spawn(pos, hex, count, speed, dir) {
    var col = new THREE.Color(hex), P = V.particles.geometry.attributes;
    for (var i = 0; i < count; i++) {
      var k = V.pNext = (V.pNext + 1) % V.pData.length, p = V.pData[k];
      p.life = 0.6 + Math.random() * 0.9;
      p.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random()));
      if (dir) p.v.add(dir.clone().multiplyScalar(speed * 2));
      P.position.setXYZ(k, pos.x, pos.y, pos.z);
      P.color.setXYZ(k, col.r, col.g, col.b);
    }
  }
  function updateParticles(dt) {
    var P = V.particles.geometry.attributes;
    V.pData.forEach(function (p, k) {
      if (p.life <= 0) { P.position.setXYZ(k, 0, 999, 0); return; }
      p.life -= dt;
      P.position.setXYZ(k, P.position.getX(k) + p.v.x * dt, P.position.getY(k) + p.v.y * dt, P.position.getZ(k) + p.v.z * dt);
      P.color.setXYZ(k, P.color.getX(k) * 0.985, P.color.getY(k) * 0.985, P.color.getZ(k) * 0.985);
    });
    P.position.needsUpdate = true; P.color.needsUpdate = true;
  }

  // ------------------------------------------------------------- Posições
  function orbitPoint(u, r) {
    var m = V.mission;
    m.plane.updateMatrixWorld();
    return m.plane.localToWorld(new THREE.Vector3(Math.cos(u) * r, 0, -Math.sin(u) * r));
  }
  function launchPoint(s) {
    var m = V.mission, a = m.u0 - 0.5 + 0.5 * Math.pow(s, 1.4);
    var e = s * s * (3 - 2 * s);
    return orbitPoint(a, 1 + (m.rOrb - 1) * e + 0.01);
  }

  function started(fx, t) { return MS.vizSchedule.firstStarted(V.mission.schedule, fx, t); }
  function failedStep(fx, t) { var s = started(fx, t); return s && s.event.status !== 'ok' ? s : null; }

  // ------------------------------------------------------- Quadro a quadro
  function update(dt) {
    var m = V.mission, S = m.schedule, t = V.t, flags = [];
    var step = MS.vizSchedule.at(S, t), fx = step ? step.event.fx : null, st = step ? step.event.status : null;
    var local = step ? (t - step.t0) / (step.t1 - step.t0) : 1;
    var inOrbit = t >= S.orbitStart && !S.launchFailed;

    // Foguete
    if (t < S.orbitStart || S.launchFailed) {
      var s = Math.max(0, (t - 0.8) / (S.orbitStart - 0.8));
      if (S.launchFailed && s >= 0.5) {
        if (!m.exploded) { m.exploded = true; m.rocket.visible = false; spawn(launchPoint(0.5), 0xff7a1a, 260, 0.25); spawn(launchPoint(0.5), 0xffe08a, 120, 0.15); }
        flags.push(t('viz.launchFail'));
      } else {
        var p = launchPoint(s), q = launchPoint(Math.min(1, s + 0.01));
        m.rocket.visible = true;
        m.rocket.position.copy(p);
        if (q.distanceTo(p) > 1e-6) m.rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.sub(p).normalize());
        m.flame.visible = s > 0;
        m.flame.scale.set(1, 0.8 + Math.random() * 0.6, 1);
        if (s > 0 && Math.random() < 0.6) spawn(p.clone().sub(m.rocket.up.clone().applyQuaternion(m.rocket.quaternion).multiplyScalar(0.07)), 0xbbbbbb, 1, 0.02);
      }
    } else {
      m.rocket.visible = false;
    }

    // Terra gira depois do lançamento
    V.earth.rotation.y = m.earthOffset + Math.max(0, t - S.orbitStart) * EARTH_RATE;
    V.earth.updateMatrixWorld();

    // Satélite
    var u = m.u0 + Math.max(0, t - S.orbitStart) * ORBIT_RATE, r = m.rOrb;
    var reentry = fx === 'end' && st !== 'ok';
    var gone = S.duration && t >= S.duration && failedStep('end', t);
    if (reentry) r = m.rOrb - (m.rOrb - 1) * local;
    var satPos = orbitPoint(u, r);
    m.sat.visible = inOrbit && !gone;
    m.sat.position.copy(satPos);
    m.sat.lookAt(0, 0, 0);
    if (failedStep('wobble', t) || fx === 'wobble') m.sat.rotateZ(Math.sin(t * 9) * 0.25);
    if (fx === 'separation') m.wings.forEach(function (w) { w.scale.x = Math.max(0.05, local); });
    else m.wings.forEach(function (w) { w.scale.x = inOrbit ? 1 : 0.05; });

    // Cores de estado do satélite
    var emissive = 0x000000;
    var safeMode = failedStep('power', t);
    if (safeMode) { emissive = 0x000000; flags.push(t('viz.safeMode')); }
    if (fx === 'glitch' && local < 0.6 && Math.floor(t * 4) % 2 === 0) emissive = 0xaa0000;
    if (fx === 'storm' && st !== 'ok' && Math.floor(t * 3) % 2 === 0) emissive = 0x772200;
    if (reentry) { emissive = 0xff5a00; if (Math.random() < 0.8) spawn(satPos, 0xff8a2a, 3, 0.05); }
    m.bodyMat.emissive.setHex(emissive);
    m.wings.forEach(function (w) {
      w.userData.panel.material.emissive.setHex(fx === 'power' && st === 'ok' ? (Math.floor(t * 3) % 2 ? 0x223a99 : 0x000000) : emissive);
    });

    // Sombra da Terra
    var sDot = satPos.dot(V.sunDir), perp = satPos.clone().sub(V.sunDir.clone().multiplyScalar(sDot));
    if (m.sat.visible && sDot < 0 && perp.length() < 1) flags.push('Na sombra da Terra');

    // Contato com a estação
    var stWorld = V.earth.localToWorld(m.stLocal.clone());
    var n = stWorld.clone().normalize(), toSat = satPos.clone().sub(stWorld).normalize();
    var visible = toSat.dot(n) > Math.sin(m.minEl);
    var lost = failedStep('contact', t) && failedStep('contact', t).event.id === S.aborted;
    var stationDown = fx === 'stationDown' && (st !== 'ok' || local < 0.5);
    var cmd = fx === 'glitch' && st === 'ok' && local >= 0.6;
    var showLine = m.sat.visible && visible && !lost && !stationDown;
    m.contact.visible = showLine || (cmd && m.sat.visible);
    m.contact.material.color.setHex(cmd ? 0x59a8ff : 0x4cff7a);
    if (m.contact.visible) { m.contact.geometry.setFromPoints([stWorld, satPos]); }
    if (showLine) flags.push(t('viz.con'));
    if (lost) flags.push('Sem contato');
    if (stationDown) flags.push(t('viz.stationDown'));
    var red = lost || stationDown || (fx === 'contact' && st !== 'ok');
    m.station.material.color.setHex(red ? (Math.floor(t * 3) % 2 ? 0xff3b3b : 0x661111) : showLine ? 0x4cff7a : 0xffffff);

    // Imagens sobre a área de interesse
    var aoiWorld = V.earth.localToWorld(m.aoiCenter.clone()).normalize();
    var over = m.sat.visible && satPos.clone().normalize().angleTo(aoiWorld) < m.aoiRad;
    var imgStep = started('image', t), blurred = failedStep('image', t);
    var daylight = satPos.clone().normalize().dot(V.sunDir) > 0.05; // câmera óptica só fotografa de dia
    var imaging = over && imgStep && !safeMode && daylight;
    m.cone.visible = !!imaging;
    if (imaging) {
      m.cone.material.color.setHex(blurred ? 0xff4a4a : 0x5cf2a0);
      if (blurred) { m.cone.rotation.x = Math.sin(t * 13) * 0.2; flags.push('Imagens borradas'); }
      else {
        m.cone.rotation.x = 0;
        flags.push('Fotografando');
        m.covTimer += dt;
        var rate = failedStep('wobble', t) ? 0.08 : 0.04;
        while (m.covTimer > rate && m.covCount < m.covMax) {
          m.covTimer -= rate;
          var g = V.earth.worldToLocal(satPos.clone().normalize().multiplyScalar(1.006));
          m.coverage.geometry.attributes.position.setXYZ(m.covCount++, g.x, g.y, g.z);
          m.coverage.geometry.attributes.position.needsUpdate = true;
          m.coverage.geometry.setDrawRange(0, m.covCount);
        }
      }
    }

    // Efeitos de imprevistos
    if (fx === 'storm' && m.sat.visible) {
      var from = satPos.clone().add(V.sunDir.clone().multiplyScalar(0.5)).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.4));
      spawn(from, 0xffd84a, 3, 0.05, V.sunDir.clone().negate().multiplyScalar(0.4));
    }
    m.debris.visible = fx === 'debris' && m.sat.visible;
    if (m.debris.visible) {
      var side = satPos.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
      m.debris.position.copy(satPos).add(side.multiplyScalar(0.4 - 0.8 * local)).add(satPos.clone().normalize().multiplyScalar(0.03));
      m.debris.rotation.x += dt * 4; m.debris.rotation.y += dt * 3;
    }
    if (failedStep('delay', t)) flags.push(t('viz.delayed'));

    updateParticles(dt);
    updateCamera(satPos, dt);
    updateHud(step, flags);
  }

  // ---------------------------------------------------------------- Câmera
  function camText(mode) { return t('viz.cam.' + mode); }
  function updateCamera(satPos, dt) {
    var m = V.mission, S = m.schedule, cam = V.camera, k = 1 - Math.exp(-dt * 2.5);
    V.controls.enabled = V.camMode === 'free';
    if (V.camMode === 'free') { V.controls.update(); return; }
    var target, want;
    var launching = V.t < S.orbitStart + (S.launchFailed ? 3 : 0);
    var focus = launching ? (m.rocket.visible ? m.rocket.position.clone() : launchPoint(0.5)) : satPos.clone();
    var up = focus.clone().normalize();
    var side = up.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    var sepEnd = S.steps[1] ? S.steps[1].t1 : S.orbitStart;
    if (V.camMode === 'follow' || launching || V.t < sepEnd) {
      target = focus;
      want = focus.clone().add(up.multiplyScalar(0.12)).add(side.multiplyScalar(0.28));
    } else {
      target = new THREE.Vector3(0, 0, 0);
      want = up.multiplyScalar(2.9).add(side.multiplyScalar(1.2)).add(new THREE.Vector3(0, 0.6, 0));
    }
    cam.position.lerp(want, k);
    V.controls.target.lerp(target, k);
    cam.lookAt(V.controls.target);
  }

  // ------------------------------------------------------------------- HUD
  var STATUS_COLOR = { ok: '#4cc26f', warn: '#e3b341', fail: '#ff6b6b' };
  function updateHud(step, flags) {
    var m = V.mission, S = m.schedule, hud = V.wrap;
    var key = step ? step.event.id : (V.t >= S.duration ? 'end' : 'pre');
    if (key !== V.hudKey) {
      V.hudKey = key;
      var when = hud.querySelector('.viz-when'), title = hud.querySelector('.viz-title'), text = hud.querySelector('.viz-text');
      if (step) {
        var e = step.event;
        when.textContent = (e.random ? t('viz.random') + ' · ' : '') + e.when + (e.fx === 'launch' ? ' · ' + m.siteName : '');
        title.textContent = e.title;
        title.style.color = STATUS_COLOR[e.status] || '';
        text.textContent = e.text;
      } else if (V.t >= S.duration) {
        var o = m.result.mission.outcome;
        when.textContent = t('viz.end');
        title.textContent = m.result.mission.aborted ? t('viz.lost') : t('viz.done');
        title.style.color = STATUS_COLOR[m.result.mission.status] || '';
        text.textContent = o ? o.explanation : '';
      }
    }
    var fl = flags.join('|');
    if (fl !== V.flagKey) {
      V.flagKey = fl;
      hud.querySelector('.viz-flags').innerHTML = flags.map(function (f) { return '<span>' + MS.ui.h.esc(f) + '</span>'; }).join('');
    }
    hud.querySelector('.viz-progress span').style.width = Math.min(100, V.t / S.duration * 100) + '%';
  }

  // -------------------------------------------------------------- Controles
  function onControl(act) {
    var bar = V.wrap;
    if (act === 'play') V.playing = !V.playing;
    if (act === 'restart') { buildMission(V.mission.state, V.mission.result); V.hudKey = null; }
    if (act === 'end') { V.t = V.mission.schedule.duration; V.playing = true; }
    if (act === 'speed') V.speed = V.speed >= 4 ? 1 : V.speed * 2;
    if (act === 'cam') { V.camMode = V.camMode === 'auto' ? 'follow' : V.camMode === 'follow' ? 'free' : 'auto'; }
    bar.querySelector('[data-viz-act="play"]').textContent = V.playing ? '⏸ ' + t('viz.pause') : '▶ ' + t('viz.play');
    bar.querySelector('[data-viz-act="speed"]').textContent = t('viz.speed') + ' ' + V.speed + '×';
    bar.querySelector('[data-viz-act="cam"]').textContent = camText(V.camMode);
  }

  function frame(now) {
    V.raf = root.requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - (V.last || now)) / 1000);
    V.last = now;
    if (!V.mission) return;
    var S = V.mission.schedule;
    if (V.playing) {
      V.t += dt * V.speed;
      if (S.launchFailed) V.t = Math.min(V.t, S.orbitStart + 3);
    }
    update(V.playing ? dt * V.speed : 0);
    V.renderer.render(V.scene, V.camera);
  }

  // -------------------------------------------------------- Ligar às telas
  viz.attachAll = function (rootEl, state) {
    var host = rootEl.querySelector('[data-viz="mission"]');
    if (!host) {
      if (V && V.raf) { root.cancelAnimationFrame(V.raf); V.raf = null; }
      if (V && V.wrap.parentNode) V.wrap.parentNode.removeChild(V.wrap);
      return;
    }
    var result = MS.sim.run(state);
    if (!result.complete) { host.innerHTML = '<p class="muted small" style="padding:16px">' + MS.ui.h.esc(t('viz.complete')) + '</p>'; return; }
    if (!V) {
      try { createView(); }
      catch (e) {
        host.innerHTML = '<p class="muted small" style="padding:16px">' + MS.ui.h.esc(t('viz.noWebgl')) + '</p>';
        V = null; return;
      }
      V.renderer.domElement.addEventListener('pointerdown', function () {
        if (V.camMode !== 'free') { V.camMode = 'free'; onControl('none'); }
      });
    }
    host.appendChild(V.wrap);
    resize();
    if (V.lang !== MS.i18n.lang) {
      // Idioma trocado: refaz os rótulos fixos da vista (legenda e botões).
      V.lang = MS.i18n.lang;
      var lg = V.wrap.querySelector('.viz-legend');
      if (lg) lg.innerHTML = '<span class="lg-aoi">' + t('viz.aoi') + '</span><span class="lg-cov">' + t('viz.cov') + '</span><span class="lg-con">' + t('viz.con') + '</span>';
      var rs = V.wrap.querySelector('[data-viz-act="restart"]'), en = V.wrap.querySelector('[data-viz-act="end"]');
      if (rs) rs.textContent = '↺ ' + t('viz.restart');
      if (en) en.textContent = '⏭ ' + t('viz.skipEnd');
      V.hudKey = null; V.flagKey = null;
      onControl('none');
    }
    var key = JSON.stringify([state.scenarioId, state.design, state.seed, state.attempt, MS.i18n.lang]);
    if (key !== V.key) { V.key = key; V.hudKey = null; V.flagKey = null; buildMission(state, result); onControl('none'); }
    if (!V.raf) { V.last = 0; V.raf = root.requestAnimationFrame(frame); }
  };

  viz.debug = function () { return V; };

  // Avança a animação até o instante t (segundos), quadro a quadro. Útil para
  // depurar: MS.viz.seek(40) pula para 40 s com as imagens já acumuladas.
  viz.seek = function (t) {
    if (!V || !V.mission) return null;
    var step = 1 / 30;
    if (t < V.t) { buildMission(V.mission.state, V.mission.result); V.hudKey = null; }
    while (V.t < t) { var dt = Math.min(step, t - V.t); V.t += dt; update(dt); }
    V.renderer.render(V.scene, V.camera);
    return V.t;
  };
})(globalThis);
