/* =====================================================================
 * mission-life.js — PEÇAS DA MISSÃO NO TEMPO (interface)
 *
 *   ui.life.periodPicker(state)       escolha da data de lançamento
 *   ui.life.decision(pending)         cartão de decisão (pausa a missão)
 *   ui.life.chart(life)               3 gráficos pequenos: altitude,
 *                                     memória e energia, com as
 *                                     tempestades reais marcadas
 *   ui.life.diary(life)               diário com os eventos reais
 *   ui.life.stats(life)               números finais em uma linha
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h, U = MS.sim.util;
  var t = MS.i18n.t, L = MS.i18n.L;

  function sw() { return MS.data.spaceWeather; }
  function link(type, id) {
    return id ? ' <a class="src-link" href="' + h.esc(sw().viewUrl + type + '/' + id + '/-1') + '" target="_blank" rel="noopener">' +
      h.esc(t('life.donki')) + '</a>' : '';
  }
  function niceDate(iso) {
    try { return new Date(iso + 'T12:00:00Z').toLocaleDateString(MS.i18n.locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
    catch (e) { return iso; }
  }

  // --------------------------------------------- Data de lançamento
  function periodPicker(state, locked) {
    var P = sw().periods;
    var cards = Object.keys(P).map(function (id) {
      var p = P[id], on = state.period === id, n = p.totals;
      return '<button type="button" class="scen' + (on ? ' selected' : '') + '" data-action="period" data-id="' + id + '" aria-pressed="' + on + '"' + (locked ? ' disabled' : '') + '>' +
        '<span class="scen-ic" aria-hidden="true">' + p.icon + '</span>' +
        '<span class="scen-title">' + h.esc(L(p.name)) + '</span>' +
        '<span class="scen-pitch">' + h.esc(L(p.pitch)) + '</span>' +
        '<span class="scen-meta">' + h.esc(t('life.period.counts', { gst: n.gst, x: n.flrX, sep: n.sep })) + '</span>' +
        (on ? '<span class="scen-on">✓ ' + h.esc(t('ui.chosen')) + '</span>' : '') + '</button>';
    }).join('');
    return '<div class="card"><h2>' + h.esc(t('life.period.title')) + '</h2>' +
      '<p class="section-note">' + h.esc(t('life.period.note')) + '</p>' +
      '<div class="scen-grid">' + cards + '</div>' +
      '<p class="small muted">' + h.esc(t('life.period.source')) + '</p></div>';
  }

  // ------------------------------------------------------- Decisão
  function decision(pending, locked) {
    var id = pending.id, c = pending.ctx || {};
    var text;
    if (id === 'storm') {
      text = h.esc(t(c.kind === 'storm' ? 'life.dec.storm.storm' : 'life.dec.storm.radiation', { kp: c.kp == null ? '' : U.fmt(c.kp, 1), date: niceDate(c.date) })) +
        link(c.kind === 'storm' ? 'GST' : 'SEP', c.id);
    } else if (id === 'memory') {
      text = h.esc(t('life.dec.memory.text', { day: pending.day + 1 }));
    } else {
      text = h.esc(t('life.dec.power.text', { day: pending.day + 1, gen: U.fmt(c.gen, 1), use: U.fmt(c.use, 1) }));
    }
    var opts = pending.options.map(function (o) {
      return '<button type="button" class="choice" data-action="decide" data-id="' + id + '" data-choice="' + o + '"' + (locked ? ' disabled' : '') + '>' +
        '<span class="choice-title">' + h.esc(t('life.opt.' + id + '.' + o)) + '</span>' +
        '<span class="choice-text">' + h.esc(t('life.optx.' + id + '.' + o)) + '</span></button>';
    }).join('');
    return '<div class="card decision" role="region" aria-live="polite"><div class="decision-head"><span class="decision-ic" aria-hidden="true">!</span>' +
      '<div><div class="eyebrow">' + h.esc(t('life.paused', { day: pending.day + 1, date: niceDate(pending.date) })) + '</div>' +
      '<h2>' + h.esc(t('life.dec.' + id + '.title')) + '</h2></div></div>' +
      '<p>' + text + '</p><p class="small muted">' + h.esc(t('life.dec.rule')) + '</p>' +
      '<div class="choices">' + opts + '</div></div>';
  }

  // ------------------------------------------------------- Gráficos
  // Três painéis pequenos com o mesmo eixo de dias da missão.
  function panel(x0, title, pts, yMin, yMax, fmtY, opts) {
    var W = 224, H = 92, top = 26; x0 = 8;
    var X = function (d) { return x0 + d / opts.days * W; };
    var Y = function (v) { return top + H - (Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin || 1) * H; };
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.d).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join('');
    var marks = (opts.marks || []).map(function (m) {
      return '<line class="lc-mark" x1="' + X(m.d) + '" x2="' + X(m.d) + '" y1="' + top + '" y2="' + (top + H) + '"/>' +
        (m.label ? '<text class="lc-mlabel" x="' + (X(m.d) + 2) + '" y="' + (top + 9) + '">' + h.esc(m.label) + '</text>' : '');
    }).join('');
    var ref = opts.ref != null ? '<line class="lc-ref" x1="' + x0 + '" x2="' + (x0 + W) + '" y1="' + Y(opts.ref) + '" y2="' + Y(opts.ref) + '"/>' : '';
    var last = pts[pts.length - 1];
    return '<svg class="life-chart" viewBox="0 0 240 136" role="img" aria-label="' + h.esc(title) + '">' +
      '<text class="lc-title" x="' + x0 + '" y="14">' + h.esc(title) + '</text>' +
      '<rect class="lc-box" x="' + x0 + '" y="' + top + '" width="' + W + '" height="' + H + '"/>' + ref + marks +
      '<path class="lc-line ' + (opts.cls || '') + '" d="' + path + '"/>' +
      (last ? '<circle class="lc-dot ' + (opts.cls || '') + '" cx="' + X(last.d) + '" cy="' + Y(last.v) + '" r="3"/>' : '') +
      '<text class="lc-axis" x="' + (x0 + W) + '" y="' + (top + H + 14) + '" text-anchor="end">' + h.esc(fmtY(last ? last.v : 0)) + '</text>' +
      '<text class="lc-axis" x="' + x0 + '" y="' + (top + H + 14) + '">' + h.esc(t('life.chart.day', { d: 1 })) + '</text></svg>';
  }
  function chart(life, initialAlt) {
    if (!life || !life.series.length) return '';
    var s = life.series, days = life.days, h0 = initialAlt;
    var stormMarks = life.log.filter(function (e) { return e.type === 'storm'; })
      .map(function (e) { return { d: e.day, label: e.kp >= 8 ? 'Kp ' + U.fmt(e.kp, 0) : '' }; });
    var resetMarks = life.log.filter(function (e) { return e.type === 'reset'; }).map(function (e) { return { d: e.day }; });
    var alt = s.map(function (p) { return { d: p.d, v: p.h }; });
    var minH = Math.min.apply(null, alt.map(function (p) { return p.v; }));
    var mem = s.map(function (p) { return { d: p.d, v: p.memory * 100 }; });
    var pow = s.map(function (p) { return { d: p.d, v: p.power * 100 }; });
    var maxP = Math.max(150, Math.max.apply(null, pow.map(function (p) { return p.v; })));
    var svg = '<div class="life-charts">' +
      panel(0, t('life.chart.alt'), alt, Math.min(minH, h0 - 10), h0, function (v) { return U.fmt(v, 0) + ' km'; }, { days: days, marks: stormMarks, cls: 'lc-alt' }) +
      panel(252, t('life.chart.mem'), mem, 0, 100, function (v) { return U.fmt(v, 0) + '%'; }, { days: days, cls: 'lc-mem', ref: 80 }) +
      panel(504, t('life.chart.pow'), pow, 0, maxP, function (v) { return U.fmt(v, 0) + '%'; }, { days: days, cls: 'lc-pow', ref: 100, marks: resetMarks }) +
      '</div>';
    return '<div class="card"><h2>' + h.esc(t('life.chart.title')) + '</h2>' +
      '<p class="section-note">' + h.esc(t('life.chart.note')) + '</p>' + svg + '</div>';
  }

  // -------------------------------------------------------- Diário
  var KEEP = { launch: 9, storm: 99, safe: 2, alertIgnored: 2, sepProtected: 2, reset: 3, deficit: 9, memoryFull: 9, reentry: 9, batteryDead: 9, end: 9 };
  function diaryText(e) {
    var k = e.kind ? t('life.kind.' + e.kind) : '';
    switch (e.type) {
      case 'storm': return h.esc(t('life.log.storm', { kp: U.fmt(e.kp, 1), m: U.fmt(e.drop * 1000, 0) })) + link('GST', e.id);
      case 'reset': return h.esc(t('life.log.reset')) + link('SEP', e.id);
      case 'sepProtected': return h.esc(t('life.log.sepProtected')) + link('SEP', e.id);
      case 'safe': return h.esc(t('life.log.safe', { kind: k }));
      case 'alertIgnored': return h.esc(t('life.log.ignored', { kind: k }));
      case 'deficit': return h.esc(t('life.log.deficit', { gen: U.fmt(e.gen, 1), use: U.fmt(e.use, 1) }));
      case 'memoryFull': return h.esc(t('life.log.memory'));
      case 'reentry': return h.esc(t('life.log.reentry'));
      case 'batteryDead': return h.esc(t('life.log.battery'));
      case 'end': return h.esc(t('life.log.end'));
      default: return h.esc(t('life.log.launch'));
    }
  }
  function diary(life) {
    if (!life) return '';
    var seen = {};
    var items = life.log.filter(function (e) {
      if (e.type === 'storm' && e.kp < 8) return false; // as tempestades mais fortes; o total vai no rodapé
      seen[e.type] = (seen[e.type] || 0) + 1;
      return seen[e.type] <= (KEEP[e.type] || 0);
    }).map(function (e) {
      var bad = /reset|reentry|batteryDead|deficit|memoryFull/.test(e.type), good = /safe|sepProtected|end/.test(e.type);
      return '<li><div class="when">' + h.esc(niceDate(e.date)) + '<div class="small">' + h.esc(t('life.chart.day', { d: e.day + 1 })) + '</div></div>' +
        '<div class="small d-' + (bad ? 'bad' : good ? 'good' : 'neutral') + '">' + diaryText(e) + '</div></li>';
    }).join('');
    var ty = life.tally;
    return '<div class="card"><h2>' + h.esc(t('life.diary.title')) + '</h2><ol class="timeline">' + items + '</ol>' +
      '<p class="small muted">' + h.esc(t('life.diary.more', { a: ty.alerts, r: ty.resets, s: ty.safeDays, st: ty.storms })) + '</p></div>';
  }

  function stats(life) {
    if (!life) return '';
    var tl = life.totals;
    return t('life.stats', {
      h: U.fmt(tl.altitudeLoss, 1), p: U.fmt(tl.panels * 100, 0), r: life.tally.resets,
      lost: U.pct(tl.generated > 0 ? tl.lost / tl.generated : 0)
    });
  }

  ui.life = { periodPicker: periodPicker, decision: decision, chart: chart, diary: diary, stats: stats, niceDate: niceDate };
})(globalThis);
