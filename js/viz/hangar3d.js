/* =====================================================================
 * viz/hangar3d.js — HANGAR 3D (estilo jogo de foguetes) na coluna direita
 *
 *   MS.hangar.attach(rootEl, state)  chamado após cada render(): liga o
 *        hangar a um <div data-viz="hangar"> da tela (ou pausa).
 *   MS.hangar.preview(slot, option)  prévia ao passar o mouse num cartão
 *        (preview(null) desfaz).
 *
 * Design:  o satélite montado com as peças escolhidas. A peça recém-
 *          escolhida acende em azul; a da prévia aparece em amarelo.
 * Concept: o objeto da escolha em foco — foguete na plataforma com a
 *          torre, órbita em volta da Terra ou a estação em solo.
 * Só desenha o que está no state; não muda nada no jogo.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, THREE = root.THREE, P = MS.parts3d;
  var hangar = MS.hangar = { attach: function () {}, preview: function () {} };

  if (!THREE || !THREE.OrbitControls || !P || !P.available) {
    hangar.attach = function (rootEl) {
      var host = rootEl.querySelector('[data-viz="hangar"]');
      if (host) host.closest('.hangar-card').style.display = 'none'; // sem 3D: some o cartão
    };
    return;
  }

  var DEG = Math.PI / 180, U = P.U;
  var V = null;
  function t(k) { return MS.i18n.t(k); }
  function L(x) { return MS.i18n.L(x); }
  function esc(s) { return MS.ui.h.esc(s); }

  // ------------------------------------------------------------- A vista
  function createView() {
    var wrap = document.createElement('div');
    wrap.className = 'hangar3d';
    wrap.innerHTML = '<div class="hg-label"><span class="hg-kicker"></span><span class="hg-name"></span><span class="hg-stats"></span></div>' +
      '<div class="hg-hint"></div>';
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    wrap.insertBefore(renderer.domElement, wrap.firstChild);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1426);
    scene.fog = new THREE.Fog(0x0d1426, 6, 14);
    scene.add(new THREE.HemisphereLight(0xe8efff, 0x2a3350, 0.8));
    var key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); scene.add(key);
    var rim = new THREE.DirectionalLight(0x7fa6ff, 1.0); rim.position.set(-4, 2, -3); scene.add(rim);
    var grid = new THREE.GridHelper(8, 32, 0x3d5aa8, 0x1f2c52);
    grid.position.y = -0.95; scene.add(grid);
    // Estrelas (vistas quando o foco é a órbita).
    var sp = [];
    for (var i = 0; i < 600; i++) {
      var v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(30);
      sp.push(v.x, v.y, v.z);
    }
    var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    var stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 }));
    scene.add(stars);

    var camera = new THREE.PerspectiveCamera(35, 1.4, 0.02, 60);
    camera.position.set(2.2, 1.3, 3.0);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false;
    controls.minDistance = 0.8; controls.maxDistance = 9;
    controls.autoRotate = true; controls.autoRotateSpeed = 1.2;
    renderer.domElement.addEventListener('pointerdown', function () { V.idleUntil = performance.now() + 8000; });

    V = {
      wrap: wrap, renderer: renderer, scene: scene, camera: camera, controls: controls, grid: grid, stars: stars,
      model: null, key: null, lastDesign: null, focus: null, preview: null, pulse: [], idleUntil: 0,
      wantTarget: new THREE.Vector3(), wantDist: 3.5, raf: null, state: null
    };
    if (root.ResizeObserver) new root.ResizeObserver(resize).observe(wrap);
    return V;
  }

  function resize() {
    var w = V.wrap.clientWidth || 360, h = V.wrap.clientHeight || 260;
    V.renderer.setSize(w, h, false);
    V.camera.aspect = w / h;
    V.camera.updateProjectionMatrix();
  }

  // --------------------------------------------------------- Destaques
  // Copia os materiais do grupo (para não acender as outras peças) e
  // dá um brilho; "pulse" faz o brilho pulsar no laço de desenho.
  function tint(group, hex, pulse) {
    var c = new THREE.Color(hex).convertSRGBToLinear();
    group.traverse(function (o) {
      if (!o.isMesh) return;
      var mats = [].concat(o.material).map(function (m) {
        var k = m.clone(); k._hgOwned = true;
        if (k.emissive) { k.emissive = c.clone(); k.emissiveIntensity = 0.45; if (pulse) V.pulse.push(k); }
        return k;
      });
      o.material = Array.isArray(o.material) ? mats : mats[0];
    });
  }
  function ghost(group) {
    var g = new THREE.MeshBasicMaterial({ color: 0x7c9cff, transparent: true, opacity: 0.22, depthWrite: false }); g._hgOwned = true;
    group.traverse(function (o) { if (o.isMesh) o.material = g; });
  }
  function disposeModel(obj) {
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(function (m) { if (m._hgOwned) m.dispose(); });
    });
  }

  // ------------------------------------------------- Montagem do satélite
  function lookOf(id) { var it = MS.data.catalog.components[id]; return it ? MS.looks.resolve('components', it) : null; }

  function satellite(design, prev) {
    var g = new THREE.Group(), parts = {};
    function pick(slot) { return prev && prev.slot === slot ? prev.option : design[slot]; }

    var sLook = pick('structure') ? lookOf(pick('structure')) : null;
    var units = sLook ? sLook.units : 3, wide = units >= 6 ? 2 : 1;
    var w = wide * U, d = U, h = 3 * U;
    var frame = P.build(sLook || { kind: 'frame', formFactor: '3U', units: 3 });
    if (!sLook) ghost(frame);
    parts.structure = frame; g.add(frame);

    // Câmera no cubo de baixo, lente apontando para a Terra (-Y).
    if (pick('payload')) {
      var cam = P.build(lookOf(pick('payload')));
      cam.scale.setScalar(0.45); cam.rotation.x = Math.PI / 2;
      cam.position.set(wide === 2 ? -U / 2 : 0, -h / 2 + U * 0.5, 0);
      parts.payload = cam; g.add(cam);
    }
    // Computador e controle de atitude no cubo do meio.
    if (pick('obc')) {
      var obc = P.build(lookOf(pick('obc')));
      obc.scale.setScalar(0.4); obc.position.set(0, -h / 2 + U * 1.15, 0);
      parts.obc = obc; g.add(obc);
    }
    if (pick('adcs')) {
      var ad = P.build(lookOf(pick('adcs')));
      ad.scale.setScalar(0.37); ad.position.set(wide === 2 ? U / 2 : 0, -h / 2 + U * 1.7, 0);
      parts.adcs = ad; g.add(ad);
    }
    // Rádio no topo, com as antenas para fora.
    if (pick('comms')) {
      var rd = P.build(lookOf(pick('comms')));
      rd.scale.setScalar(0.62); rd.position.set(0, h / 2 + 0.05, 0);
      parts.comms = rd; g.add(rd);
    }
    // Energia: células em 3 faces (a frente fica aberta para ver dentro)
    // e, se for o caso, duas asas abertas no alto.
    if (pick('power')) {
      var pl = lookOf(pick('power')), pw = new THREE.Group();
      var back = P.panel(w - 0.02, h - 0.02, wide, 3); back.position.z = -d / 2 - 0.016; back.rotation.y = Math.PI; pw.add(back);
      [-1, 1].forEach(function (s) {
        var side = P.panel(d - 0.02, h - 0.02, 1, 3);
        side.position.x = s * (w / 2 + 0.016); side.rotation.y = s * Math.PI / 2; pw.add(side);
      });
      if (pl.wings) {
        [-1, 1].forEach(function (s) {
          var wing = P.panel(h, U * 0.95, 3, 1);
          wing.position.set(s * (w / 2 + h / 2 + 0.06), h / 2 - U * 0.5, 0);
          pw.add(wing);
          var hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), P.materials().grey);
          hinge.rotation.z = Math.PI / 2; hinge.position.set(s * (w / 2 + 0.04), h / 2 - U * 0.5, 0); pw.add(hinge);
        });
      }
      parts.power = pw; g.add(pw);
    }
    return { group: g, parts: parts, size: Math.max(h + 0.6, w + (pick('power') && lookOf(pick('power')).wings ? 2 * h : 0)) };
  }

  // ------------------------------------------------- Cenas do conceito
  function catalogItem(source, id) { return MS.data.catalog[source] && MS.data.catalog[source][id]; }
  function launchPad(look) {
    var g = new THREE.Group(), m = P.materials();
    var rocket = P.build(look);
    var flames = [];
    rocket.traverse(function (o) { if (o.isMesh && o.material === m.flame) flames.push(o); });
    flames.forEach(function (f) { f.parent.remove(f); }); // na plataforma, motor desligado
    rocket.position.y = 0.0;
    g.add(rocket);
    g.add(mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.16, 10), m.concrete, 0, -0.22, 0));
    // Torre de serviço: treliça vermelha com braço até o foguete.
    var tower = new THREE.Group(), redM = m.red;
    [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(function (c) {
      tower.add(mesh(new THREE.BoxGeometry(0.03, 3.1, 0.03), redM, c[0], 1.4, c[1]));
    });
    for (var y = 0; y < 3; y += 0.3) {
      tower.add(mesh(new THREE.BoxGeometry(0.27, 0.025, 0.025), redM, 0, y, 0.12));
      tower.add(mesh(new THREE.BoxGeometry(0.025, 0.025, 0.27), redM, 0.12, y + 0.15, 0));
    }
    tower.add(mesh(new THREE.BoxGeometry(0.42, 0.04, 0.06), m.grey, -0.3, 2.3, 0));
    tower.position.set(0.65, 0, 0);
    g.add(tower);
    return g;
  }
  function mesh(geo, mat, x, y, z) { var o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); return o; }

  // ----------------------------------------------------------- Atualizar
  function sizeOf(obj) {
    obj.updateMatrixWorld(true);
    var b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    return { center: c, radius: Math.max(sz.x, sz.y, sz.z) / 2 * 1.12 };
  }

  function rebuild(state) {
    if (V.model) { V.scene.remove(V.model); disposeModel(V.model); }
    V.pulse = [];
    var sc = MS.data.scenarios[state.scenarioId], phase = state.phase, prev = V.preview;
    var label = { kicker: t('hangar.title'), name: '', stats: '', previewing: false }, model, space = false;

    if (phase === 'concept') {
      var fslot = (prev && prev.slot) || V.focus || 'orbit';
      var slot = sc.slots.filter(function (s) { return s.id === fslot; })[0] || sc.slots[0];
      var id = prev && prev.slot === slot.id ? prev.option : state.design[slot.id];
      if (!id) { slot = sc.slots.filter(function (s) { return s.phase === 'concept' && state.design[s.id]; })[0] || slot; id = state.design[slot.id] || slot.options[0]; }
      var item = catalogItem(slot.source, id), look = MS.looks.resolve(slot.source, item);
      if (look.kind === 'rocket') { model = launchPad(look); label.kicker = t('hangar.pad'); }
      else { model = P.build(look); if (look.kind === 'orbit') { space = true; label.kicker = t('hangar.orbitView'); } }
      if (prev && prev.slot === slot.id) label.previewing = true; // prévia: só o rótulo fica amarelo
      label.name = L(item.name);
    } else {
      var sat = satellite(state.design, prev);
      model = sat.group;
      var focus = prev ? prev.slot : V.focus;
      if (focus && sat.parts[focus]) tint(sat.parts[focus], prev ? 0xffc83d : 0x5aa0ff, !prev);
      var fid = prev ? prev.option : (focus && state.design[focus]);
      var fitem = fid && MS.data.catalog.components[fid];
      if (fitem) {
        var fs = sc.slots.filter(function (s) { return s.id === focus; })[0];
        label.kicker = fs ? L(fs.label) : t('hangar.title');
        label.name = L(fitem.name);
        label.stats = statsOf(fitem, state);
        label.previewing = !!prev;
      } else {
        label.name = state.design.structure ? '' : t('hangar.empty');
      }
      model.rotation.y = -0.5;
    }
    V.model = model;
    V.scene.add(model);
    V.grid.visible = !space; V.stars.visible = space;
    var s = sizeOf(model);
    V.wantTarget.copy(s.center);
    V.wantDist = Math.max(1.2, s.radius / Math.sin(V.camera.fov * DEG / 2) * 1.05);
    // Mudou o tipo de cena (satélite, foguete, órbita, estação)? Enquadra na hora.
    var kind = phase + ':' + (phase === 'concept' ? label.kicker : 'sat');
    if (kind !== V.sceneKind) { V.sceneKind = kind; snap(); }
    showLabel(label);
  }

  function snap() {
    var c = V.controls, cam = V.camera;
    var dir = cam.position.clone().sub(c.target).normalize();
    c.target.copy(V.wantTarget);
    cam.position.copy(V.wantTarget).add(dir.multiplyScalar(V.wantDist));
    c.update();
  }

  function statsOf(it, state) {
    var u = MS.sim.util, cat = MS.data.catalog.components;
    var ff = state.design.structure && cat[state.design.structure] ? cat[state.design.structure].formFactor : '3U';
    function v(x) { return typeof x === 'object' && x ? x[ff] : x; }
    var out = [];
    if (v(it.mass_kg) != null) out.push(u.withUnit(v(it.mass_kg), 'kg', 2));
    if (v(it.power_W)) out.push(u.withUnit(v(it.power_W), 'W', 1));
    if (v(it.cost_k) != null) out.push(u.withUnit(v(it.cost_k), 'k$', 0));
    return out.join(' · ');
  }

  function showLabel(lb) {
    var w = V.wrap;
    w.querySelector('.hg-kicker').textContent = (lb.previewing ? t('hangar.preview') + ' · ' : '') + lb.kicker;
    w.querySelector('.hg-name').textContent = lb.name;
    w.querySelector('.hg-stats').textContent = lb.stats || '';
    w.querySelector('.hg-label').classList.toggle('previewing', !!lb.previewing);
    w.querySelector('.hg-hint').textContent = t('hangar.drag');
  }

  // A escolha que mudou desde o último desenho vira o foco (peça acesa).
  function trackFocus(state) {
    var last = V.lastDesign, d = state.design;
    if (last) {
      Object.keys(d).forEach(function (k) { if (d[k] !== last[k] && d[k]) V.focus = k; });
    }
    if (V.lastPhase !== state.phase) {
      V.focus = state.phase === 'concept' ? (V.focus && ['orbit', 'launcher', 'groundStation'].indexOf(V.focus) !== -1 ? V.focus : null) : null;
      V.lastPhase = state.phase;
    }
    V.lastDesign = Object.assign({}, d);
  }

  function frame(now) {
    V.raf = root.requestAnimationFrame(frame);
    var c = V.controls, cam = V.camera, k = 0.12;
    c.autoRotate = now > V.idleUntil;
    c.target.lerp(V.wantTarget, k);
    var off = cam.position.clone().sub(c.target), len = off.length();
    if (Math.abs(len - V.wantDist) > 0.002) cam.position.copy(c.target).add(off.multiplyScalar((len + (V.wantDist - len) * k) / len));
    var glow = 0.35 + 0.3 * Math.sin(now / 260);
    V.pulse.forEach(function (m) { m.emissiveIntensity = glow; });
    c.update();
    V.renderer.render(V.scene, cam);
  }

  hangar.attach = function (rootEl, state) {
    var host = rootEl.querySelector('[data-viz="hangar"]');
    if (!host) {
      if (V && V.raf) { root.cancelAnimationFrame(V.raf); V.raf = null; }
      if (V && V.wrap.parentNode) V.wrap.parentNode.removeChild(V.wrap);
      return;
    }
    if (!V) {
      try { createView(); }
      catch (e) { host.closest('.hangar-card').style.display = 'none'; V = null; return; }
    }
    V.state = state;
    host.appendChild(V.wrap);
    resize();
    trackFocus(state);
    var key = JSON.stringify([state.scenarioId, state.phase, state.design, V.focus, V.preview, MS.i18n.lang]);
    if (key !== V.key) { V.key = key; rebuild(state); }
    if (!V.raf) V.raf = root.requestAnimationFrame(frame);
  };

  // Para depurar: desenha já, com a câmera no enquadramento final.
  hangar.renderNow = function () { if (!V) return false; snap(); V.renderer.render(V.scene, V.camera); return true; };

  // Prévia ao passar o mouse num cartão (chamado por MS.ui.preview).
  hangar.preview = function (slot, option) {
    if (!V || !V.state || !V.wrap.parentNode) return;
    var p = slot && option ? { slot: slot, option: option } : null;
    if (JSON.stringify(p) === JSON.stringify(V.preview)) return;
    V.preview = p;
    var s = V.state;
    V.key = JSON.stringify([s.scenarioId, s.phase, s.design, V.focus, V.preview, MS.i18n.lang]);
    rebuild(s);
  };
})(globalThis);
