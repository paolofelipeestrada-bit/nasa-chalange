/* =====================================================================
 * ui/tutorial.js — TOUR GUIADO (opcional; aberto pelo menu inicial)
 *
 *   MS.tutorial.start() / stop() / next() / prev() / demoState(kind, phase)
 *
 * Os passos ficam em js/data/tutorial.js. O tour desenha um projeto de
 * EXEMPLO (ui.render com um state montado aqui) sem passar pelo store:
 * nada é salvo e, ao sair, a tela volta ao projeto do jogador.
 * Um véu escuro bloqueia cliques no jogo; só o balão responde.
 * Teclado: → / Enter avança, ← volta, Esc sai.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h;
  var t = MS.i18n.t, L = MS.i18n.L;

  var tut = MS.tutorial = { active: false, index: 0 };
  var els = null, saved = null, shownKey = null;

  function steps() { return (MS.data.tutorial && MS.data.tutorial.steps) || []; }

  // Projeto de exemplo para uma fase: vazio, só o conceito, ou completo.
  tut.demoState = function (kind, phase) {
    var base = MS.store.state || MS.store.createState();
    var s = MS.store.createState(base.scenarioId, base.difficulty);
    var sc = MS.levels ? MS.levels.scenario(s) : MS.data.scenarios[s.scenarioId], want = (MS.data.tutorial && MS.data.tutorial.demoDesign) || {};
    if (kind === 'concept' || kind === 'full') {
      sc.slots.forEach(function (slot) {
        if (kind === 'concept' && slot.phase !== 'concept') return;
        s.design[slot.id] = slot.options.indexOf(want[slot.id]) !== -1 ? want[slot.id] : slot.options[0];
      });
      if (MS.levels) s.design = MS.levels.autoFill(sc, s.design);
    }
    if (phase) { s.phase = phase; s.reached = phase; }
    return s;
  };

  // Fase e projeto de cada passo (passos sem phase herdam o anterior).
  function sceneFor(i) {
    var list = steps(), phase = null, demo = 'empty';
    for (var k = 0; k <= i; k++) { if (list[k].phase) { phase = list[k].phase; demo = list[k].demo || 'empty'; } }
    return { phase: phase || 'need', demo: demo };
  }

  function show() {
    var list = steps(), st = list[tut.index];
    if (!st) { tut.stop(); return; }
    var sc = sceneFor(tut.index), key = sc.phase + ':' + sc.demo + ':' + MS.i18n.locale();
    if (key !== shownKey) {
      ui.local.prevState = null; // sem "efeito cascata" entre telas de exemplo
      ui.local.menuOpen = false;
      ui.render(tut.demoState(sc.demo, sc.phase));
      shownKey = key;
    }
    var target = st.target ? document.querySelector(st.target) : null;
    if (target && target.closest('.top')) {
      root.scrollTo(0, 0); // o topo gruda escondendo a parte de cima: no início da página ele aparece inteiro
    } else if (target && target.scrollIntoView && getComputedStyle(target).position !== 'fixed') {
      var narrow = root.innerWidth < 640; // celular: alvo no alto, balão embaixo
      try { target.scrollIntoView({ block: narrow ? 'start' : 'center', behavior: 'instant' }); } catch (e) { target.scrollIntoView(); }
      if (narrow) {
        var stick = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stick-h')) || 0;
        root.scrollBy(0, -(stick + 10));
      }
    }
    els.card.innerHTML =
      '<div class="tut-top"><span class="tut-count">' + h.esc(t('tut.count', { n: tut.index + 1, total: list.length })) + '</span>' +
        '<button type="button" class="tut-x" data-tut="stop" aria-label="' + h.esc(t('tut.skip')) + '">×</button></div>' +
      '<h2 id="tut-title">' + h.esc(L(st.title)) + '</h2><p>' + h.esc(L(st.text)) + '</p>' +
      '<div class="tut-bar"><span class="tut-dots" aria-hidden="true">' + list.map(function (x, k) { return '<i' + (k === tut.index ? ' class="on"' : k < tut.index ? ' class="done"' : '') + '></i>'; }).join('') + '</span>' +
        (tut.index > 0 ? '<button type="button" class="btn small" data-tut="prev">← ' + h.esc(t('ui.back')) + '</button>' : '<button type="button" class="btn small" data-tut="stop">' + h.esc(t('tut.skip')) + '</button>') +
        '<button type="button" class="btn small primary" data-tut="next">' + h.esc(tut.index === list.length - 1 ? t('tut.finish') : t('tut.next')) + ' →</button></div>';
    els.target = target;
    place();
    var nb = els.card.querySelector('[data-tut="next"]');
    if (nb) { try { nb.focus({ preventScroll: true }); } catch (e) { nb.focus(); } }
  }

  // Posiciona o recorte iluminado e o balão (embaixo, em cima ou no meio).
  function place() {
    if (!els) return;
    var vw = root.innerWidth, vh = root.innerHeight, card = els.card, hole = els.hole;
    var r = els.target && els.target.isConnected ? els.target.getBoundingClientRect() : null;
    if (r && (r.width === 0 || r.bottom < 0 || r.top > vh)) r = null;
    var pad = 8;
    if (r) {
      var top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
      var bottom = Math.min(vh - 4, r.bottom + pad), right = Math.min(vw - 4, r.right + pad);
      hole.style.cssText = 'display:block;top:' + top + 'px;left:' + left + 'px;width:' + (right - left) + 'px;height:' + (bottom - top) + 'px';
      els.veil.classList.add('has-hole');
    } else {
      hole.style.display = 'none';
      els.veil.classList.remove('has-hole');
    }
    var cw = Math.min(400, vw - 24);
    card.style.width = cw + 'px';
    var ch = card.offsetHeight, x, y;
    if (!r) { x = (vw - cw) / 2; y = (vh - ch) / 2; }
    else if (vw < 640) { x = 12; y = r.top > vh - ch - 24 ? 12 : vh - ch - 12; }
    else {
      x = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), vw - cw - 12);
      if (r.bottom + pad + 14 + ch < vh) y = r.bottom + pad + 14;
      else if (r.top - pad - 14 - ch > 0) y = r.top - pad - 14 - ch;
      else { // alvo grande: balão ao lado, ou no canto de baixo
        y = Math.max(12, Math.min(vh - ch - 12, r.top + 12));
        x = r.right + 14 + cw < vw ? r.right + 14 : r.left - 14 - cw > 0 ? r.left - 14 - cw : vw - cw - 12;
        if (x === vw - cw - 12) y = vh - ch - 12;
      }
    }
    card.style.left = Math.round(x) + 'px';
    card.style.top = Math.round(y) + 'px';
  }

  function onKey(e) {
    if (!tut.active) return;
    if (e.key === 'Escape') { e.preventDefault(); tut.stop(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); tut.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); tut.prev(); }
  }
  var raf = 0;
  function onMove() { if (!raf) raf = root.requestAnimationFrame(function () { raf = 0; place(); }); }

  tut.start = function () {
    if (tut.active || !steps().length || !root.document) return;
    saved = { cascade: ui.local.cascade, scrollY: root.scrollY || 0, menuOpen: ui.local.menuOpen };
    tut.active = true; tut.index = 0; shownKey = null;
    var veil = document.createElement('div'); veil.className = 'tut-veil';
    var hole = document.createElement('div'); hole.className = 'tut-hole';
    var card = document.createElement('div'); card.className = 'tut-card';
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'tut-title');
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tut]');
      if (b) tut[b.dataset.tut]();
    });
    // O véu engole cliques e rolagem do jogo por baixo.
    veil.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
    document.body.appendChild(veil); document.body.appendChild(hole); document.body.appendChild(card);
    document.body.classList.add('tut-on');
    els = { veil: veil, hole: hole, card: card, target: null };
    document.addEventListener('keydown', onKey, true);
    root.addEventListener('resize', onMove);
    root.addEventListener('scroll', onMove, true);
    show();
  };

  tut.next = function () { if (!tut.active) return; if (tut.index >= steps().length - 1) { tut.stop(); return; } tut.index++; show(); };
  tut.prev = function () { if (!tut.active || tut.index === 0) return; tut.index--; show(); };

  tut.stop = function () {
    if (!tut.active) return;
    tut.active = false;
    document.removeEventListener('keydown', onKey, true);
    root.removeEventListener('resize', onMove);
    root.removeEventListener('scroll', onMove, true);
    ['veil', 'hole', 'card'].forEach(function (k) { if (els[k].parentNode) els[k].parentNode.removeChild(els[k]); });
    document.body.classList.remove('tut-on');
    els = null; shownKey = null;
    // De volta ao projeto do jogador, como estava (fora do menu: ele acabou de ver o jogo).
    ui.local.prevState = null;
    ui.local.cascade = saved ? saved.cascade : null;
    ui.local.menuOpen = false;
    if (MS.store.state) ui.render(MS.store.state);
    root.scrollTo(0, 0);
    saved = null;
  };
})(globalThis);
