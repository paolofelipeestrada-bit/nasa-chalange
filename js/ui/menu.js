/* =====================================================================
 * ui/menu.js — MENU INICIAL (tela de abertura)
 *
 * Aparece ao abrir o site (js/main.js liga ui.local.menuOpen) e pelo
 * botão "Menu" do topo. Só lê o state; as escolhas viram ações:
 *   menu-play      jogar sozinho / continuar a missão salva
 *   menu-team      jogar em equipe (abre o painel da sala)
 *   menu-new       começar uma missão nova (zera o projeto)
 *   menu-how       mostra/esconde "Como funciona"
 *   menu-tutorial  tutorial guiado (só aparece se MS.tutorial existir)
 *   menu-open      volta ao menu
 * Ao fundo, uma cena 3D leve: Terra low-poly, ISS e o seu satélite em
 * órbita (usa js/viz/parts3d.js e js/viz/hangar3d.js; sem WebGL, some).
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h;
  var t = MS.i18n.t, L = MS.i18n.L;
  var local = ui.local;
  if (!('menuOpen' in local)) local.menuOpen = false;
  if (!('menuHow' in local)) local.menuHow = false;

  function rerender() { if (MS.store.state) ui.render(MS.store.state); }

  // Já existe progresso salvo? (passou da fase 1, escolheu algo ou tentou de novo)
  function progress(state) {
    var info = MS.store.phaseInfo(state);
    var picked = Object.keys(state.design || {}).some(function (k) { return state.design[k]; });
    return { any: info.reachedIndex > 0 || picked || state.attempt > 1, info: info };
  }

  function bigButton(action, ico, title, sub, cls) {
    return '<button type="button" class="mn-btn' + (cls ? ' ' + cls : '') + '" data-action="' + action + '">' +
      '<span class="mn-ic">' + ico + '</span><span class="mn-txt"><b>' + h.esc(title) + '</b><span>' + h.esc(sub) + '</span></span>' +
      '<span class="mn-go" aria-hidden="true">→</span></button>';
  }

  function howPanel() {
    if (!local.menuHow) return '';
    var steps = [1, 2, 3, 4, 5].map(function (n) {
      return '<li><span class="mn-n">' + n + '</span><div><b>' + h.esc(t('menu.how' + n)) + '</b><p>' + h.esc(t('menu.how' + n + 't')) + '</p></div></li>';
    }).join('');
    return '<section class="mn-how" aria-label="' + h.esc(t('menu.how')) + '"><h2>' + h.esc(t('menu.how')) + '</h2><ol>' + steps + '</ol>' +
      '<p class="mn-how-foot">' + h.esc(t('menu.howFoot')) + '</p></section>';
  }

  ui.menuHTML = function (state) {
    var p = progress(state), room = MS.net ? MS.net.info() : { inRoom: false };
    var nScen = Object.keys(MS.data.scenarios).length;
    var playSub = p.any
      ? t('menu.continueSub', { phase: L(p.info.current.title), n: state.attempt, mission: L(h.scenario(state).title) })
      : t('menu.soloSub');
    var btns = bigButton('menu-play', h.icon(p.any ? 'rocket' : 'dir', { size: 26 }), p.any ? t('menu.continue') : t('menu.solo'), playSub, 'primary') +
      bigButton('menu-team', h.icon('team', { size: 26 }), room.inRoom ? t('menu.teamIn', { code: room.code }) : t('menu.team'), t('menu.teamSub'), 'team') +
      (MS.tutorial ? bigButton('menu-tutorial', h.icon('book', { size: 26 }), t('menu.tutorial'), t('menu.tutorialSub'), 'tut') : '');
    var small = (p.any ? '<button type="button" class="btn small" data-action="menu-new">' + h.icon('restart', { size: 16 }) + h.esc(t('menu.new')) + '</button>' : '') +
      '<button type="button" class="btn small' + (local.menuHow ? ' on' : '') + '" data-action="menu-how" aria-expanded="' + !!local.menuHow + '">' + h.icon('info', { size: 16 }) + h.esc(t('menu.how')) + '</button>' +
      '<button type="button" class="btn small" data-action="menu-about">' + h.icon('eye', { size: 16 }) + h.esc(t('ui.about')) + '</button>';
    return '<div class="menu">' +
      '<div class="mn-sky" data-viz="menu" aria-hidden="true"></div>' +
      '<div class="mn-top">' + ui.langSwitch() + '</div>' +
      '<div class="mn-main"><div class="mn-hero">' +
        '<span class="mn-kicker">' + h.esc(t('menu.kicker')) + '</span>' +
        '<h1 class="pixel">' + h.esc(t('app.name')) + '</h1>' +
        '<p class="mn-tag">' + h.esc(t('menu.tagline')) + '</p>' +
        '<ul class="mn-facts"><li>' + h.icon('card', { size: 16 }) + h.esc(t('menu.factMissions', { n: nScen })) + '</li>' +
          '<li>' + h.icon('sun', { size: 16 }) + h.esc(t('menu.factWeather')) + '</li>' +
          '<li>' + h.icon('team', { size: 16 }) + h.esc(t('menu.factTeam')) + '</li></ul>' +
        '<div class="mn-btns">' + btns + '</div>' +
        '<div class="mn-small">' + small + '</div>' +
        howPanel() +
      '</div></div>' +
      '<p class="mn-foot">' + h.esc(t('menu.foot')) + '</p></div>';
  };

  function closeMenu() { local.menuOpen = false; stop3d(); }

  Object.assign(ui.actions, {
    'menu-play': function () { closeMenu(); rerender(); root.scrollTo(0, 0); },
    'menu-team': function () { closeMenu(); local.teamOpen = true; rerender(); root.scrollTo(0, 0); },
    'menu-new': function () {
      if (!root.confirm(t('ui.confirmReset'))) return;
      closeMenu(); MS.store.reset(MS.store.state.scenarioId); root.scrollTo(0, 0);
    },
    'menu-how': function () { local.menuHow = !local.menuHow; rerender(); },
    'menu-about': function () { closeMenu(); local.aboutOpen = true; rerender(); root.scrollTo(0, 0); },
    'menu-tutorial': function () { closeMenu(); rerender(); if (MS.tutorial) MS.tutorial.start(); },
    'menu-open': function () { local.menuOpen = true; rerender(); root.scrollTo(0, 0); }
  });

  // ------------------------------------------------------------ Cena 3D
  var V = null; // { renderer, scene, camera, wrap, raf, ... } — sobrevive aos redesenhos
  var THREE = root.THREE, P = MS.parts3d;

  function build3d(state) {
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.01, 300);

    scene.add(new THREE.AmbientLight(0x8fa6d8, 0.3));
    var sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
    sun.position.set(-4, 2, 5);
    scene.add(sun);

    // Estrelas
    var sp = [], sc = [], c = new THREE.Color();
    for (var i = 0; i < 1800; i++) {
      var v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(60 + Math.random() * 40);
      sp.push(v.x, v.y, v.z);
      c.setHSL(0.55 + Math.random() * 0.15, 0.3, 0.55 + Math.random() * 0.45);
      sc.push(c.r, c.g, c.b);
    }
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.25, vertexColors: true })));

    var world = new THREE.Group(); scene.add(world);
    var earth = P.lowPolyEarth(1, 5); world.add(earth);
    world.add(new THREE.Mesh(new THREE.SphereGeometry(1.05, 48, 24), new THREE.ShaderMaterial({
      uniforms: { glow: { value: new THREE.Color(0x5aa8ff) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0);' +
        ' vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 glow; varying vec3 vN; varying vec3 vV; void main() {' +
        ' float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(glow, f * 0.9); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    })));

    V = { renderer: renderer, scene: scene, camera: camera, world: world, earth: earth, sat: null, satKey: null, raf: 0, t0: performance.now(), wrap: null };
    V.iss = orbiter(P.build({ kind: 'iss' }), 1.12, 0.9, 0.06);
  }

  // Objeto numa órbita inclinada, com o anel da órbita.
  function orbiter(obj, r, incl, scale) {
    var pivot = new THREE.Group(); pivot.rotation.z = incl; V.world.add(pivot);
    obj.scale.setScalar(scale); obj.position.set(r, 0, 0); pivot.add(obj);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0025, 4, 160), new THREE.MeshBasicMaterial({ color: 0x7fb2ff, transparent: true, opacity: 0.25 }));
    ring.rotation.x = Math.PI / 2; pivot.add(ring);
    return pivot;
  }
  // O satélite do jogador (refeito quando o projeto muda).
  function updateSat(state) {
    var key = JSON.stringify(state.design || {});
    if (key === V.satKey || !MS.hangar || !MS.hangar.buildSatellite) return;
    if (V.sat) V.world.remove(V.sat);
    try { V.sat = orbiter(MS.hangar.buildSatellite(state.design || {}).group, 1.28, -0.35, 0.09); } catch (e) { V.sat = null; }
    V.satKey = key;
  }

  function size() {
    var w = V.wrap.clientWidth || 800, hh = V.wrap.clientHeight || 600;
    V.renderer.setSize(w, hh, false);
    V.camera.aspect = w / hh;
    // Tela larga: Terra à direita, texto à esquerda. Celular: Terra no alto, atrás do texto.
    var wide = w > 820, dist = wide ? 5.4 : 8;
    var halfW = dist * Math.tan(20 * Math.PI / 180) * V.camera.aspect;
    var x = wide ? -Math.min(halfW * 0.42, 2.6) : 0.9, y = wide ? 0 : -2.3;
    V.camera.position.set(x, y, dist);
    V.camera.lookAt(x, y, 0);
    V.world.position.set(0, 0, 0);
    V.camera.updateProjectionMatrix();
  }

  function frame(now) {
    if (!V || !V.wrap || !V.wrap.isConnected) { V && (V.raf = 0); return; }
    var s = (now - V.t0) / 1000;
    V.earth.rotation.y = s * 0.06;
    V.iss.rotation.y = s * 0.35;
    if (V.sat) V.sat.rotation.y = -1.6 + s * 0.22;
    V.world.rotation.x = 0.25;
    V.renderer.render(V.scene, V.camera);
    V.raf = root.requestAnimationFrame(frame);
  }

  function stop3d() { if (V && V.raf) { root.cancelAnimationFrame(V.raf); V.raf = 0; } }

  ui.menuAttach = function (rootEl, state) {
    var host = rootEl.querySelector('[data-viz="menu"]');
    if (!host) { stop3d(); return; }
    if (!THREE || !P || !P.available || !P.lowPolyEarth) return;
    try {
      if (!V) build3d(state);
      updateSat(state);
      V.wrap = host;
      host.appendChild(V.renderer.domElement);
      size();
      if (!V.resizeHooked && root.addEventListener) { root.addEventListener('resize', function () { if (V && V.wrap && V.wrap.isConnected) size(); }); V.resizeHooked = true; }
      if (!V.raf) V.raf = root.requestAnimationFrame(frame);
    } catch (e) {
      if (root.console) console.warn('Menu 3D indisponível:', e && e.message);
      THREE = null;
    }
  };
})(globalThis);
