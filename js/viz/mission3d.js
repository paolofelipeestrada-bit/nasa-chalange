/* =====================================================================
 * viz/mission3d.js — SIMULAÇÃO 3D DA MISSÃO (Three.js, estilo arcade)
 *
 * Só mostra o que o motor já calculou: lê MS.sim.run(state), o roteiro
 * de viz/schedule.js e, se houver, a missão dia a dia (result.life, com
 * o clima espacial real da NASA). Nada aqui muda o state nem os resultados.
 *
 *   MS.viz.attachAll(rootEl, state)  chamado após cada render(): liga o
 *        visual a qualquer <div data-viz="mission"> da tela (ou pausa).
 *   MS.viz.fxNames  efeitos disponíveis para o campo "fx" dos eventos.
 *   MS.viz.seek(s)  avança a animação até s segundos (para depurar).
 *
 * O que aparece: Terra low-poly com os continentes reais (mapa do
 * nasa/mission-viz), atmosfera, nuvens e Sol; foguete com separação de
 * estágios e carenagem; o satélite montado pelo jogador; órbita calculada
 * pelo propagador kepleriano (viz/orbit.js), com cor pelo estado (verde
 * estável, amarelo subindo/decaindo, vermelho risco/reentrada); painel de
 * telemetria (tempo, altitude, velocidade, estágio, combustível), tempo
 * 1×/5×/20× e tela cheia.
 *
 * Escala: Terra com raio 1; altitude exagerada 3× para dar para ver;
 * tempo acelerado (a 1×, uma órbita a cada ~16 s).
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, viz = MS.viz = MS.viz || {};
  var THREE = root.THREE, P = MS.parts3d;
  var t = MS.i18n.t, Lx = MS.i18n.L;
  viz.fxNames = MS.vizSchedule.FX;
  viz.available = !!(THREE && THREE.OrbitControls);

  if (!viz.available) {
    viz.attachAll = function (rootEl) {
      rootEl.querySelectorAll('[data-viz="mission"]').forEach(function (n) {
        n.innerHTML = '<p class="muted small" style="padding:16px">' + MS.ui.h.esc(t('viz.noThree')) + '</p>';
      });
    };
    return;
  }

  var DEG = Math.PI / 180;
  var ALT_SCALE = 3 / 6371;          // km → unidades, exagerado 3×
  var ORBIT_RATE = 2 * Math.PI / 16; // rad/s de animação a 1×
  var EARTH_RATE = 0.019;            // rad/s (~17° de deriva por órbita)
  var ROCKET_SCALE = 0.045, SAT_SCALE = 0.075;
  var SEP1 = 0.42, FAIRING = 0.58;   // frações da subida: separação do 1º estágio e da carenagem
  var STATUS_HEX = { orbit: 0x4cc26f, sub: 0xe3b341, decay: 0xe3b341, risk: 0xff6b6b, reentry: 0xff6b6b, fail: 0xff6b6b, dock: 0x5aa0ff };
  var ISS_SCALE = 0.06;
  // Frações do passo de acoplamento: deriva, transferência de Hohmann, aproximação, acoplada, CubeSat liberado.
  var DK = { hohmann: 0.12, arrive: 0.6, docked: 0.72, deploy: 0.82 };
  var V = null;                      // a "vista" persistente (criada uma vez)

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
      var ang = i / n * Math.PI * 2;
      pts.push(c.clone().multiplyScalar(Math.cos(a))
        .add(u.clone().multiplyScalar(Math.cos(ang) * Math.sin(a)))
        .add(v.clone().multiplyScalar(Math.sin(ang) * Math.sin(a))).multiplyScalar(r));
    }
    return pts;
  }
  function line(points, color, opacity) {
    var mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity == null ? 1 : opacity });
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat);
  }
  // Linha que muda a cada quadro (trajetória da subida, rastro do satélite).
  function dynLine(n, color, opacity) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setDrawRange(0, 0);
    var l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity }));
    l.frustumCulled = false; l.userData.n = n; l.userData.count = 0;
    return l;
  }
  function phong(color, extra) { return new THREE.MeshPhongMaterial(Object.assign({ color: color, shininess: 30 }, extra || {})); }
  // Descarta só o que é desta missão: os materiais das peças (parts3d) são compartilhados.
  function dispose(obj) {
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(function (m) { if (!(m.userData && m.userData.shared)) m.dispose(); });
    });
  }

  // Ruído simples (nuvens e a Terra de reserva).
  function hash(i, j) { var n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); }
  function noise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) { var s = 0, amp = 0.5, f = 1; for (var i = 0; i < 5; i++) { s += amp * noise(x * f, y * f); amp *= 0.5; f *= 2; } return s; }

  function moonMesh() {
    var geo = new THREE.IcosahedronGeometry(1.003, 5), pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    var a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), cc = new THREE.Color();
    for (var i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      n.copy(a).add(b).add(c).normalize();
      var k = fbm(n.x * 2.2 + 7, n.y * 2.4 + n.z * 1.6 + 1), cr = fbm(n.x * 9 + 3, n.y * 9 + n.z * 7);
      var g = (k > 0.56 ? 0.52 : 0.8) - (cr > 0.62 ? 0.12 : 0) + (cr < 0.3 ? 0.06 : 0); // mares escuros, terras altas claras, crateras
      cc.setRGB(g, g, g * 0.97).convertSRGBToLinear();
      for (var j = 0; j < 3; j++) { col[(i + j) * 3] = cc.r; col[(i + j) * 3 + 1] = cc.g; col[(i + j) * 3 + 2] = cc.b; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  }
  // Terra de reserva (sem js/viz/parts3d.js): esfera lisa azul.
  function plainEarth() {
    return new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), phong(0x2a6fb0, { shininess: 12 }));
  }
  // Nuvens low-poly: só os triângulos onde o ruído passa do limite.
  function clouds() {
    var src = new THREE.IcosahedronGeometry(1.018, 4), pos = src.attributes.position, keep = [];
    var a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (var i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      n.copy(a).add(b).add(c).normalize();
      if (fbm(n.x * 2.1 + n.z * 1.3 + 5, n.y * 2.4 + n.z * 0.8 + 2) > 0.63) keep.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, flatShading: true, roughness: 1, depthWrite: false }));
  }
  // Atmosfera: brilho azul na borda do planeta (efeito Fresnel).
  function atmosphere() {
    return new THREE.Mesh(new THREE.SphereGeometry(1.045, 64, 32), new THREE.ShaderMaterial({
      uniforms: { glow: { value: new THREE.Color(0x5aa8ff) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0);' +
        ' vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 glow; varying vec3 vN; varying vec3 vV; void main() {' +
        ' float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(glow, f * 0.85); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    }));
  }
  function sunSprite() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.2, 'rgba(255,240,190,0.9)');
    gr.addColorStop(0.5, 'rgba(255,200,120,0.25)'); gr.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(9, 9, 1);
    return s;
  }

  // ---------------------------------------------------- Vista persistente
  // Criada uma vez e reaproveitada (o canvas muda de lugar a cada render).
  function staticLabels() {
    return {
      legend: '<span class="lg-aoi">' + t('viz.aoi') + '</span><span class="lg-cov">' + t('viz.cov') + '</span>' +
        '<span class="lg-con">' + t('viz.con') + '</span><span class="lg-path">' + t('viz.lg.path') + '</span><span class="lg-iss">' + t('viz.lg.iss') + '</span>',
      tele: '<div class="tl-row"><span>' + t('viz.tl.met') + '</span><b data-tl="met">—</b></div>' +
        '<div class="tl-row"><span>' + t('viz.tl.alt') + '</span><b data-tl="alt">—</b></div>' +
        '<div class="tl-row"><span>' + t('viz.tl.vel') + '</span><b data-tl="vel">—</b></div>' +
        '<div class="tl-row"><span>' + t('viz.tl.stage') + '</span><b data-tl="stage">—</b></div>' +
        '<div class="tl-fuel"><span>' + t('viz.tl.fuel') + '</span><i><em data-tl="fuelbar"></em></i><b data-tl="fuel">—</b></div>' +
        '<div class="tl-status" data-tl="status">—</div>'
    };
  }
  function createView() {
    var wrap = document.createElement('div');
    wrap.className = 'viz3d';
    var lb = staticLabels();
    wrap.innerHTML =
      '<div class="viz-hud viz-top"><div class="viz-when"></div><div class="viz-title"></div><div class="viz-text"></div></div>' +
      '<div class="viz-hud viz-flags"></div>' +
      '<div class="viz-hud viz-tele">' + lb.tele + '</div>' +
      '<div class="viz-legend">' + lb.legend + '</div>' +
      '<div class="viz-bar">' +
      '<button type="button" class="btn small" data-viz-act="play"></button>' +
      '<button type="button" class="btn small" data-viz-act="restart"></button>' +
      '<button type="button" class="btn small" data-viz-act="end"></button>' +
      '<span class="viz-warp"><span class="viz-warp-label"></span>' +
      [1, 5, 20].map(function (x) { return '<button type="button" class="btn small" data-viz-act="warp" data-x="' + x + '">' + x + '×</button>'; }).join('') +
      '</span>' +
      '<button type="button" class="btn small" data-viz-act="cam"></button>' +
      '<button type="button" class="btn small" data-viz-act="full"></button>' +
      '<span class="viz-progress"><span></span></span></div>';

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    wrap.insertBefore(renderer.domElement, wrap.firstChild);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02040a);
    var camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.003, 300);
    camera.position.set(0.6, 1.2, 3.4);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false;
    controls.minDistance = 0.12; controls.maxDistance = 9;

    scene.add(new THREE.AmbientLight(0x8fa6d8, 0.28));
    var sunLight = new THREE.DirectionalLight(0xfff4e0, 1.45);
    sunLight.position.set(6, 1.5, 3);
    scene.add(sunLight);
    var sunDir = sunLight.position.clone().normalize();
    var sun = sunSprite(); sun.position.copy(sunDir.clone().multiplyScalar(60)); scene.add(sun);

    // Estrelas com brilho e cor variados.
    var starPos = [], starCol = [], col = new THREE.Color();
    for (var i = 0; i < 2600; i++) {
      var v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(80 + Math.random() * 40);
      starPos.push(v.x, v.y, v.z);
      col.setHSL(0.55 + Math.random() * 0.15, 0.3, 0.55 + Math.random() * 0.45);
      starCol.push(col.r, col.g, col.b);
    }
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    sg.setAttribute('color', new THREE.Float32BufferAttribute(starCol, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, sizeAttenuation: true })));

    // Terra low-poly com o mapa real + nuvens + atmosfera.
    var earth = P && P.lowPolyEarth ? P.lowPolyEarth(1, 5) : plainEarth();
    scene.add(earth);
    var cloud = clouds(); scene.add(cloud);
    var atmo = atmosphere(); scene.add(atmo);
    // Lua (missões 5 e 6): esfera cinza low-poly com "crateras" (ruído); filha da Terra
    // para herdar a rotação e o que fica preso no chão. Só aparece quando body = 'moon'.
    var moonSkin = moonMesh(); moonSkin.visible = false; earth.add(moonSkin);

    // Partículas reaproveitáveis (fumaça, explosões, tempestade, reentrada)
    var N = 900, pPos = new Float32Array(N * 3), pCol = new Float32Array(N * 3);
    var pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    var particles = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.012, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
    particles.frustumCulled = false;
    scene.add(particles);

    V = {
      wrap: wrap, renderer: renderer, scene: scene, camera: camera, controls: controls,
      sunDir: sunDir, earth: earth, cloud: cloud, atmo: atmo, moonSkin: moonSkin,
      particles: particles, pData: Array.from({ length: N }, function () { return { life: 0, v: new THREE.Vector3() }; }), pNext: 0,
      mission: null, key: null, t: 0, playing: true, speed: 1, camMode: 'auto', raf: null, last: 0
    };

    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('[data-viz-act]');
      if (b) onControl(b.getAttribute('data-viz-act'), b.dataset);
    });
    document.addEventListener('fullscreenchange', function () { resize(); onControl('none'); });
    document.addEventListener('webkitfullscreenchange', function () { resize(); onControl('none'); });
    if (root.ResizeObserver) new root.ResizeObserver(resize).observe(wrap);
    return V;
  }

  function resize() {
    var w = V.wrap.clientWidth || 600, h = V.wrap.clientHeight || 400;
    V.renderer.setSize(w, h, false);
    V.camera.aspect = w / h;
    V.camera.updateProjectionMatrix();
  }
  function isFull() { return (document.fullscreenElement || document.webkitFullscreenElement) === V.wrap; }

  // ------------------------------------------------------ Montar a missão
  // Tudo o que depende do projeto: órbita, satélite, estação, área, foguete.
  function buildMission(state, result) {
    if (V.mission) {
      V.scene.remove(V.mission.group); V.earth.remove(V.mission.onEarth);
      dispose(V.mission.group); dispose(V.mission.onEarth);
    }
    var sc = MS.levels ? MS.levels.scenario(state) : MS.data.scenarios[state.scenarioId], sel = result.selection;
    var orbit = sel.orbit, gs = sel.groundStation, L = sel.launcher;

    var group = new THREE.Group(), onEarth = new THREE.Group();
    V.scene.add(group); V.earth.add(onEarth);
    var lunar = sc.body === 'moon';
    if (V.earth.material) V.earth.material.visible = !lunar;
    V.moonSkin.visible = lunar; V.cloud.visible = !lunar; V.atmo.visible = !lunar;
    var rOrb = orbit.surface ? 1.012 : 1 + orbit.altitude_km * (lunar ? 3 / 1737.4 : ALT_SCALE);
    var el = MS.orbit.circular(orbit.altitude_km, orbit.inclination_deg, 0); // propagador (viz/orbit.js)

    // Órbita prevista, desenhada pelo propagador; a cor muda com o estado.
    var ring = [];
    for (var i = 0; i <= 160; i++) {
      var p = MS.orbit.position(el, i / 160 * Math.PI * 2);
      ring.push(new THREE.Vector3(p.x, p.y, p.z).multiplyScalar(rOrb / p.r));
    }
    var orbitLine = line(ring, STATUS_HEX.orbit, 0.25);
    group.add(orbitLine);
    var ascentLine = dynLine(90, STATUS_HEX.sub, 0.9); group.add(ascentLine);
    var trail = dynLine(140, STATUS_HEX.orbit, 0.7); group.add(trail);

    // Área de interesse e estação em solo (giram com a Terra)
    var aoi = sc.aoi;
    onEarth.add(line(circleOnSphere(aoi.latitude_deg, aoi.longitude_deg || 0, aoi.radius_deg || 10, 1.006, 72), 0xffd54a, 0.95));
    var aoiCenter = latLon(aoi.latitude_deg, aoi.longitude_deg || 0, 1);
    var stLocal = latLon(gs.latitude_deg, gs.longitude_deg || 0, 1.0);
    var station = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    station.position.copy(stLocal.clone().multiplyScalar(1.022));
    station.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), stLocal.clone().normalize());
    onEarth.add(station);
    if (lunar) station.visible = false;

    // Imagens feitas: pontos acumulados na superfície
    var COV = 5000, covGeo = new THREE.BufferGeometry();
    covGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COV * 3), 3));
    covGeo.setDrawRange(0, 0);
    var coverage = new THREE.Points(covGeo, new THREE.PointsMaterial({ color: 0x5cf2a0, size: 0.014, transparent: true, opacity: 0.85, depthWrite: false }));
    coverage.frustumCulled = false;
    onEarth.add(coverage);

    // Satélite: o mesmo que o jogador montou no hangar; lente para a Terra (+Z).
    var sat = new THREE.Group(), satMats = [];
    var built = MS.hangar && MS.hangar.buildSatellite ? MS.hangar.buildSatellite(state.design) : null;
    var inner = built ? built.group : new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.02, 0.34), phong(0xb9bcc4));
    inner.rotation.x = -Math.PI / 2; // câmera (−Y no hangar) passa a olhar para +Z
    inner.traverse(function (o) {
      if (!o.isMesh) return;
      var mats = [].concat(o.material).map(function (m) { var k = m.clone(); k.userData = { shared: false }; if (k.emissive) satMats.push(k); return k; });
      o.material = Array.isArray(o.material) ? mats : mats[0];
    });
    sat.add(inner);
    sat.scale.setScalar(SAT_SCALE);
    sat.visible = false;
    group.add(sat);

    // Faixa imageada: cone da câmera até o chão (fora da escala do satélite)
    var hCone = rOrb - 1;
    var coneGeo = new THREE.ConeGeometry(Math.min(0.08, (result.metrics.swath_km.value || 100) * ALT_SCALE * 0.5 + 0.01), hCone, 24, 1, true);
    coneGeo.rotateX(-Math.PI / 2); coneGeo.translate(0, 0, hCone / 2);
    var cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x5cf2a0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    cone.visible = false; group.add(cone);

    // Linhas de contato (estação) e de comando (correção de software)
    var contact = line([new THREE.Vector3(), new THREE.Vector3()], 0x4cff7a, 0.9);
    contact.visible = false; group.add(contact);

    // Foguete do lançador escolhido, com estágios separáveis (parts3d).
    var look = MS.looks.resolve('launchers', L);
    var rocket = P ? P.build(look) : new THREE.Group();
    rocket.scale.setScalar(ROCKET_SCALE);
    group.add(rocket);
    var ud = rocket.userData || {};

    // Detrito (imprevisto)
    var debris = new THREE.Mesh(new THREE.DodecahedronGeometry(0.012), phong(0x8a8a8a));
    debris.visible = false; group.add(debris);

    var u0 = 0.3;
    var schedule = MS.vizSchedule.build(result);
    var life = result.life && result.life.series && result.life.series.length ? result.life : null;

    // Estação Espacial: sempre em órbita. Numa missão de carga, fica no mesmo
    // plano da órbita escolhida, para o encontro acontecer.
    var issData = MS.data.catalog.spaceStation || { altitude_km: 418, inclination_deg: 51.64, chaseBelow_km: 40 };
    var docking = !!schedule.docking && !schedule.launchFailed;
    var issEl = MS.orbit.circular(issData.altitude_km, docking ? orbit.inclination_deg : issData.inclination_deg, docking ? 0 : 55);
    var rISS = 1 + issData.altitude_km * ALT_SCALE;
    var issRate = ORBIT_RATE * Math.pow((MS.orbit.RE + orbit.altitude_km) / (MS.orbit.RE + issData.altitude_km), 1.5);
    var issRing = [];
    for (var j = 0; j <= 120; j++) {
      var q = MS.orbit.position(issEl, j / 120 * Math.PI * 2);
      issRing.push(new THREE.Vector3(q.x, q.y, q.z).multiplyScalar(rISS / q.r));
    }
    group.add(line(issRing, 0xdfe6ff, 0.16));
    var issObj = P && P.build ? P.build({ kind: 'iss' }) : new THREE.Group();
    if (lunar) issObj.visible = false; // a ISS fica na Terra
    issObj.scale.setScalar(ISS_SCALE);
    group.add(issObj);

    // Encontro (só missões de carga): a nave chega 40 km abaixo, sobe pela
    // elipse de Hohmann e encontra a ISS no apogeu; a fase da ISS é escolhida
    // para ela estar logo à frente nesse instante.
    var dock = null, satU0 = u0, rAscent = rOrb;
    if (docking) {
      var dstep = schedule.steps.filter(function (x) { return x.event.fx === 'separation'; })[0];
      var dur = dstep.t1 - dstep.t0;
      var chaseKm = issData.altitude_km - (issData.chaseBelow_km || 40);
      var hoh = MS.orbit.hohmann(MS.orbit.RE + chaseKm, MS.orbit.RE + issData.altitude_km);
      var tB0 = dstep.t0 + DK.hohmann * dur, tArr = dstep.t0 + DK.arrive * dur, tDep = dstep.t0 + DK.deploy * dur;
      var uB0 = u0 + (tB0 - schedule.orbitStart) * ORBIT_RATE;
      dock = {
        step: dstep, dur: dur, chaseKm: chaseKm, rChase: 1 + chaseKm * ALT_SCALE, hoh: hoh, uB0: uB0, tDep: tDep,
        el: { a_km: hoh.a_km, e: hoh.e, i_deg: orbit.inclination_deg, raan_deg: 0, argp_deg: uB0 / DEG }
      };
      var issU0 = uB0 + Math.PI - 0.035 - tArr * issRate; // ISS logo atrás: a nave entra de ré na porta da frente
      satU0 = issU0 + tDep * issRate - 0.004 - (tDep - schedule.orbitStart) * ORBIT_RATE;
      rAscent = dock.rChase;
    }

    V.mission = {
      state: state, result: result, schedule: schedule, group: group, onEarth: onEarth, el: el, life: life,
      sc: sc, lunar: lunar, surface: !!orbit.surface, rOrb: rOrb, u0: u0, satU0: satU0, rAscent: rAscent, sat: sat, satMats: satMats, cone: cone,
      iss: issObj, issEl: issEl, rISS: rISS, issRate: issRate, issU0: docking ? issU0 : 1.7, dock: dock, capsule: null,
      orbitLine: orbitLine, ascentLine: ascentLine, trail: trail, trailTimer: 0,
      contact: contact, station: station, stLocal: stLocal, aoiCenter: aoiCenter, aoiRad: (aoi.radius_deg || 10) * DEG,
      coverage: coverage, covCount: 0, covMax: COV, covTimer: 0,
      rocket: rocket, stages: ud, loose: [], sep1: false, fairingOff: false, exploded: false,
      debris: debris, siteName: L.site ? Lx(L.site.name) : Lx(L.name),
      minEl: (gs.minElevation_deg || 10) * DEG, flash: null, fl: {}
    };

    // Alinha a Terra para que a 1ª passagem depois do início das imagens
    // caia sobre a área de interesse, de dia (senão quase nunca se vê fotografando).
    var mm = V.mission, img = MS.vizSchedule.firstStarted(schedule, 'image', 1e9);
    mm.earthOffset = 0;
    if (img) {
      var best = null;
      for (var tt = img.t0 + 0.5; tt < img.t0 + 17; tt += 0.05) {
        var pp = orbitPoint(satU0 + (tt - schedule.orbitStart) * ORBIT_RATE, 1).normalize();
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
    var col = new THREE.Color(hex), PA = V.particles.geometry.attributes;
    for (var i = 0; i < count; i++) {
      var k = V.pNext = (V.pNext + 1) % V.pData.length, p = V.pData[k];
      p.life = 0.6 + Math.random() * 0.9;
      p.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random()));
      if (dir) p.v.add(dir.clone().multiplyScalar(speed * 2));
      PA.position.setXYZ(k, pos.x, pos.y, pos.z);
      PA.color.setXYZ(k, col.r, col.g, col.b);
    }
  }
  function updateParticles(dt) {
    var PA = V.particles.geometry.attributes;
    V.pData.forEach(function (p, k) {
      if (p.life <= 0) { PA.position.setXYZ(k, 0, 999, 0); return; }
      p.life -= dt;
      PA.position.setXYZ(k, PA.position.getX(k) + p.v.x * dt, PA.position.getY(k) + p.v.y * dt, PA.position.getZ(k) + p.v.z * dt);
      PA.color.setXYZ(k, PA.color.getX(k) * 0.985, PA.color.getY(k) * 0.985, PA.color.getZ(k) * 0.985);
    });
    PA.position.needsUpdate = true; PA.color.needsUpdate = true;
  }

  // ------------------------------------------------------------- Posições
  // Ponto da órbita no ângulo u, no raio de cena r (propagador kepleriano).
  function orbitPoint(u, r) {
    var p = MS.orbit.position(V.mission.el, u);
    return new THREE.Vector3(p.x, p.y, p.z).multiplyScalar(r / p.r);
  }
  // Subida: sai do chão sob a órbita e faz a curva até a altitude final.
  function launchPoint(s) {
    var m = V.mission, a = m.u0 - 0.5 + 0.5 * Math.pow(s, 1.4);
    var e = s * s * (3 - 2 * s);
    return orbitPoint(a, 1 + (m.rAscent - 1) * e + 0.006);
  }
  function setLine(l, pts) {
    var pa = l.geometry.attributes.position, n = Math.min(pts.length, l.userData.n);
    for (var i = 0; i < n; i++) pa.setXYZ(i, pts[i].x, pts[i].y, pts[i].z);
    pa.needsUpdate = true; l.geometry.setDrawRange(0, n);
  }

  // Posição e atitude da ISS no instante T (módulos ao longo da direção do voo).
  function issPoint(T) {
    var m = V.mission, u = m.issU0 + T * m.issRate, p = MS.orbit.position(m.issEl, u);
    return new THREE.Vector3(p.x, p.y, p.z).multiplyScalar(m.rISS / p.r);
  }
  function orient(obj, pos, ahead) {
    var y = pos.clone().normalize(), z = ahead.clone().sub(pos).normalize();
    var x = y.clone().cross(z).normalize(); z = x.clone().cross(y).normalize();
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  // Ponto de cena de um raio em km (altitude exagerada como o resto).
  function sceneR(r_km) { return 1 + (r_km - MS.orbit.RE) * ALT_SCALE; }

  function started(fx, T) { return MS.vizSchedule.firstStarted(V.mission.schedule, fx, T); }
  function failedStep(fx, T) { var s = started(fx, T); return s && s.event.status !== 'ok' ? s : null; }
  function setSatEmissive(hex) { V.mission.satMats.forEach(function (k) { k.emissive.setHex(hex); }); }
  function flash(text, T) { V.mission.flash = { text: text, until: T + 2.5 }; }

  // Solta uma peça do foguete (estágio, carenagem) para cair sozinha.
  function loosen(obj, vel, spin, T) {
    if (!obj || !obj.parent) return;
    V.mission.group.attach(obj);
    V.mission.loose.push({ obj: obj, v: vel, spin: spin, until: T + 6 });
  }
  function updateLoose(dt, T) {
    V.mission.loose.forEach(function (l) {
      if (!l.obj.visible) return;
      var down = l.obj.position.clone().normalize().multiplyScalar(-0.01 * dt); // puxada de volta para a Terra
      l.v.add(down);
      l.obj.position.add(l.v.clone().multiplyScalar(dt));
      l.obj.rotation.x += l.spin.x * dt; l.obj.rotation.z += l.spin.z * dt;
      if (T > l.until || l.obj.position.length() < 1.0) l.obj.visible = false;
    });
  }

  // Altitude real do dia, da missão dia a dia (clima espacial da NASA).
  function lifeAltitude(life, day) {
    var s = life.series;
    if (day <= s[0].d) return s[0].h;
    for (var i = 1; i < s.length; i++) {
      if (s[i].d >= day) { var a = s[i - 1], b = s[i], f = (day - a.d) / Math.max(1, b.d - a.d); return a.h + (b.h - a.h) * f; }
    }
    return s[s.length - 1].h;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ------------------------------------------------------- Quadro a quadro
  function update(dt) {
    var m = V.mission, S = m.schedule, T = V.t, flags = [], u8 = MS.sim.util;
    var step = MS.vizSchedule.at(S, T), fx = step ? step.event.fx : null, st = step ? step.event.status : null;
    var local = step ? (T - step.t0) / (step.t1 - step.t0) : 1;
    var inOrbit = T >= S.orbitStart && !S.launchFailed;
    var ud = m.stages, s = Math.min(1, Math.max(0, (T - 1.2) / (S.orbitStart - 1.2)));
    var sepStep = S.steps.filter(function (x) { return x.event.fx === 'separation'; })[0] || null;
    var opsStart = sepStep ? sepStep.t1 : S.orbitStart;
    var lifeEnd = m.result.life && m.result.life.totals ? m.result.life.totals.end : null;
    var tele = {};

    // ---- Foguete: subida, separação do 1º estágio, carenagem, chegada à órbita
    if (T < S.orbitStart || S.launchFailed) {
      if (S.launchFailed && s >= 0.5) {
        if (!m.exploded) {
          m.exploded = true; m.rocket.visible = false;
          spawn(launchPoint(0.5), 0xff7a1a, 320, 0.25); spawn(launchPoint(0.5), 0xffe08a, 160, 0.15);
        }
        flags.push(t('viz.launchFail'));
      } else {
        var p = launchPoint(s), q = launchPoint(Math.min(1, s + 0.01)), dir = q.clone().sub(p).normalize();
        m.rocket.visible = true;
        m.rocket.position.copy(p);
        if (dir.lengthSq() > 0) m.rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        if (s >= SEP1 && !m.sep1) {
          m.sep1 = true; flash(t('viz.ev.sep1'), T);
          loosen(ud.s1, dir.clone().multiplyScalar(-0.01).add(p.clone().normalize().multiplyScalar(-0.004)), new THREE.Vector3(0.8, 0, 1.1), T);
        }
        if (s >= FAIRING && !m.fairingOff && ud.fairing && ud.fairing.length) {
          m.fairingOff = true; flash(t('viz.ev.fairing'), T);
          ud.fairing.forEach(function (half, i) {
            var side = new THREE.Vector3(1, 0, 0).applyQuaternion(m.rocket.quaternion).multiplyScalar(i ? 0.03 : -0.03);
            loosen(half, side, new THREE.Vector3(0, 0, i ? 2 : -2), T);
          });
        }
        var burning = s > 0 && s < 1;
        if (ud.flame1) { ud.flame1.visible = burning && !m.sep1; ud.flame1.scale.set(1, 0.8 + Math.random() * 0.5, 1); }
        if (ud.flame2) { ud.flame2.visible = burning && m.sep1 && s > SEP1 + 0.03; ud.flame2.scale.set(1, 0.8 + Math.random() * 0.5, 1); }
        if (burning && Math.random() < (m.sep1 ? 0.35 : 0.8)) spawn(p.clone().sub(dir.clone().multiplyScalar(0.05)), m.sep1 ? 0x9aa6c0 : 0xbbbbbb, 1, 0.012);
        // trajetória percorrida até aqui
        var pts = [];
        for (var k = 0; k < 90; k++) pts.push(launchPoint(k / 89 * s));
        setLine(m.ascentLine, pts);
      }
      m.ascentLine.material.color.setHex(S.launchFailed ? STATUS_HEX.fail : STATUS_HEX.sub);
      // telemetria da subida (perfil simplificado de um lançamento real: ~9 min até a órbita)
      var vOrb = MS.orbit.speed(m.el, m.el.a_km), met = Math.round(s * 540);
      tele.met = 'T+ ' + pad2(Math.floor(met / 60)) + ':' + pad2(met % 60);
      tele.alt = u8.withUnit(m.result.metrics.altitude_km.value * (s * s * (3 - 2 * s)), 'km', 0);
      tele.vel = u8.withUnit(0.41 + (vOrb - 0.41) * Math.pow(s, 1.6), 'km/s', 2);
      tele.stage = m.sep1 ? t('viz.stage.2') : t('viz.stage.1');
      tele.fuel = m.sep1 ? 1 - (s - SEP1) / (1 - SEP1) * 0.88 : 1 - s / SEP1;
      tele.status = S.launchFailed && m.exploded ? 'fail' : 'sub';
    } else {
      // Em órbita: o estágio gasto se afasta durante a separação e some.
      if (fx === 'separation') {
        if (local < 0.1 && !m.inserted) { m.inserted = true; flash(t('viz.ev.orbit'), T); }
        if (local > 0.35 && !m.deployed && !m.dock) { m.deployed = true; flash(t('viz.ev.deploy'), T); }
        var uB = m.u0 - 0.004 - 0.03 * local + (m.dock ? (T - S.orbitStart) * ORBIT_RATE : 0);
        m.rocket.visible = !m.dock || local < DK.hohmann * 1.5;
        m.rocket.position.copy(orbitPoint(uB, m.rAscent));
        if (ud.flame2) ud.flame2.visible = false;
      } else {
        m.rocket.visible = false;
      }
      m.ascentLine.material.color.setHex(STATUS_HEX.orbit);
      m.ascentLine.material.opacity = 0.35;
    }
    updateLoose(dt, T);

    // ---- Estação Espacial: sempre girando em volta da Terra
    var issPos = issPoint(T);
    m.iss.position.copy(issPos);
    orient(m.iss, issPos, issPoint(T + 0.05));
    m.iss.updateMatrixWorld();

    // ---- Encontro e acoplamento da nave de carga com a ISS
    var dk = m.dock, dockFocus = null;
    if (dk && T >= S.orbitStart) {
      var dl = Math.min(1, (T - dk.step.t0) / dk.dur);
      if (!m.capsule && ud.upper) {
        // Solta a nave do foguete e centraliza nela (o desenho começa na base do foguete).
        var up = ud.upper, bb = new THREE.Box3();
        up.children.forEach(function (c) { bb.expandByObject(c); });
        var ul = up.worldToLocal(bb.getCenter(new THREE.Vector3()));
        var top = up.worldToLocal(bb.max.clone()).y;
        up.children.forEach(function (c) { c.position.y -= ul.y; });
        m.group.attach(up); m.capsule = up;
        up.scale.multiplyScalar(1.6);
        m.capNose = (top - ul.y) * up.scale.y; // distância do centro até o nariz (em unidades de cena)
      }
      var cap = m.capsule, cpos, ahead, burn = false, fuel = 1;
      var portW = m.iss.localToWorld(m.iss.userData.port ? m.iss.userData.port.clone() : new THREE.Vector3());
      var dockAt = portW.clone().add(portW.clone().sub(issPos).normalize().multiplyScalar(m.capNose || 0.02)); // nariz encaixado na porta
      if (dl < DK.hohmann) {
        var ub = m.u0 + (T - S.orbitStart) * ORBIT_RATE;
        cpos = orbitPoint(ub, dk.rChase); ahead = orbitPoint(ub + 0.02, dk.rChase);
      } else if (dl < DK.arrive) {
        if (!m.fl.hohmann) { m.fl.hohmann = true; flash(t('viz.ev.hohmann'), T); }
        var f = (dl - DK.hohmann) / (DK.arrive - DK.hohmann);
        var nu = MS.orbit.trueFromMean(Math.PI * f, dk.el.e);
        var pk = MS.orbit.position(dk.el, nu), pk2 = MS.orbit.position(dk.el, nu + 0.02);
        cpos = new THREE.Vector3(pk.x, pk.y, pk.z).multiplyScalar(sceneR(pk.r) / pk.r);
        ahead = new THREE.Vector3(pk2.x, pk2.y, pk2.z).multiplyScalar(sceneR(pk2.r) / pk2.r);
        burn = f < 0.12 || f > 0.9; // os dois impulsos da manobra
        fuel = 1 - 0.18 * Math.min(1, f / 0.12) - (f > 0.9 ? 0.04 * (f - 0.9) / 0.1 : 0);
        tele.alt = MS.sim.util.withUnit(pk.r - MS.orbit.RE, 'km', 0);
        tele.vel = MS.sim.util.withUnit(MS.orbit.speed(dk.el, pk.r), 'km/s', 2);
      } else if (dl < DK.docked) {
        if (!m.fl.approach) { m.fl.approach = true; flash(t('viz.ev.approach'), T); m.arrPos = cap.position.clone(); }
        var g2 = (dl - DK.arrive) / (DK.docked - DK.arrive), e2 = g2 * g2 * (3 - 2 * g2);
        cpos = (m.arrPos || cap.position).clone().lerp(dockAt, e2);
        ahead = issPos.clone(); // nariz virado para a estação
        fuel = 0.78;
      } else {
        if (!m.fl.docked) { m.fl.docked = true; flash(t('viz.ev.docked'), T); }
        cpos = dockAt; ahead = issPos.clone();
        fuel = 0.78;
      }
      cap.position.copy(cpos);
      orient(cap, cpos, ahead);
      cap.rotateX(Math.PI / 2); // o foguete foi desenhado de pé (+Y): a ponta passa a apontar para a frente
      if (ud.flame2) ud.flame2.visible = false;
      if (burn && Math.random() < 0.7) spawn(cpos.clone().sub(ahead.clone().sub(cpos).normalize().multiplyScalar(0.02)), 0x9ec5ff, 1, 0.01);
      if (T < dk.step.t1) {
        dockFocus = T < dk.tDep ? cpos.clone() : null;
        tele.stage = t('viz.stage.cargo');
        tele.fuel = fuel;
        tele.status = 'dock';
        tele.dockText = dl < DK.docked ? 'rendezvous' : 'docked';
        var hNow = dl < DK.hohmann ? dk.chaseKm : ((MS.data.catalog.spaceStation || {}).altitude_km || 418);
        if (!tele.alt) tele.alt = MS.sim.util.withUnit(hNow, 'km', 0);
        if (!tele.vel) tele.vel = MS.sim.util.withUnit(Math.sqrt(MS.orbit.MU / (MS.orbit.RE + hNow)), 'km/s', 2);
        tele.met = 'T+ ' + Math.max(1, Math.round(dl * 30)) + ' h'; // encontro real leva cerca de um dia
      }
      if (dl >= DK.deploy && !m.fl.issDeploy) { m.fl.issDeploy = true; flash(t('viz.ev.issDeploy'), T); }
    }
    m.dockFocus = dockFocus;

    // ---- Terra e nuvens giram depois do lançamento
    V.earth.rotation.y = m.earthOffset + Math.max(0, T - S.orbitStart) * EARTH_RATE;
    V.earth.updateMatrixWorld();
    V.cloud.rotation.y = V.earth.rotation.y * 1.15 + T * 0.004;

    // ---- Satélite
    var u = m.surface ? m.satU0 : m.satU0 + Math.max(0, T - S.orbitStart) * ORBIT_RATE, r = m.rOrb, satScale = SAT_SCALE;
    if (m.dock && T < m.dock.step.t1) {
      var dg = Math.max(0, (T - m.dock.tDep) / (m.dock.step.t1 - m.dock.tDep));
      r = m.rISS + (m.rOrb - m.rISS) * dg;
      satScale = SAT_SCALE * (0.3 + 0.7 * dg);
    }
    var lifeReentry = step && step.event.id === 'LIFE' && lifeEnd === 'reentry';
    var reentry = (fx === 'end' && st !== 'ok') || lifeReentry;
    var gone = S.duration && T >= S.duration && (failedStep('end', T) || lifeEnd === 'reentry');
    if (reentry) r = m.rOrb - (m.rOrb - 1) * local;
    var satPos = orbitPoint(u, r);
    var showSat = inOrbit && !gone && (m.dock ? T >= m.dock.tDep : (!sepStep || T >= sepStep.t0 + (sepStep.t1 - sepStep.t0) * 0.35));
    m.sat.visible = showSat;
    m.sat.scale.setScalar(satScale);
    m.sat.position.copy(satPos);
    m.sat.lookAt(0, 0, 0);
    if (failedStep('wobble', T) || fx === 'wobble') m.sat.rotateZ(Math.sin(T * 9) * 0.25);

    // Cores de estado do satélite
    var emissive = 0x000000;
    var safeMode = failedStep('power', T);
    if (safeMode) flags.push(t('viz.safeMode'));
    if (fx === 'power' && st === 'ok' && Math.floor(T * 3) % 2) emissive = 0x16245c;
    if (fx === 'glitch' && local < 0.6 && Math.floor(T * 4) % 2 === 0) emissive = 0xaa0000;
    if (fx === 'storm' && st !== 'ok' && Math.floor(T * 3) % 2 === 0) emissive = 0x772200;
    if (reentry) { emissive = 0xff5a00; if (Math.random() < 0.8) spawn(satPos, 0xff8a2a, 3, 0.05); }
    setSatEmissive(emissive);

    // Sombra da Terra
    var sDot = satPos.dot(V.sunDir), perp = satPos.clone().sub(V.sunDir.clone().multiplyScalar(sDot));
    if (m.sat.visible && sDot < 0 && perp.length() < 1) flags.push(t('viz.shadow'));

    // Contato com a estação
    var stWorld = V.earth.localToWorld(m.stLocal.clone());
    var n = stWorld.clone().normalize(), toSat = satPos.clone().sub(stWorld).normalize();
    var visible = toSat.dot(n) > Math.sin(m.minEl);
    var lostStep = failedStep('contact', T), lost = !!(lostStep && lostStep.event.id === S.aborted);
    var stationDown = fx === 'stationDown' && (st !== 'ok' || local < 0.5);
    var cmd = fx === 'glitch' && st === 'ok' && local >= 0.6;
    var showLine = m.sat.visible && visible && !lost && !stationDown;
    m.contact.visible = !m.lunar && (showLine || (cmd && m.sat.visible)); // da Lua a antena fica na Terra, fora da cena
    m.contact.material.color.setHex(cmd ? 0x59a8ff : 0x4cff7a);
    if (m.contact.visible) m.contact.geometry.setFromPoints([stWorld, satPos]);
    if (showLine) flags.push(t('viz.con'));
    if (lost) flags.push(t('viz.noContact'));
    if (stationDown) flags.push(t('viz.stationDown'));
    var red = lost || stationDown || (fx === 'contact' && st !== 'ok');
    m.station.material.color.setHex(red ? (Math.floor(T * 3) % 2 ? 0xff3b3b : 0x661111) : showLine ? 0x4cff7a : 0xffffff);

    // Imagens sobre a área de interesse
    var aoiWorld = V.earth.localToWorld(m.aoiCenter.clone()).normalize();
    var over = m.sat.visible && satPos.clone().normalize().angleTo(aoiWorld) < m.aoiRad;
    var imgStep = started('image', T), blurred = failedStep('image', T);
    var daylight = satPos.clone().normalize().dot(V.sunDir) > 0.05; // câmera óptica só fotografa de dia
    var imaging = over && imgStep && !safeMode && daylight;
    m.cone.visible = !!imaging;
    if (imaging) {
      m.cone.position.copy(satPos); m.cone.lookAt(0, 0, 0);
      m.cone.material.color.setHex(blurred ? 0xff4a4a : 0x5cf2a0);
      if (blurred) { m.cone.rotateX(Math.sin(T * 13) * 0.2); flags.push(t('viz.blurred')); }
      else {
        flags.push(t('viz.imaging'));
        m.covTimer += dt;
        var rate = failedStep('wobble', T) ? 0.08 : 0.04;
        while (m.covTimer > rate && m.covCount < m.covMax) {
          m.covTimer -= rate;
          var g = V.earth.worldToLocal(satPos.clone().normalize().multiplyScalar(1.008));
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
    if (failedStep('delay', T)) flags.push(t('viz.delayed'));

    // ---- Telemetria em órbita (altitude real do dia, se houver a missão dia a dia)
    if (inOrbit && tele.status !== 'dock') {
      var plannedYears = (m.sc.params && m.sc.params.plannedDuration_years) || 1;
      var days = m.life ? Math.max(1, m.life.totals.lastDay || m.life.days) : Math.round(365 * Math.min(plannedYears, m.result.metrics.lifetime_years.value || 1));
      var frac = Math.min(1, Math.max(0, (T - opsStart) / Math.max(1, S.duration - opsStart)));
      var day = Math.round(frac * days);
      var alt = m.life ? lifeAltitude(m.life, day) : m.result.metrics.altitude_km.value;
      if (reentry) alt = alt * (1 - local);
      tele.met = t('viz.tl.day') + ' ' + day + ' / ' + days;
      tele.alt = u8.withUnit(alt, 'km', 0);
      tele.vel = u8.withUnit((m.surface ? 0 : m.lunar ? Math.sqrt(4902.8 / (1737.4 + Math.max(0, alt))) : Math.sqrt(MS.orbit.MU / (MS.orbit.RE + Math.max(0, alt)))), 'km/s', 2);
      tele.stage = m.sat.visible ? t('viz.stage.sat') : t('viz.stage.2');
      tele.fuel = null;
      var decaying = lifeEnd ? lifeEnd === 'reentry' : (m.result.metrics.lifetime_years.value || 0) < plannedYears;
      tele.status = reentry || gone ? 'reentry' : fx === 'debris' ? 'risk' : decaying ? 'decay' : 'orbit';
      // Tempestades reais registradas pela NASA (DONKI) perto deste dia.
      if (m.life && m.life.log.some(function (e) { return (e.type === 'storm' || e.type === 'reset') && Math.abs(e.day - day) <= 4; })) flags.push(t('viz.realStorm'));
      // Rastro do satélite
      m.trailTimer += dt;
      if (m.sat.visible && m.trailTimer > 0.06) {
        m.trailTimer = 0;
        m.trailPts = (m.trailPts || []).concat([satPos.clone()]).slice(-140);
        setLine(m.trail, m.trailPts);
      }
    }
    var hex = STATUS_HEX[tele.status] || STATUS_HEX.orbit;
    m.orbitLine.material.color.setHex(hex);
    m.orbitLine.material.opacity = inOrbit ? 0.55 : 0.18;
    m.trail.material.color.setHex(hex);
    if (m.flash && T < m.flash.until) flags.unshift(m.flash.text);

    updateParticles(dt);
    updateCamera(satPos, dt);
    updateHud(step, flags, tele);
  }

  // ---------------------------------------------------------------- Câmera
  function camText(mode) { return t('viz.cam.' + mode); }
  function updateCamera(satPos, dt) {
    var m = V.mission, S = m.schedule, cam = V.camera, k = V.snapCam ? 1 : 1 - Math.exp(-dt * 2.5);
    V.snapCam = false;
    V.controls.enabled = V.camMode === 'free';
    if (V.camMode === 'free') { V.controls.update(); return; }
    var target, want;
    var launching = V.t < S.orbitStart + (S.launchFailed ? 3 : 0);
    var focus = launching ? (m.rocket.visible ? m.rocket.position.clone() : launchPoint(0.5)) : (m.dockFocus || satPos).clone();
    var up = focus.clone().normalize();
    var side = up.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    var sepStepC = S.steps.filter(function (x) { return x.event.fx === 'separation'; })[0];
    var sepEnd = sepStepC ? sepStepC.t1 : S.orbitStart;
    if (V.camMode === 'follow' || launching || V.t < sepEnd) {
      target = focus;
      var close = launching ? 0.3 : m.dockFocus ? 0.26 : 0.2;
      want = focus.clone().add(up.multiplyScalar(close * 0.45)).add(side.multiplyScalar(close));
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
  function updateHud(step, flags, tele) {
    var m = V.mission, S = m.schedule, hud = V.wrap;
    var key = step ? step.event.id : (V.t >= S.duration ? 'end' : 'pre');
    if (key !== V.hudKey) {
      V.hudKey = key;
      var when = hud.querySelector('.viz-when'), title = hud.querySelector('.viz-title'), text = hud.querySelector('.viz-text');
      if (step) {
        var e = step.event;
        when.textContent = (e.random ? t('viz.random') + ' · ' : '') + (e.when || '') + (e.fx === 'launch' ? ' · ' + m.siteName : '');
        title.textContent = e.title;
        title.style.color = STATUS_COLOR[e.status] || '';
        text.textContent = e.text;
      } else if (V.t >= S.duration && m.result.mission.status === 'decide') {
        // Parada esperando a resposta ao alerta do controle da missão.
        when.textContent = t('alert.call', { day: m.result.mission.decision.day + 1 });
        title.textContent = t('alert.waitTitle');
        title.style.color = STATUS_COLOR.warn;
        text.textContent = '';
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
    // Telemetria (atualiza ~10 vezes por segundo)
    var now = performance.now();
    if (!V.teleAt || now - V.teleAt > 100) {
      V.teleAt = now;
      function set(k, v) { var el = hud.querySelector('[data-tl="' + k + '"]'); if (el && el.textContent !== v) el.textContent = v; }
      set('met', tele.met || '—'); set('alt', tele.alt || '—'); set('vel', tele.vel || '—'); set('stage', tele.stage || '—');
      var fuelPct = tele.fuel == null ? null : Math.max(0, Math.min(1, tele.fuel));
      set('fuel', fuelPct == null ? t('viz.noProp') : Math.round(fuelPct * 100) + '%');
      var bar = hud.querySelector('[data-tl="fuelbar"]');
      if (bar) { bar.style.width = (fuelPct == null ? 0 : fuelPct * 100) + '%'; bar.className = fuelPct != null && fuelPct < 0.2 ? 'low' : ''; }
      var stEl = hud.querySelector('[data-tl="status"]');
      if (stEl) { stEl.textContent = t('viz.st.' + (tele.status === 'dock' ? tele.dockText : (tele.status || 'sub'))); stEl.className = 'tl-status st-' + (tele.status || 'sub'); }
    }
    hud.querySelector('.viz-progress span').style.width = Math.min(100, V.t / S.duration * 100) + '%';
  }

  // -------------------------------------------------------------- Controles
  function onControl(act, data) {
    var bar = V.wrap;
    if (act === 'play') V.playing = !V.playing;
    if (act === 'restart') { buildMission(V.mission.state, V.mission.result); V.hudKey = null; startCine(); }
    if (act === 'skip') endCine(false);
    if (act === 'replay') { buildMission(V.mission.state, V.mission.result); V.hudKey = null; startCine(true); }
    if (act === 'end') { endCine(false); V.t = V.mission.schedule.duration; V.playing = true; }
    if (act === 'warp' && data) V.speed = +data.x || 1;
    if (act === 'cam') { V.camMode = V.camMode === 'auto' ? 'follow' : V.camMode === 'follow' ? 'free' : 'auto'; }
    if (act === 'full') {
      var w = V.wrap;
      if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else if (w.requestFullscreen) w.requestFullscreen().catch(function () {});
      else if (w.webkitRequestFullscreen) w.webkitRequestFullscreen();
    }
    bar.querySelector('[data-viz-act="play"]').textContent = V.playing ? '⏸ ' + t('viz.pause') : '▶ ' + t('viz.play');
    bar.querySelector('[data-viz-act="restart"]').textContent = '↺ ' + t('viz.restart');
    bar.querySelector('[data-viz-act="end"]').textContent = '⏭ ' + t('viz.skipEnd');
    bar.querySelector('.viz-warp-label').textContent = t('viz.warp');
    bar.querySelectorAll('[data-viz-act="warp"]').forEach(function (b) { b.classList.toggle('on', +b.dataset.x === V.speed); });
    bar.querySelector('[data-viz-act="cam"]').textContent = camText(V.camMode);
    bar.querySelector('[data-viz-act="full"]').textContent = isFull() ? '✕ ' + t('viz.exitFull') : '⛶ ' + t('viz.full');
  }

  function frame(now) {
    V.raf = root.requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - (V.last || now)) / 1000);
    V.last = now;
    if (!V.mission) return;
    var S = V.mission.schedule;
    if (V.cine) {
      // Ritmo das cenas: a contagem anda em segundos reais; o resto vai mais
      // devagar para dar tempo de ver (plataforma, votação, decolagem, subida).
      var cd = V.playing ? dt * V.speed * (CINE_PACE[MS.launchScene.chapterAt(V.cine.t)] || 1) : 0;
      V.cine.t += cd;
      var res = V.cine.obj.update(V.cine.t, cd, V.camera);
      if (res.done) endCine(false);
      else { cineHud(res); V.renderer.render(V.cine.obj.scene, V.camera); return; }
    }
    alertTick(dt);
    if (V.playing) {
      V.t += dt * V.speed;
      if (S.launchFailed) V.t = Math.min(V.t, S.orbitStart + 3);
    }
    // Em tempo acelerado, divide o passo para a física e as imagens não pularem.
    var stepDt = V.playing ? dt * V.speed : 0, n = Math.max(1, Math.ceil(stepDt / 0.05));
    if (n === 1) update(stepDt);
    else { var t0 = V.t - stepDt; for (var i = 1; i <= n; i++) { V.t = t0 + stepDt * i / n; update(stepDt / n); } }
    V.renderer.render(V.scene, V.camera);
  }

  // -------------------------------------------------------- Ligar às telas
  viz.attachAll = function (rootEl, state) {
    var host = rootEl.querySelector('[data-viz="mission"]');
    if (!host) {
      // Fora da Missão: guarda a fase para saber se a volta é um novo lançamento.
      if (V) V.awayPhase = state && state.phase;
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
      // Idioma trocado: refaz os rótulos fixos da vista (legenda, telemetria e botões).
      V.lang = MS.i18n.lang;
      var lb = staticLabels();
      V.wrap.querySelector('.viz-legend').innerHTML = lb.legend;
      V.wrap.querySelector('.viz-tele').innerHTML = lb.tele;
      V.hudKey = null; V.flagKey = null; V.teleAt = 0;
    }
    var base = JSON.stringify([state.scenarioId, state.design, state.seed, state.attempt, state.period || null, MS.i18n.lang]);
    var key = base + JSON.stringify(state.decisions || {});
    // Lançar de novo a partir da Construção, mesmo sem mudar o projeto, é um
    // novo lançamento: refaz a missão e toca a cena (antes só tocava se o
    // projeto tivesse mudado e o jogador via a órbita direto).
    var relaunch = V.awayPhase === 'build';
    V.awayPhase = null;
    if (relaunch) { V.key = null; V.baseKey = null; }
    if (key !== V.key) {
      var same = V.baseKey === base, keepT = V.t;
      V.key = key; V.baseKey = base; V.hudKey = null; V.flagKey = null;
      hideAlert();
      buildMission(state, result);
      if (same) {
        // Só mudou uma decisão da missão: segue do mesmo ponto, sem repetir a decolagem.
        var dt = 1 / 30;
        while (V.t < keepT) { var d = Math.min(dt, keepT - V.t); V.t += d; update(d); }
      } else {
        countdown();
      }
    }
    onControl('none');
    if (!V.raf) { V.last = 0; V.raf = root.requestAnimationFrame(frame); }
  };

  // ------------------------------------------------ Cena de lançamento no chão
  // Antes da vista orbital, o lançamento é contado em cenas (js/viz/launchscene.js):
  // plataforma, votação Go/No-Go, contagem, decolagem e subida. Depois corta
  // para a órbita com o foguete já subindo. Pulada com "menos movimento".
  var CINE_PACE = { pad: 0.6, poll: 0.4, count: 1, liftoff: 0.6, ascent: 0.65 };
  function countdown() { startCine(); }
  function startCine(force) {
    endCine(true);
    var reduce = false;
    try { reduce = root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sem matchMedia */ }
    var offer = V.wrap.querySelector('.viz-replay');
    if (offer) offer.remove();
    if (!MS.launchScene || !V.mission) return;
    if (reduce && !force) {
      // "Menos movimento": a cena não toca sozinha, mas o jogador pode pedir.
      offer = document.createElement('button');
      offer.type = 'button';
      offer.className = 'btn small viz-replay';
      offer.setAttribute('data-viz-act', 'replay');
      offer.textContent = '▶ ' + t('cine.replay');
      V.wrap.appendChild(offer);
      return;
    }
    var look = MS.looks.resolve('launchers', V.mission.result.selection.launcher);
    var crew = MS.advice ? MS.advice.crew(V.mission.state, V.mission.result) : [];
    // Em equipe, quem vota são as pessoas da sala (todas disseram GO para lançar).
    var room = MS.net && MS.net.active() ? MS.net.info() : null;
    if (room && room.members.length > 1 && MS.ui.teamGo) {
      crew = room.members.map(function (m) { return { key: MS.ui.teamGo.charOf(m), name: m.name, vote: 'go' }; });
    }
    V.cine = { t: 0, obj: MS.launchScene.create(look), crew: crew, key: '' };
    V.wrap.classList.add('cine-on');
    var el = V.wrap.querySelector('.viz-cine');
    if (!el) { el = document.createElement('div'); el.className = 'viz-cine'; V.wrap.appendChild(el); }
    el.innerHTML = '<div class="vc-chapter pixel"></div><div class="vc-count pixel" aria-hidden="true"></div>' +
      '<ul class="vc-poll"></ul><p class="vc-caption" aria-live="polite"></p>' +
      '<button type="button" class="btn small vc-skip" data-viz-act="skip">⏭ ' + MS.ui.h.esc(t('cine.skip')) + '</button><div class="vc-fade"></div>';
    V.controls.enabled = false;
    V.t = 0;
  }
  // Fim da cena: volta à vista orbital com o foguete já no meio da subida.
  function endCine(silent) {
    if (!V || !V.cine) return;
    V.cine.obj.dispose();
    V.cine = null;
    V.wrap.classList.remove('cine-on');
    if (silent || !V.mission) return;
    var S = V.mission.schedule;
    V.t = Math.max(V.t, 1.2 + 0.3 * Math.max(0, S.orbitStart - 1.2));
    V.snapCam = true;
    update(0);
  }
  // ------------------------------------------- Alerta do controle da missão
  // Quando o voo chega ao dia de um problema (result.mission.decision), o
  // controle chama dentro da vista 3D: bipes, borda vermelha e 10 s para
  // responder. Sem resposta, vale MS.life.NO_ANSWER (o satélite segue como
  // está). Sem contagem com "menos movimento" ou quando a vez é de outro na
  // equipe. Os botões usam data-action="decide", igual ao cartão da página.
  var ALERT_SECONDS = 10;
  var sfx = null;
  function alertBeep(f) {
    if (MS.ui.local.shoutMute) return;
    try {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      sfx = sfx || new AC();
      if (sfx.state === 'suspended') sfx.resume();
      var o = sfx.createOscillator(), g = sfx.createGain(), t0 = sfx.currentTime;
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      o.connect(g); g.connect(sfx.destination); o.start(t0); o.stop(t0 + 0.15);
    } catch (e) { /* sem som */ }
  }
  function hideAlert() {
    if (!V || !V.alert) return;
    V.alert = null;
    V.wrap.classList.remove('alert-on');
    var el = V.wrap.querySelector('.viz-alert');
    if (el) el.remove();
  }
  function showAlert(pend, now) {
    var esc = MS.ui.h.esc, st = V.mission.state;
    var locked = !!(MS.ui.phaseLock && MS.ui.phaseLock(st));
    var reduce = false;
    try { reduce = root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sem matchMedia */ }
    var timed = !locked && !reduce;
    var none = MS.life.NO_ANSWER[pend.id];
    V.alert = { key: pend.id + '|' + pend.day, timed: timed, left: ALERT_SECONDS * 1000, shown: ALERT_SECONDS + 1, none: none };
    var el = document.createElement('div');
    el.className = 'viz-alert';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-label', t('life.dec.' + pend.id + '.title'));
    el.innerHTML = '<div class="va-top"><span class="va-tag pixel">' + esc(t('alert.call', { day: pend.day + 1 })) + '</span>' +
      (timed ? '<span class="va-clock pixel" aria-hidden="true">' + ALERT_SECONDS + '</span>' : '') + '</div>' +
      '<h3>' + esc(t('life.dec.' + pend.id + '.title')) + '</h3><p>' + MS.ui.life.decisionText(pend) + '</p>' +
      '<div class="va-opts">' + pend.options.map(function (o) {
        return '<button type="button" class="btn small' + (o === none ? '' : ' primary') + '" data-action="decide" data-id="' + esc(pend.id) + '" data-choice="' + esc(o) + '"' + (locked ? ' disabled' : '') + '>' +
          esc(t('life.opt.' + pend.id + '.' + o)) + '</button>';
      }).join('') + '</div>' +
      '<p class="va-note">' + esc(timed ? t('alert.noAnswer', { opt: t('life.opt.' + pend.id + '.' + none) }) : t('life.dec.rule')) + '</p>' +
      (timed ? '<div class="va-bar"><i></i></div>' : '');
    V.wrap.appendChild(el);
    V.wrap.classList.add('alert-on');
    alertBeep(880); setTimeout(function () { alertBeep(660); }, 160);
    if (!timed) return;
    var first = el.querySelector('.va-opts .btn');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { /* ok */ } }
  }
  function alertTick(dt) {
    var mission = V.mission && V.mission.result.mission;
    var pend = mission && mission.status === 'decide' ? mission.decision : null;
    if (!pend || V.t < V.mission.schedule.duration - 0.05) { hideAlert(); return; }
    if (!V.alert || V.alert.key !== pend.id + '|' + pend.day) { hideAlert(); showAlert(pend, 0); }
    var a = V.alert;
    if (!a.timed || !V.playing) return;
    a.left -= dt * 1000;
    var sec = Math.max(0, Math.ceil(a.left / 1000));
    if (sec !== a.shown) {
      a.shown = sec;
      var c = V.wrap.querySelector('.va-clock');
      if (c) { c.textContent = String(sec); c.classList.toggle('hot', sec <= 3); }
      if (sec <= 3 && sec > 0) alertBeep(sec === 1 ? 990 : 740);
    }
    var bar = V.wrap.querySelector('.va-bar i');
    if (bar) bar.style.width = Math.max(0, a.left / (ALERT_SECONDS * 1000) * 100) + '%';
    if (a.left <= 0 && !a.fired) {
      a.fired = true;
      var b = V.wrap.querySelector('.viz-alert [data-choice="' + a.none + '"]');
      var toast = document.createElement('div');
      toast.className = 'viz-toast';
      toast.setAttribute('role', 'status');
      toast.textContent = t('alert.timeout', { opt: t('life.opt.' + pend.id + '.' + a.none) });
      V.wrap.appendChild(toast);
      setTimeout(function () { toast.remove(); }, 4500);
      alertBeep(330);
      if (b) b.click();
    }
  }

  function cineHud(res) {
    var c = V.cine, el = V.wrap.querySelector('.viz-cine'), esc = MS.ui.h.esc;
    if (!el) return;
    var key = res.chapter + '|' + (res.count || '') + '|' + MS.i18n.lang;
    if (key !== c.key) {
      c.key = key;
      el.querySelector('.vc-chapter').textContent = t('cine.ch.' + res.chapter);
      el.querySelector('.vc-caption').textContent = t('cine.cap.' + res.chapter, { site: V.mission.siteName });
      el.querySelector('.vc-count').textContent = res.count ? String(res.count) : '';
      el.querySelector('.vc-count').classList.toggle('on', !!res.count);
      if (res.count) { var cn = el.querySelector('.vc-count'); cn.classList.remove('pop'); void cn.offsetWidth; cn.classList.add('pop'); }
    }
    // Votação: os conselheiros respondem um a um (mesmos votos da verificação).
    var poll = el.querySelector('.vc-poll');
    var showPoll = res.chapter === 'poll' && c.crew.length;
    poll.style.display = showPoll ? '' : 'none';
    if (showPoll) {
      var n = Math.min(c.crew.length + 1, Math.floor((c.t - 3.5) / 0.55) + 1);
      if (poll.childElementCount !== n) {
        var nogo = c.crew.filter(function (a) { return a.vote === 'nogo'; }).length;
        poll.innerHTML = c.crew.slice(0, n).map(function (a) {
          var go = a.vote !== 'nogo';
          return '<li class="r-' + a.key + '"><span>' + (MS.ui.h.character ? MS.ui.h.character(a.key, 22) : '') + esc(a.name) + '</span><b class="' + (go ? 'go' : 'nogo') + '">' + esc(t(go ? 'ck.go' : 'ck.nogo')) + '</b></li>';
        }).join('') + (n > c.crew.length ? '<li class="vc-dir"><span>' + esc(nogo ? t('cine.dirNoGo', { n: nogo }) : t('cine.dirGo')) + '</span></li>' : '');
      }
    }
    el.querySelector('.vc-fade').style.opacity = String(Math.max(0, Math.min(1, (c.t - (MS.launchScene.END - 0.6)) / 0.6)));
  }

  viz.debug = function () { return V; };
  // Pula a cena de lançamento até o instante s (para depurar e para as capturas).
  viz.cineSeek = function (s) {
    if (!V || !V.cine) return null;
    var dt = 1 / 30;
    while (V.cine && V.cine.t < s) { V.cine.t += dt; var r = V.cine.obj.update(V.cine.t, dt, V.camera); cineHud(r); }
    if (V.cine) V.renderer.render(V.cine.obj.scene, V.camera);
    return V.cine ? V.cine.t : null;
  };

  // Avança a animação até o instante s (segundos), quadro a quadro. Útil para
  // depurar: MS.viz.seek(40) pula para 40 s com as imagens já acumuladas.
  viz.seek = function (s) {
    if (!V || !V.mission) return null;
    var dt = 1 / 30;
    if (s < V.t) { buildMission(V.mission.state, V.mission.result); V.hudKey = null; }
    while (V.t < s) { var d = Math.min(dt, s - V.t); V.t += d; update(d); }
    V.renderer.render(V.scene, V.camera);
    return V.t;
  };
})(globalThis);
