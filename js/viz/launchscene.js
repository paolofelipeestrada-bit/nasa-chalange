/* =====================================================================
 * viz/launchscene.js — CENA DE LANÇAMENTO NO CHÃO (antes da vista orbital)
 *
 *   MS.launchScene.create(look) → cena
 *   cena.update(t, dt, camera) → { chapter, done, count, ignition }
 *   cena.dispose()
 *   MS.launchScene.CHAPTERS     roteiro: [{ id, t0, t1 }] em segundos
 *
 * Roteiro, como cenas de videogame (cada uma com sua câmera):
 *   pad      plataforma ao entardecer, câmera girando em volta do foguete
 *   poll     votação Go/No-Go da equipe, câmera perto da ponta (o CubeSat
 *            vai dentro da carenagem)
 *   count    5, 4, 3, 2, 1: o braço da torre recua, os motores acendem
 *            um pouco antes do zero
 *   liftoff  decolagem vista do chão, com fumaça e tremor
 *   ascent   câmera persegue o foguete; o céu escurece e as estrelas aparecem
 * Lançamento impossível (opts.scrub: pesado demais, não cabe, foguete não
 * chega à órbita): a contagem PARA em 3, alarme vermelho, o braço da torre
 * volta e o foguete fica na plataforma (capítulo 'scrub'). Não decola.
 * Depois disso, js/viz/mission3d.js corta para a vista orbital (estágios,
 * carenagem e entrada em órbita). Só desenho: nada aqui muda o resultado.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var THREE = root.THREE, P = MS.parts3d;

  var CHAPTERS = [
    { id: 'pad', t0: 0, t1: 3.5 },
    { id: 'poll', t0: 3.5, t1: 6.5 },
    { id: 'count', t0: 6.5, t1: 11.5 },
    { id: 'liftoff', t0: 11.5, t1: 15 },
    { id: 'ascent', t0: 15, t1: 18.6 }
  ];
  var T0 = 11.5, IGNITION = 10.6, END = 18.6;
  var SCRUB_T = 8.6, SCRUB_END = 15;   // contagem para em 3; cena de cancelamento
  var K = 3.5;                    // escala do foguete (2,9 unidades → ~10)
  var H = 2.9 * K;                // altura do foguete na cena

  function chapterAt(t) {
    for (var i = 0; i < CHAPTERS.length; i++) if (t < CHAPTERS[i].t1) return CHAPTERS[i].id;
    return 'ascent';
  }
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function lambert(hex, flat) { return new THREE.MeshLambertMaterial({ color: hex, flatShading: !!flat }); }

  // Céu: esfera com degradê do horizonte (entardecer) ao alto.
  function skyDome() {
    var g = new THREE.SphereGeometry(260, 32, 16), pos = g.attributes.position, cols = [];
    var top = new THREE.Color(0x0d1850), mid = new THREE.Color(0x3a5fae), hor = new THREE.Color(0xf08c4a), low = new THREE.Color(0x2a2f45), c = new THREE.Color();
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 260;
      if (y > 0.25) c.copy(mid).lerp(top, (y - 0.25) / 0.75);
      else if (y > 0) c.copy(hor).lerp(mid, y / 0.25);
      else c.copy(hor).lerp(low, Math.min(1, -y * 6));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  }

  // Torre de serviço: treliça vermelha com o braço que segura a ponta do foguete.
  function tower() {
    var g = new THREE.Group(), red = lambert(0xb8412f), grey = lambert(0x6d727c);
    var w = 1.7, x0 = -3.4, hT = H * 1.08;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, hT, 0.16), red);
      bar.position.set(x0 + c[0] * w / 2, hT / 2, c[1] * w / 2); g.add(bar);
    });
    for (var y = 0.8; y < hT; y += 1.25) {
      [[0, -w / 2, w, 0.1], [0, w / 2, w, 0.1]].forEach(function (r) {
        var rung = new THREE.Mesh(new THREE.BoxGeometry(r[2] + 0.16, r[3], 0.1), red);
        rung.position.set(x0, y, r[1]); g.add(rung);
      });
      [-w / 2, w / 2].forEach(function (x) {
        var rung = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, w), red);
        rung.position.set(x0 + x, y, 0); g.add(rung);
      });
    }
    var roof = new THREE.Mesh(new THREE.ConeGeometry(0.25, 2.2, 6), grey);
    roof.position.set(x0, hT + 1.1, 0); g.add(roof);
    // Braço: gira em volta da torre (pivô) e se afasta antes da decolagem.
    var pivot = new THREE.Group();
    pivot.position.set(x0 + w / 2, H * 0.78, 0);
    var arm = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 0.55), grey);
    arm.position.set(1.0, 0, 0); pivot.add(arm);
    g.add(pivot);
    g.userData.arm = pivot;
    return g;
  }

  function create(look, opts) {
    var scrub = !!(opts && opts.scrub);
    var scene = new THREE.Scene();
    var horizon = new THREE.Color(0xe39a68);
    scene.fog = new THREE.Fog(horizon.getHex(), 130, 330);
    var dome = skyDome(); scene.add(dome);

    // Estrelas: aparecem quando o foguete sobe.
    var sp = [];
    for (var i = 0; i < 900; i++) {
      var v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(230);
      sp.push(v.x, v.y, v.z);
    }
    var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    var stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(stars);

    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x3a3a30, 0.75));
    var sun = new THREE.DirectionalLight(0xffc48a, 1.5); sun.position.set(45, 30, 60); scene.add(sun);   // entardecer, de frente para a câmera
    var fireLight = new THREE.PointLight(0xff8a3a, 0, 60, 2); fireLight.position.set(0, 0.5, 0); scene.add(fireLight);

    // Chão: vegetação baixa, base de concreto, valeta das chamas e morros ao longe.
    var ground = new THREE.Mesh(new THREE.CircleGeometry(400, 48), lambert(0x2c4a2b));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
    var padBase = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 0.6, 24), lambert(0x666a72));
    padBase.position.y = 0.25; scene.add(padBase);
    var trench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 14), lambert(0x2a2c31));
    trench.position.set(0, 0.56, 4); scene.add(trench);
    var stand = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.5, 12), lambert(0x5d6169));
    stand.position.y = 0.8; scene.add(stand);
    for (var hI = 0; hI < 14; hI++) {
      var a = hI / 14 * Math.PI * 2 + Math.random() * 0.3, rr = 150 + Math.random() * 70;
      var hill = new THREE.Mesh(new THREE.ConeGeometry(18 + Math.random() * 26, 6 + Math.random() * 16, 5), lambert(hI % 3 ? 0x2f4a36 : 0x3b4e3a, true));
      hill.position.set(Math.cos(a) * rr, 2, Math.sin(a) * rr); scene.add(hill);
    }
    [[24, -20], [-22, 18], [-26, -16]].forEach(function (p) {     // para-raios, longe da câmera
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, H * 1.25, 6), lambert(0x9aa0a8));
      pole.position.set(p[0], H * 0.62, p[1]); scene.add(pole);
    });
    var tw = tower(); scene.add(tw);

    // Foguete: o mesmo modelo da vista orbital, em escala de chão.
    var rocket = P && P.build ? P.build(look) : new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.9, 12), lambert(0xffffff));
    rocket.scale.setScalar(K);
    var base = new THREE.Group(); base.add(rocket);
    rocket.position.y = 0.14 * K + 1.05;          // motores apoiados na base de lançamento
    scene.add(base);
    var ud = rocket.userData || {};
    if (ud.flame2) ud.flame2.visible = false;
    if (ud.flame1) ud.flame1.visible = false;

    // Brilho do fogo na base (sprite aditivo).
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.35, 'rgba(255,150,60,0.8)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    glow.scale.set(7, 7, 1); scene.add(glow);

    // Fumaça: partículas grandes que sobem, se espalham e esmaecem.
    var NS = 700, spos = new Float32Array(NS * 3), scol = new Float32Array(NS * 3), sdat = [];
    for (var s = 0; s < NS; s++) { spos[s * 3 + 1] = -999; sdat.push({ life: 0, max: 1, v: new THREE.Vector3() }); }
    var smg = new THREE.BufferGeometry();
    smg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    smg.setAttribute('color', new THREE.BufferAttribute(scol, 3));
    var sc2 = document.createElement('canvas'); sc2.width = sc2.height = 64;
    var sx = sc2.getContext('2d'), sgr = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sgr.addColorStop(0, 'rgba(255,255,255,0.9)'); sgr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); sgr.addColorStop(1, 'rgba(255,255,255,0)');
    sx.fillStyle = sgr; sx.fillRect(0, 0, 64, 64);
    var smoke = new THREE.Points(smg, new THREE.PointsMaterial({ size: 4.2, map: new THREE.CanvasTexture(sc2), vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
    smoke.frustumCulled = false; scene.add(smoke);
    var sNext = 0;
    function puff(p, n, spread, up, shade) {
      for (var i = 0; i < n; i++) {
        var k = sNext = (sNext + 1) % NS, d = sdat[k];
        d.max = d.life = 2.5 + Math.random() * 2.5;
        var ang = Math.random() * Math.PI * 2, sp = spread * (0.4 + Math.random());
        d.v.set(Math.cos(ang) * sp, up * (0.3 + Math.random()), Math.sin(ang) * sp);
        spos[k * 3] = p.x + (Math.random() - 0.5); spos[k * 3 + 1] = p.y; spos[k * 3 + 2] = p.z + (Math.random() - 0.5);
        var g2 = shade * (0.85 + Math.random() * 0.15);
        scol[k * 3] = g2; scol[k * 3 + 1] = g2; scol[k * 3 + 2] = g2 * 1.02;
      }
    }
    function stepSmoke(dt) {
      for (var i = 0; i < NS; i++) {
        var d = sdat[i];
        if (d.life <= 0) { spos[i * 3 + 1] = -999; continue; }
        d.life -= dt;
        d.v.multiplyScalar(1 - 0.6 * dt); d.v.y += 0.4 * dt;
        spos[i * 3] += d.v.x * dt; spos[i * 3 + 1] += d.v.y * dt; spos[i * 3 + 2] += d.v.z * dt;
      }
      smg.attributes.position.needsUpdate = true; smg.attributes.color.needsUpdate = true;
    }

    var skyTint = new THREE.Color(), white = new THREE.Color(0xffffff), spaceCol = new THREE.Color(0x070a18);
    var tmp = new THREE.Vector3(), look0 = new THREE.Vector3();

    // Altura e inclinação do foguete no instante t (depois do zero).
    function flight(t) {
      var tt = Math.max(0, t - T0);
      var y = 0.5 * 0.65 * H * tt * tt + (tt > 3.5 ? 0.5 * 1.6 * H * Math.pow(tt - 3.5, 2) : 0);
      var pitch = -0.75 * smooth((tt - 3.0) / 4.0);
      var x = tt > 3 ? 0.35 * H * Math.pow(tt - 3, 2) : 0;
      return { y: y, x: x, pitch: pitch };
    }

    function update(t, dt, cam) {
      var ch = chapterAt(t), f = flight(t), out = { chapter: ch, done: t >= END, count: null, ignition: t >= IGNITION };
      if (scrub) {
        // Cancelado: nunca acende, nunca sai do chão.
        f = flight(0);
        out = { chapter: t < SCRUB_T ? ch : 'scrub', done: t >= SCRUB_END, count: null, ignition: false, scrub: true };
        ch = out.chapter;
      }
      // ---- Foguete
      base.position.set(f.x, f.y, 0);
      base.rotation.z = f.pitch;
      var nozzle = base.localToWorld(tmp.set(0, 1.0, 0)).clone();
      var burning = !scrub && t >= IGNITION;
      if (ud.flame1) {
        ud.flame1.visible = burning;
        var big = t < T0 + 0.6 ? 1.2 + (t - IGNITION) * 1.5 : 2.4;
        ud.flame1.scale.set(1.15, big * (0.85 + Math.random() * 0.3), 1.15);
      }
      glow.position.copy(nozzle).add(tmp.set(0, -0.8, 0));
      glow.material.opacity = burning ? 0.75 + Math.random() * 0.25 : 0;
      fireLight.position.copy(nozzle);
      fireLight.intensity = burning ? 3 + Math.random() * 1.5 : 0;
      // Fumaça: forte na base perto da decolagem, rastro durante a subida.
      if (burning && t < T0 + 3) puff(tmp.set(f.x, 0.9, 0), Math.round(dt * 260), 6, 1.2, 0.85);
      else if (burning) puff(nozzle.clone(), Math.round(dt * 70), 0.8, -1.5, 0.95);
      stepSmoke(dt);
      // ---- Braço da torre recua durante a contagem
      tw.userData.arm.rotation.y = -1.4 * smooth((t - 7.2) / 1.4) * (scrub ? 1 - smooth((t - SCRUB_T - 1) / 2) : 1);
      // Cancelado: luzes vermelhas de alarme piscando na plataforma.
      if (scrub && ch === 'scrub') {
        fireLight.color.setHex(0xff2a2a);
        fireLight.position.set(0, H * 0.3, 0);
        fireLight.intensity = Math.floor(t * 3) % 2 ? 6 : 0.5;
      }
      // ---- Céu escurece com a altura, estrelas aparecem
      var space = smooth((f.y - H * 2) / (H * 14));
      dome.material.color.copy(white).lerp(spaceCol, space);
      scene.fog.color.copy(skyTint.set(0xe39a68)).lerp(spaceCol, space);
      scene.fog.far = 250 + space * 400;
      stars.material.opacity = smooth((space - 0.2) / 0.6);
      // ---- Contagem
      if (ch === 'count') out.count = Math.max(1, Math.ceil(T0 - t));
      if (ch === 'scrub') out.count = null;
      // ---- Câmera de cada cena
      var rc = new THREE.Vector3(f.x, f.y + H * 0.5, 0);
      if (ch === 'pad') {
        var a = 0.95 - 0.5 * (t / 3.5), rr = H * (3.2 - 0.6 * t / 3.5);
        cam.position.set(Math.cos(a) * rr, H * 0.42, Math.sin(a) * rr);
        look0.set(0, H * 0.5, 0);
      } else if (ch === 'poll') {
        var pp = (t - 3.5) / 3;
        cam.position.set(H * (0.75 - 0.15 * pp), H * (0.98 + 0.05 * pp), H * (0.55 + 0.1 * pp));
        look0.set(0, H * 0.86, 0);
      } else if (ch === 'scrub') {
        // Câmera se afasta devagar: o foguete parado na plataforma, alarme piscando.
        var sp = smooth((t - SCRUB_T) / (SCRUB_END - SCRUB_T));
        cam.position.set(H * (1.05 + 1.3 * sp), H * (0.1 + 0.35 * sp), H * (0.85 + 1.6 * sp));
        look0.set(0, H * 0.45, 0);
      } else if (ch === 'count' || ch === 'liftoff') {
        cam.position.set(H * 1.05, H * 0.07, H * 0.85);
        look0.copy(ch === 'count' ? tmp.set(0, H * 0.55, 0) : rc);
        if (burning) {            // tremor do chão
          var shake = 0.12 * (ch === 'liftoff' ? Math.max(0, 1 - (t - T0) / 3.5) + 0.2 : 0.6);
          cam.position.x += (Math.random() - 0.5) * shake; cam.position.y += (Math.random() - 0.5) * shake;
        }
      } else {
        // Perseguição: ao lado e um pouco abaixo do foguete, afastando aos poucos.
        var pa = smooth((t - 15) / 3.6);
        cam.position.set(f.x + H * (1.4 + 1.2 * pa), f.y + H * (0.2 - 0.5 * pa), H * (1.6 + 1.6 * pa));
        look0.copy(rc);
      }
      cam.lookAt(look0);
      return out;
    }

    function dispose() {
      scene.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach(function (mt) { if (!(mt.userData && mt.userData.shared)) { if (mt.map) mt.map.dispose(); mt.dispose(); } });
      });
    }

    return { scene: scene, update: update, dispose: dispose, rocketHeight: H, end: scrub ? SCRUB_END : END };
  }

  MS.launchScene = { create: create, CHAPTERS: CHAPTERS, END: END, T0: T0, SCRUB_T: SCRUB_T, SCRUB_END: SCRUB_END, chapterAt: chapterAt };
})(globalThis);
