/* =====================================================================
 * ui/calcs.js — "CALCULE VOCÊ MESMO" (painel do modo Difícil)
 *
 * Mostra os desafios de js/data/calcs.js da fase atual com os números do
 * projeto do jogador. Ele digita a resposta e confere (±3%); pode abrir a
 * resolução passo a passo. As respostas ficam só nesta tela (ui.local):
 * não mexem no projeto nem na nota.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h;
  var t = MS.i18n.t, L = MS.i18n.L, fmt = MS.sim.util.fmt;
  var TOL = 0.03;
  var local = ui.local;
  local.calc = local.calc || {};      // id → { ok, val, ans }
  local.calcDraft = local.calcDraft || {};
  local.calcShow = local.calcShow || {};

  function rerender() { if (MS.store.state) ui.render(MS.store.state); }
  function hard(state) { var d = MS.levels && MS.levels.def(MS.levels.id(state)); return !!(d && d.ui === 'full'); }
  function list() { return (MS.data.calcs || []); }
  function find(id) { return list().filter(function (c) { return c.id === id; })[0]; }

  var SYM = { mu: 'μ', R: 'R⊕' }; // símbolos das equações
  var SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  // Número legível: muito pequeno ou muito grande vira notação científica (5,5 × 10⁻⁶).
  function num(x, dec) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    var ax = Math.abs(x);
    if (ax !== 0 && (ax < 0.01 || ax >= 1e7)) {
      var e = Math.floor(Math.log10(ax)), mant = x / Math.pow(10, e);
      return fmt(mant, 2) + ' × 10' + String(e).split('').map(function (c) { return SUP[c]; }).join('');
    }
    return fmt(x, dec != null ? dec : ax >= 1000 ? 0 : ax >= 100 ? 1 : ax >= 1 ? 2 : 3);
  }
  function fill(text, vals) { return text.replace(/\{(\w+)\}/g, function (m, k) { return vals[k] != null ? vals[k] : m; }); }
  function parse(s) {
    if (s == null) return NaN;
    s = String(s).trim().replace(/\s/g, '');
    if (/,\d{1,2}$/.test(s) || (s.indexOf(',') !== -1 && s.indexOf('.') === -1)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    return parseFloat(s);
  }
  function check(ans, x) {
    if (!isFinite(x)) return 'nan';
    var err = Math.abs(x - ans) / Math.max(Math.abs(ans), 1e-12);
    if (err <= TOL || Math.abs(x - ans) < 0.05) return 'ok';
    var r = Math.abs(x / ans);
    if ([10, 100, 1000, 60, 1e6].some(function (k) { return Math.abs(r - k) / k < 0.05 || Math.abs(r - 1 / k) * k < 0.05; })) return 'units';
    return 'no';
  }

  function card(state, result, c) {
    var m = result.metrics, g = c.given(m, result.selection), ans = c.answer(m);
    if (!g || ans == null) {
      return '<li class="calc locked"><div class="calc-top"><b>' + h.esc(L(c.title)) + '</b><code class="calc-eq">' + h.esc(c.formula) + '</code></div>' +
        '<p class="small muted">' + h.esc(t('calc.locked')) + '</p></li>';
    }
    var st = local.calc[c.id];
    if (st && Math.abs(st.ans - ans) > 1e-9) { delete local.calc[c.id]; st = null; } // projeto mudou: novo problema
    var vals = { answer: num(ans, c.decimals) };
    Object.keys(g).forEach(function (k) { vals[k] = num(g[k][0]); });
    if (c.work) { var w = c.work(m); Object.keys(w).forEach(function (k) { vals[k] = num(w[k]); }); }
    var givens = Object.keys(g).map(function (k) {
      return '<li><code>' + h.esc(SYM[k] || k) + ' = ' + h.esc(vals[k]) + (g[k][1] ? ' ' + h.esc(g[k][1]) : '') + '</code> <span class="muted">' + h.esc(L(g[k][2])) + '</span></li>';
    }).join('');
    var fb = '';
    if (st) {
      fb = st.res === 'ok' ? '<p class="calc-fb ok">' + h.icon('ok', { size: 15, stroke: 3 }) + h.esc(t('calc.right', { v: vals.answer, u: c.unit })) + '</p>'
        : '<p class="calc-fb no">' + h.icon('warn', { size: 15 }) + h.esc(t(st.res === 'units' ? 'calc.units' : st.res === 'nan' ? 'calc.nan' : 'calc.wrong')) + '</p>';
    }
    var steps = local.calcShow[c.id]
      ? '<ol class="calc-steps">' + c.steps.map(function (s) { return '<li><code>' + h.esc(fill(L(s), vals)) + '</code></li>'; }).join('') + '</ol>' : '';
    var draft = local.calcDraft[c.id] != null ? local.calcDraft[c.id] : st ? st.val : '';
    return '<li class="calc' + (st && st.res === 'ok' ? ' solved' : '') + '"><div class="calc-top"><b>' + h.esc(L(c.title)) + '</b><code class="calc-eq">' + h.esc(c.formula) + '</code></div>' +
      '<p class="calc-why">' + h.esc(L(c.why)) + '</p>' +
      '<div class="calc-body"><div><span class="calc-cap">' + h.esc(t('calc.given')) + '</span><ul class="calc-given">' + givens + '</ul></div>' +
      '<div class="calc-ans"><label><span class="calc-cap">' + h.esc(t('calc.yours')) + '</span>' +
        '<span class="calc-row"><input class="calc-in" data-calc="' + h.esc(c.id) + '" inputmode="decimal" autocomplete="off" value="' + h.esc(draft) + '" aria-label="' + h.esc(L(c.title)) + '">' +
        (c.unit ? '<span class="calc-u">' + h.esc(c.unit) + '</span>' : '') + '</span></label>' +
        '<span class="calc-btns"><button type="button" class="btn small primary" data-action="calc-check" data-id="' + h.esc(c.id) + '">' + h.esc(t('calc.check')) + '</button>' +
        '<button type="button" class="btn small" data-action="calc-show" data-id="' + h.esc(c.id) + '">' + h.esc(t(local.calcShow[c.id] ? 'calc.hide' : 'calc.show')) + '</button></span>' +
        fb + '</div></div>' + steps + '</li>';
  }

  ui.calcPanel = function (state, result) {
    if (!hard(state) || (MS.tutorial && MS.tutorial.active)) return '';
    var mine = list().filter(function (c) { return c.phase === state.phase; });
    if (!mine.length) return '';
    var solved = mine.filter(function (c) { var s = local.calc[c.id]; return s && s.res === 'ok'; }).length;
    return '<section class="card calc-panel"><div class="row-head"><h2>🧮 ' + h.esc(t('calc.title')) + '</h2>' +
      '<span class="calc-count">' + h.esc(t('calc.count', { n: solved, total: mine.length })) + '</span></div>' +
      '<p class="section-note">' + h.esc(t('calc.note')) + '</p><ol class="calc-list">' +
      mine.map(function (c) { return card(state, result, c); }).join('') + '</ol></section>';
  };

  Object.assign(ui.actions, {
    'calc-check': function (d) {
      var c = find(d.id), r = MS.sim.run(MS.store.state), ans = c && c.answer(r.metrics);
      if (ans == null) return;
      var val = local.calcDraft[d.id] != null ? local.calcDraft[d.id] : '';
      local.calc[d.id] = { res: check(ans, parse(val)), val: val, ans: ans };
      rerender();
    },
    'calc-show': function (d) { local.calcShow[d.id] = !local.calcShow[d.id]; rerender(); }
  });

  // Guarda o que a pessoa digita (a tela é redesenhada a cada ação) e Enter confere.
  if (root.document) {
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el && el.classList && el.classList.contains('calc-in')) local.calcDraft[el.dataset.calc] = el.value;
    });
    document.addEventListener('keydown', function (e) {
      var el = e.target;
      if (e.key === 'Enter' && el && el.classList && el.classList.contains('calc-in')) { e.preventDefault(); ui.actions['calc-check']({ id: el.dataset.calc }); }
    });
  }
  ui.calcCheck = check; // usado nos testes
  ui.calcParse = parse;
})(globalThis);
