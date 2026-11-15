/* =====================================================================
 * ui/coach.js — BALÕES DE ENSINO (guia passo a passo, leve)
 *
 * Na primeira vez em cada fase, um balão pequeno aponta para uma parte da
 * tela e explica em uma frase o que ela faz. "Próximo" anda, "Pular" fecha
 * os balões da fase. O botão "Dicas" (topo) mostra de novo.
 *
 *   MS.coach.attach(rootEl, state)  chamado depois de cada render()
 *   MS.coach.start(phaseId)         mostra os balões da fase desde o 1º
 *   MS.coach.STEPS                  { fase: [{ at: seletor CSS, key: texto }] }
 *
 * Textos: chaves coach.<fase>.<n> nos 3 idiomas. Passo cujo alvo não está
 * na tela é pulado. O que já foi visto fica no navegador de quem joga
 * (localStorage), não no state da partida.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, t = MS.i18n.t;
  var KEY = 'spaceTinkers.coachSeen';

  var STEPS = {
    need: [
      { at: '.lobby', key: 'coach.need.1' },
      { at: '.scen-grid', key: 'coach.need.2' },
      { at: '.hud', key: 'coach.need.3' },
      { at: '[data-action="glossary"]', key: 'coach.need.4' }
    ],
    concept: [
      { at: '.slot', key: 'coach.concept.1' },
      { at: '.option', key: 'coach.concept.2' },
      { at: '.hangar-card', key: 'coach.concept.3' },
      { at: '.orb-panel', key: 'coach.concept.4' }
    ],
    requirements: [
      { at: 'main .card', key: 'coach.requirements.1' }
    ],
    design: [
      { at: '.ck-tabs', key: 'coach.design.1' },
      { at: '.ck-ripple', key: 'coach.design.2' },
      { at: '.ck-checks', key: 'coach.design.3' },
      { at: '.ck-crew', key: 'coach.design.4' }
    ],
    build: [
      { at: '.gonogo', key: 'coach.build.1' },
      { at: '.predict', key: 'coach.build.2' },
      { at: '.launch-window', key: 'coach.build.3' },
      { at: '.nav .btn.primary', key: 'coach.build.4' }
    ],
    implement: [
      { at: '.viz-card', key: 'coach.implement.1' },
      { at: '.decision', key: 'coach.implement.2' },
      { at: '.life-charts', key: 'coach.implement.3' }
    ],
    report: [
      { at: '.score', key: 'coach.report.1' },
      { at: '.lcards', key: 'coach.report.2' },
      { at: '.credits', key: 'coach.report.3' }
    ]
  };

  function load() { try { return JSON.parse(root.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(seen) { try { root.localStorage.setItem(KEY, JSON.stringify(seen)); } catch (e) { /* sem armazenamento: tudo bem */ } }

  var cur = null;          // { phase, i }
  var bubble = null, rootEl = null, lastPhase = null;

  function reduced() { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function steps(phase) {
    return (STEPS[phase] || []).filter(function (s) { return rootEl && document.querySelector(s.at); });
  }
  function close(markSeen) {
    if (cur && markSeen) { var seen = load(); seen[cur.phase] = true; save(seen); }
    cur = null;
    clearTarget();
    if (bubble) { bubble.remove(); bubble = null; }
  }
  function clearTarget() {
    var old = document.querySelectorAll('.coach-on');
    for (var i = 0; i < old.length; i++) old[i].classList.remove('coach-on');
  }

  function show(scroll) {
    if (!cur) return;
    var list = steps(cur.phase);
    if (!list.length || cur.i >= list.length) { close(true); return; }
    var step = list[cur.i], el = document.querySelector(step.at);
    clearTarget();
    el.classList.add('coach-on');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'coach';
      bubble.setAttribute('role', 'dialog');
      bubble.setAttribute('aria-live', 'polite');
      document.body.appendChild(bubble);
      bubble.addEventListener('click', function (e) {
        var b = e.target.closest('[data-coach]');
        if (!b) return;
        if (b.dataset.coach === 'next') { cur.i++; show(true); }
        else if (b.dataset.coach === 'back') { cur.i = Math.max(0, cur.i - 1); show(true); }
        else close(true);
      });
    }
    var last = cur.i === list.length - 1;
    bubble.setAttribute('aria-label', t('coach.title'));
    bubble.innerHTML = '<div class="coach-top"><span class="coach-n pixel">' + (cur.i + 1) + '/' + list.length + '</span>' +
      '<button type="button" class="coach-x" data-coach="skip" aria-label="' + MS.ui.h.esc(t('coach.skip')) + '">×</button></div>' +
      '<p>' + MS.ui.h.rich(t(step.key)) + '</p>' +
      '<div class="coach-btns">' + (cur.i > 0 ? '<button type="button" class="coach-b ghost" data-coach="back">' + MS.ui.h.esc(t('coach.back')) + '</button>' : '<button type="button" class="coach-b ghost" data-coach="skip">' + MS.ui.h.esc(t('coach.skip')) + '</button>') +
      '<button type="button" class="coach-b" data-coach="next">' + MS.ui.h.esc(t(last ? 'coach.done' : 'coach.next')) + '</button></div><span class="coach-arrow" aria-hidden="true"></span>';
    if (scroll && !el.closest('.top')) {
      var r0 = el.getBoundingClientRect();
      if (r0.top < 220 || r0.bottom > root.innerHeight - 90) el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    }
    place(el);
    if (scroll) setTimeout(function () { if (bubble && el.isConnected) place(el); }, reduced() ? 0 : 420);
    var nb = bubble.querySelector('[data-coach="next"]');
    if (nb && scroll) { try { nb.focus({ preventScroll: true }); } catch (e) { nb.focus(); } }
  }

  // Balão abaixo do alvo (ou acima, se não couber); fixo quando o alvo está no topo grudado.
  function place(el) {
    if (!bubble) return;
    var fixed = !!el.closest('.top');
    var r = el.getBoundingClientRect(), bw = Math.min(320, root.innerWidth - 24), bh = bubble.offsetHeight || 140;
    var left = Math.max(12, Math.min(r.left + Math.min(r.width, 360) / 2 - bw / 2, root.innerWidth - bw - 12));
    var below = r.bottom + 12 + bh < root.innerHeight - 70 || r.top < bh + 24;
    var top = below ? r.bottom + 12 : r.top - bh - 12;
    bubble.style.position = fixed ? 'fixed' : 'absolute';
    bubble.style.width = bw + 'px';
    bubble.style.left = left + 'px';
    bubble.style.top = (fixed ? top : top + root.scrollY) + 'px';
    bubble.classList.toggle('above', !below);
    var ax = Math.max(16, Math.min(r.left + Math.min(r.width, 360) / 2 - left, bw - 16));
    bubble.style.setProperty('--ax', ax + 'px');
  }

  function start(phase) {
    cur = { phase: phase, i: 0 };
    show(true);
  }

  function attach(el, state) {
    rootEl = el;
    // Nada de balões por cima do menu inicial ou do tour guiado (js/ui/tutorial.js).
    // Quem fez o tour já viu cada parte da tela: os balões automáticos não voltam.
    if (MS.tutorial && MS.tutorial.active) { close(false); lastPhase = null; var all = load(); all.off = true; save(all); return; }
    if (MS.ui.local.menuOpen) { close(false); lastPhase = null; return; }
    if (lastPhase !== state.phase) {
      lastPhase = state.phase;
      close(false);
      // Primeira vez nesta fase: espera o 3D e a rolagem assentarem.
      if (!load()[state.phase] && !load().off) setTimeout(function () { if (MS.store.state && MS.store.state.phase === state.phase && !cur) start(state.phase); }, 500);
      return;
    }
    if (cur) show(false);   // a tela foi redesenhada: reposiciona no alvo novo
  }

  if (root.addEventListener) {
    root.addEventListener('resize', function () { if (cur) show(false); });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur) close(true); });
  }

  MS.coach = { attach: attach, start: start, close: close, STEPS: STEPS, reset: function () { save({}); } };
})(globalThis);
