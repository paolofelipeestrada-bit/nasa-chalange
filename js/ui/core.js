/* =====================================================================
 * ui/core.js — NÚCLEO DA INTERFACE
 *
 *   MS.ui.render(state)       redesenha tudo (chamado pelo store a cada ação)
 *   MS.ui.renderHTML(state)   mesmo HTML, como texto (usado nos testes)
 *   MS.ui.mount(el)           liga a interface a um elemento e aos cliques
 *   MS.ui.register(id, tela)  registra uma tela (ver js/ui/screens-*.js)
 *
 * Tela = { render(state, result) → HTML, nextLabel?: chave do botão Avançar }
 * "result" é sempre MS.sim.run(state): a tela só mostra, nunca calcula.
 *
 * Sempre na tela (topo): idioma, os 6 passos da NASA e o PAINEL DE
 * RECURSOS (massa, energia, orçamento, dados, comunicação, tempo).
 * Passar o mouse (ou focar) num cartão de opção mostra a prévia do
 * efeito em cada recurso; depois de escolher, a faixa "o que mudou"
 * mostra a cadeia de efeitos.
 *
 * Cliques: qualquer elemento com data-action="..." chama a ação de ACTIONS
 * (ex.: <button data-action="select" data-slot="orbit" data-option="sso500">).
 * Textos: MS.i18n.t('chave') e MS.i18n.L(texto dos dados).
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var ui = MS.ui = MS.ui || {};
  ui.local = ui.local || {};
  ['teamOpen', 'glossaryOpen', 'aboutOpen', 'sourcesOpen'].forEach(function (k) { if (!(k in ui.local)) ui.local[k] = false; });
  var screens = {};
  var U = MS.sim.util;
  var t = MS.i18n.t, L = MS.i18n.L;

  // ------------------------------------------------------------- Helpers
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function statusText(status) { return MS.i18n.has('st.' + status) ? t('st.' + status) : status; }
  function badge(status, text) {
    return '<span class="badge s-' + esc(status) + '">' + esc(text || statusText(status)) + '</span>';
  }
  function value(m) { return m && m.value != null ? U.withUnit(m.value, m.unit, m.decimals) : '—'; }
  function scenario(state) { return MS.levels ? MS.levels.scenario(state) : MS.data.scenarios[state.scenarioId]; }
  // Termo do glossário com dica (MS.data.glossary). label opcional.
  function term(key, label) {
    var g = MS.data.glossary && MS.data.glossary[key];
    if (!g) return esc(label || key);
    return '<span class="term" tabindex="0" data-tip="' + esc(L(g.text)) + '">' + esc(label || L(g.term)) + '</span>';
  }
  // Texto com [[chave]] ou [[chave|texto]] vira termo com dica; o resto é escapado.
  function rich(text) {
    var out = '', re = /\[\[(\w+)(?:\|([^\]]+))?\]\]/g, last = 0, m;
    text = String(L(text) == null ? '' : L(text));
    while ((m = re.exec(text))) { out += esc(text.slice(last, m.index)) + term(m[1], m[2]); last = re.lastIndex; }
    return out + esc(text.slice(last));
  }
  // Métrica/recurso → termo do glossário que a explica.
  var TERM_OF = { gsd_m: 'gsd', swath_km: 'swath', revisit_days: 'revisit', downlink_Gbit_day: 'downlink', eclipse_pct: 'eclipse',
                  lifetime_years: 'lifetime', downlink: 'downlink', contactMinPerDay: 'groundStation', passesPerDay: 'groundStation',
                  margin: 'margin', time: 'schedule', schedule_months: 'schedule' };
  function labelOf(key, label) { return TERM_OF[key] ? term(TERM_OF[key], label) : esc(label); }

  function explain(text, label) {
    var math = !label || label === t('ui.seeMath') || label === t('ui.howCalc');
    if (uiMode === 'simple' || (uiMode === 'medium' && math)) return '';
    return text ? '<details' + (uiMode === 'full' ? ' open' : '') + '><summary>' + esc(label || t('ui.howCalc')) + '</summary>' + esc(text) + '</details>' : '';
  }

  // Campos que aparecem nos cartões de opção: [campo, unidade, casas].
  // Rótulo: t('spec.<campo>'). Campo novo no catálogo? Acrescente aqui.
  // Nível de dificuldade da tela atual: 'simple' (Fácil) mostra menos números,
  // 'full' (Difícil) mostra tudo e abre as contas (js/data/levels.js → ui).
  var uiMode = '';
  function setLevelUI(state) {
    var d = MS.levels ? MS.levels.def(MS.levels.id(state)) : null;
    uiMode = (d && d.ui) || '';
  }
  // Escolhe a lista do modo atual: byMode({ simple: [...], medium: [...], full: [...] }).
  function byMode(o) { return o[uiMode] || o.medium || o.full; }
  var SIMPLE_SPECS = ['altitude_km', 'mass_kg', 'power_W', 'cost_k'];
  var MEDIUM_SPECS = ['isp_s', 'propellant_kg', 'viewHours', 'altitude_km', 'lifetime_years', 'mass_kg', 'power_W', 'volume_U', 'cost_k', 'capacity_U', 'solarPower_W', 'dataRate_kbps', 'capacity_Wh'];
  var SPEC_FIELDS = [
    ['altitude_km', 'km', 0], ['inclination_deg', '°', 1],
    ['lifetime_years', 'years', 1], ['orbits', 'orbits'], ['waitMonths', 'months', 0],
    ['maxMass_kg', 'kg', 1], ['latitude_deg', 'lat'], ['bands', 'list'],
    ['focal_mm', 'mm', 0], ['pixelsAcross', '', 0],
    ['requiredPointing_deg', '°', 2], ['capacity_U', 'U', 1],
    ['solarPower_W', 'W', 0], ['accuracy_deg', '°', 2],
    ['band', 'text'], ['dataRate_kbps', 'rate'], ['storage_GB', 'GB', 0],
    ['compressionRatio', 'ratio'], ['capacity_Wh', 'Wh', 0], ['isp_s', 's', 0], ['propellant_kg', 'kg', 2], ['viewHours', 'h', 0],
    ['mass_kg', 'kg', 2], ['power_W', 'W', 1], ['volume_U', 'U', 1],
    ['cost_k', 'k$', 0], ['maturity', 'maturity']
  ];
  function fmtSpec(v, unit, dec) {
    var cat = MS.data.catalog;
    if (unit === 'orbits') return v.map(function (id) { return cat.orbits[id] ? L(cat.orbits[id].name) : id; }).join(', ');
    if (unit === 'list') return Array.isArray(v) ? v.join(', ') : String(v); // estação: lista · câmera: nº de bandas
    if (unit === 'text') return String(v);
    if (unit === 'lat') return U.fmt(Math.abs(v), 0) + '° ' + (v >= 0 ? 'N' : 'S');
    if (unit === 'rate') return v >= 1000 ? U.fmt(v / 1000, 1) + ' Mbps' : U.fmt(v, 1) + ' kbps';
    if (unit === 'ratio') return U.fmt(v, 0) + ':1';
    if (unit === 'maturity') return L((cat.maturity[v] || {}).label) || v;
    if (unit === 'years' || unit === 'months') return U.withUnit(v, t('u.' + unit), dec);
    return U.withUnit(v, unit, dec);
  }
  // ff = formato da estrutura escolhida; sem formato, mostra "3U: x · 6U: y".
  function specs(item, ff) {
    var rows = SPEC_FIELDS.map(function (f) {
      var v = item[f[0]];
      if (uiMode === 'simple' && SIMPLE_SPECS.indexOf(f[0]) === -1) return '';
      if (uiMode === 'medium' && MEDIUM_SPECS.indexOf(f[0]) === -1) return '';
      if (v == null || (f[0] === 'power_W' && v === 0) || (f[0] === 'volume_U' && v === 0)) return '';
      var text;
      if (typeof v === 'object' && !Array.isArray(v)) {
        var one = U.byFF(v, ff);
        text = one != null ? fmtSpec(one, f[1], f[2])
          : Object.keys(v).map(function (k) { return k + ': ' + fmtSpec(v[k], f[1], f[2]); }).join(' · ');
      } else {
        text = fmtSpec(v, f[1], f[2]);
      }
      return '<span class="sp sp-' + f[0] + '"><i>' + esc(t('spec.' + f[0])) + '</i> ' + esc(text) + '</span>';
    }).join('');
    return '<span class="specs">' + rows + '</span>';
  }

  // Selo de segmento da missão (lançamento, espaço, solo, usuário).
  function segmentChip(id) {
    var seg = MS.data.flow.segments && MS.data.flow.segments[id];
    if (!seg) return '';
    return '<span class="seg seg-' + esc(id) + '" title="' + esc(L(seg.text)) + '">' + esc(L(seg.name)) + '</span>';
  }

  // Sala multiplayer ativa? (null = jogando sozinho)
  function roomInfo() { return MS.net && MS.net.active() ? MS.net.info() : null; }
  // Na sala, só quem conduz as fases pode navegar. Devolve o motivo ou ''.
  function phaseLock(state) {
    var room = roomInfo();
    if (!room) return '';
    var c = MS.team.can(scenario(state), room.members, room.me, 'nextPhase', []);
    return c.ok ? '' : c.reason;
  }

  // ---------------------------------------------------------- Componentes
  // Selo "valor científico" de um instrumento: número, barra e o porquê.
  var OPS_SHORT = { '<=': '≤', '>=': '≥', '<': '<', '>': '>' };
  function sciValue(o) {
    if (!o || o.value == null) return '';
    var cls = o.value >= 90 ? 'ok' : o.value >= 60 ? 'warn' : 'fail';
    var why = o.parts.map(function (p) {
      var dec = Math.abs(p.value) < 10 ? 1 : 0;
      return (p.ok ? '✓ ' : '✗ ') + p.title + ' ' + MS.sim.util.withUnit(p.value, p.unit, dec) + ' (' + t('sv.goal') + ' ' + (OPS_SHORT[p.op] || p.op) + ' ' + MS.sim.util.withUnit(p.threshold, p.unit, 0) + ')';
    }).join(' · ');
    return '<span class="sci-val s-' + cls + '"><span class="sv-top"><b>' + esc(t('sv.title')) + '</b><span class="sv-n">' + o.value + '<small>/100</small></span></span>' +
      '<span class="sv-bar"><i style="width:' + o.value + '%"></i></span><span class="sv-why">' + esc(why) + '</span></span>';
  }

  // Cartões de escolha para todos os slots da fase indicada (vem dos dados).
  function choices(state, phaseId, only) {
    var cat = MS.data.catalog;
    var structId = state.design.structure;
    var ff = structId && cat.components[structId] ? cat.components[structId].formFactor : null;
    var room = roomInfo(), sc = scenario(state);
    return sc.slots.filter(function (s) { return s.phase === phaseId && (!only || only.indexOf(s.id) >= 0); }).map(function (slot) {
      var cur = state.design[slot.id];
      if (slot.auto) return autoSlot(state, sc, slot, cur);
      var rec = MS.levels ? MS.levels.recommended(state, slot.id) : null;
      var hinted = rec && ui.local.hints && ui.local.hints[slot.id];
      var owner = room ? MS.team.slotOwner(sc, room.members, slot.id) : null;
      var locked = room && !MS.team.can(sc, room.members, room.me, 'select', [slot.id]).ok;
      var ownerTag = owner && owner.role
        ? '<span class="owner' + (owner.member && owner.member.id === room.me ? ' mine' : '') + '">' +
          esc(L(owner.role.name) + ': ' + (owner.member ? owner.member.name : t('ui.free'))) + '</span>' : '';
      // Instrumentos: valor científico para ESTE cliente (MS.advice.scienceValue).
      var sv = slot.id === 'payload' && MS.advice && MS.advice.scienceValue ? MS.advice.scienceValue(state) : null;
      var cards = slot.options.map(function (id) {
        var it = cat[slot.source][id], sel = cur === id;
        // Imagem 3D da peça (js/viz/parts3d.js); sem Three.js fica sem imagem.
        var pic = MS.parts3d && MS.parts3d.thumb ? MS.parts3d.thumb(slot.source, id) : '';
        var tip = [L(it.description), it.source ? t('ui.source') + ' ' + L(it.source) : ''].filter(Boolean).join(' — ');
        var star = hinted && id === rec;
        return '<button type="button" class="option' + (sel ? ' selected' : '') + (pic ? ' has-thumb' : '') + (star ? ' hinted' : '') + '" aria-pressed="' + sel + '" data-chosen="' + esc(t('ui.chosen')) + '"' + (locked ? ' disabled' : '') +
          (tip ? ' title="' + esc(tip) + '"' : '') +
          ' data-action="select" data-slot="' + esc(slot.id) + '" data-option="' + esc(id) + '">' +
          (pic ? '<span class="option-thumb"><img src="' + esc(pic) + '" alt="" draggable="false"></span>' : '') +
          (star ? '<span class="hint-star">⭐ ' + esc(t('ui.hint')) + '</span>' : '') +
          '<span class="option-name">' + esc(L(it.name)) + '</span>' + (sv ? sciValue(sv.options[id]) : '') +
          (uiMode === 'full' && it.description ? '<span class="option-desc">' + esc(L(it.description)) + '</span>' : '') +
          (it.pros || it.cons ? '<span class="pc">' + (it.pros ? '<span class="pro"><span><b>' + esc(t('ui.pro')) + '</b> ' + esc(L(it.pros)) + '</span></span>' : '') +
            (it.cons ? '<span class="con"><span><b>' + esc(t('ui.con')) + '</b> ' + esc(L(it.cons)) + '</span></span>' : '') + '</span>' : '') +
          specs(it, ff) + '</button>';
      }).join('');
      return '<section class="slot"><div class="slot-head"><h3>' + rich(slot.label) + '</h3>' + segmentChip(slot.segment) +
        (cur ? '<span class="slot-done">✓ ' + esc(t('ui.chosen')) + '</span>' : '<span class="slot-todo">' + esc(t('ui.chooseOne')) + '</span>') + ownerTag +
        (rec && !hinted ? '<button type="button" class="btn small hint-btn" data-action="hint" data-slot="' + esc(slot.id) + '">💡 ' + esc(t('ui.hintAsk')) + '</button>' : '') +
        '</div>' + (slot.help ? '<p class="slot-why"><b>' + esc(t('ui.whyMatters')) + '</b> ' + rich(slot.help) + '</p>' : '') +
        '<div class="options">' + cards + '</div></section>';
    }).join('');
  }

  // Escolha feita pelo jogo (nível Fácil): mostra o que foi escolhido e por quê.
  function autoSlot(state, sc, slot, cur) {
    var it = cur ? (MS.data.catalog[slot.source] || {})[cur] : null;
    var from = slot.follows ? (sc.slots.filter(function (x) { return x.id === slot.follows; })[0] || {}).label : null;
    var line = it ? '<b>' + esc(L(it.name)) + '</b>' : esc(t('ui.autoWait', { slot: from ? L(from) : '' }));
    return '<section class="slot slot-auto"><div class="slot-head"><h3>' + rich(slot.label) + '</h3>' +
      '<span class="slot-done">✓ ' + esc(slot.auto === 'follow' ? t('ui.autoFollow', { slot: from ? L(from) : '' }) : t('ui.autoFixed')) + '</span></div>' +
      '<p class="auto-line">' + line + (slot.help ? ' — ' + rich(slot.help) : '') + '</p></section>';
  }

  // Seletor do nível de dificuldade (menu inicial e fase 1).
  function levelPicker(state) {
    if (!MS.levels) return '';
    var cur = MS.levels.id(state), lock = phaseLock(state);
    return '<div class="lvl-pick" role="radiogroup" aria-label="' + esc(t('lvl.title')) + '">' + MS.levels.ids().map(function (id) {
      var d = MS.levels.def(id), on = id === cur;
      return '<button type="button" role="radio" aria-checked="' + on + '" class="lvl lvl-' + esc(id) + (on ? ' on' : '') + '" data-action="level" data-level="' + esc(id) + '"' + (lock ? ' disabled title="' + esc(lock) + '"' : '') + '>' +
        '<span class="lvl-top"><span class="lvl-ic" aria-hidden="true">' + esc(d.icon || '') + '</span><b>' + esc(L(d.name)) + '</b></span>' +
        '<span class="lvl-tag">' + esc(L(d.tagline)) + '</span></button>';
    }).join('') + '</div>';
  }

  // Lista de métricas do motor: frase simples + a conta para quem quiser.
  function metricRows(result, keys) {
    return '<ul class="rows">' + keys.map(function (k) {
      var m = result.metrics[k];
      return '<li><div class="row-head"><span>' + labelOf(k, m.label) + '</span><span class="value">' + esc(value(m)) +
        '</span></div>' + (m.plain && m.value != null ? '<div class="plain">' + esc(m.plain) + '</div>' : '') + explain(m.explanation) + '</li>';
    }).join('') + '</ul>';
  }

  // Lista de itens com status: requisitos, verificações ou recursos.
  function statusRows(items, opts) {
    opts = opts || {};
    return '<ul class="rows">' + items.map(function (x) {
      var title = (opts.prefixId ? x.id + ' · ' : '') + (x.title || x.label);
      return '<li><div class="row-head"><span><strong>' + esc(title) + '</strong></span>' + badge(x.status) + '</div>' +
        (x.text ? '<div class="small">' + esc(x.text) + '</div>' : '') +
        (x.plain && x.status !== 'pending' ? '<div class="plain">' + esc(x.plain) + '</div>' : '') +
        (x.status === 'pending' ? '<div class="small muted">' + esc(x.explanation) + '</div>' : explain(x.explanation, t('ui.why'))) +
        (x.hint ? '<div class="hint" data-label="' + esc(t('ui.tip')) + '">' + esc(x.hint) + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  // Painel de recursos detalhado (lateral do Design): barra + marca da folga.
  function resourcePanel(result) {
    return result.resources.map(function (r) {
      var use = r.usage == null ? 0 : Math.max(0, Math.min(100, r.usage * 100));
      var mark = r.recommendedMargin > 0 ? '<div class="mark" style="left:' + ((1 - r.recommendedMargin) * 100) + '%"></div>' : '';
      return '<div class="res s-' + r.status + '"><div class="row-head"><strong>' + labelOf(r.id, r.label) + '</strong>' + badge(r.status) + '</div>' +
        '<div class="bar"><div class="fill" style="width:' + use + '%"></div>' + mark + '</div>' +
        '<div class="res-text">' + esc(r.explanation) + '</div></div>';
    }).join('') + legend();
  }
  function legend() {
    return '<div class="legend"><span><i style="background:var(--ok)"></i>' + esc(t('ui.legendOk')) + ' ' + term('margin', t('ui.legendMargin')) + '</span>' +
      '<span><i style="background:var(--warn)"></i>' + esc(t('ui.legendWarn')) + '</span><span><i style="background:var(--fail)"></i>' + esc(t('ui.legendFail')) + '</span>' +
      '<span>| = ' + esc(t('ui.legendMark')) + '</span></div>';
  }

  // ---------------------------------------------------------- Ícones SVG
  // Traços simples (do kit gráfico do canvas). icon('mass') → <svg>.
  // Recursos, papéis da equipe e estados; todo estado vai com ícone + texto.
  var ICONS = {
    mass: ['M6.5 8h11l2.5 12H4z', 'M9 8a3 3 0 0 1 6 0'],
    power: ['M13 2L4 14h7l-1 8 9-12h-7z'],
    cost: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M15 9.3c-.6-.9-1.7-1.3-3-1.3-1.7 0-3 .8-3 2s1.3 1.6 3 2 3 .8 3 2-1.3 2-3 2c-1.3 0-2.5-.5-3-1.4', 'M12 6v12'],
    data: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
    comms: ['M12 13v8', 'M8.5 9.5a5 5 0 0 1 7 0M5.6 6.6a9 9 0 0 1 12.8 0', 'M12 11.5a1 1 0 1 0 0 2 1 1 0 1 0 0-2z'],
    time: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M12 7v5l3 2'],
    sci: ['M9 3h6', 'M10 3v6l-5.6 9.7A1.5 1.5 0 0 0 5.7 21h12.6a1.5 1.5 0 0 0 1.3-2.3L14 9V3', 'M7.5 15h9'],
    eng: ['M14.7 6.3a4 4 0 0 0-5.4 5.4L3.6 17.4a1.4 1.4 0 0 0 0 2l1 1a1.4 1.4 0 0 0 2 0l5.7-5.7a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.3-.4-.4-2.3z'],
    mgr: ['M4 20h16', 'M7 16v-4M12 16V8M17 16V5'],
    com: ['M4 10a7.3 7.3 0 0 0 10 10z', 'M9 15l3-3', 'M17 13a6 6 0 0 0-6-6M21 13A10 10 0 0 0 11 3'],
    dir: ['M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z'],
    ok: ['M5 12.5l4.5 4.5L19 7.5'],
    warn: ['M12 3.5L2.5 20h19z', 'M12 10v4.5M12 17.3v.2'],
    fail: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M15 9l-6 6M9 9l6 6'],
    pending: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M8 12h.01M12 12h.01M16 12h.01'],
    rocket: ['M12 2.5c3 2.2 4.8 6 4.5 10.5L15 16H9l-1.5-3C7.2 8.5 9 4.7 12 2.5z', 'M12 8.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2z', 'M9 16l-2.5 4.5 3-1M15 16l2.5 4.5-3-1'],
    team: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 1 0 0 7z', 'M2.5 20.5c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5', 'M16 4.3a3.5 3.5 0 0 1 0 6.4M18 15.2c2.2.6 3.5 2.4 3.5 5.3'],
    book: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 19V5', 'M8 7h7'],
    info: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M12 11v5', 'M12 7.5v.5'],
    restart: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4v4h4'],
    arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
    back: ['M19 12H5', 'M11 6l-6 6 6 6'],
    eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z'],
    sun: ['M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10z', 'M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8'],
    card: ['M5 3h14v18H5z', 'M8 8h8M8 12h8M8 16h5']
  };
  function icon(name, opts) {
    opts = opts || {};
    var paths = ICONS[name] || ICONS.info, sz = opts.size || 20;
    return '<svg class="ico' + (opts.cls ? ' ' + opts.cls : '') + '" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (opts.stroke || 2) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (opts.color ? ' style="color:' + opts.color + '"' : '') + '>' +
      paths.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</svg>';
  }
  // Emblema do jogo (Terra com órbita e satélite), desenhado em SVG.
  var EMBLEM = '<svg class="emblem" width="44" height="44" viewBox="0 0 48 48" aria-hidden="true"><defs><radialGradient id="emb" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#7CC0FF"/><stop offset="1" stop-color="#1D4FB8"/></radialGradient></defs>' +
    '<circle cx="24" cy="24" r="15" fill="url(#emb)"/><path d="M13.5 21c3.5-2.5 6.5.5 10-1.5s6.5-.5 9.5 2.5" fill="none" stroke="#43C27A" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M16 30c3-1 5 1 8 0" fill="none" stroke="#43C27A" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="24" cy="25" rx="22" ry="7" fill="none" stroke="#F59E2B" stroke-width="2.5" transform="rotate(-18 24 25)"/>' +
    '<rect x="38" y="8" width="7" height="4.5" rx="1" fill="#EAF1FF"/><rect x="35" y="9.5" width="3" height="1.5" fill="#7FB2FF"/></svg>';
  // Estado com ícone + palavra (nunca só a cor).
  function stateIcon(status) { return status === 'ok' || status === 'warn' || status === 'fail' ? status : 'pending'; }
  function stateTag(status, text) {
    return '<span class="st-tag s-' + esc(status) + '">' + icon(stateIcon(status), { size: 14, stroke: 2.6 }) + esc(text || statusText(status)) + '</span>';
  }

  // ------------------------------------------- Painel fixo: os 6 recursos
  // Os 6 recursos que o desafio pede, sempre visíveis no topo.
  //   res: recursos do motor que o cartão resume (o status é o pior deles)
  var HUD = [
    { id: 'mass',  res: ['mass', 'volume', 'deltav'] },
    { id: 'power', res: ['power', 'battery'] },  // bateria: só no modo Difícil
    { id: 'cost',  res: ['cost'] },
    { id: 'data',  res: ['storage'], metric: 'dataPerDay_Gbit' },
    { id: 'comms', res: ['downlink'] },
    { id: 'time',  res: ['time'] }
  ];
  function resById(result, id) { return result.resources.filter(function (r) { return r.id === id; })[0]; }
  function hudRes(card, result) { return card.res.map(function (id) { return resById(result, id); }).filter(Boolean); }
  function hudStatus(card, result) { return U.worst(hudRes(card, result).map(function (r) { return r.status; })); }
  function hudValue(card, result) {
    if (card.metric) { var m = result.metrics[card.metric]; return m.value == null ? '—' : U.withUnit(m.value, m.unit, 1) + t('u.slashDay'); }
    var r = resById(result, card.res[0]);
    if (r.demand == null && r.capacity == null) return '—';
    var d = r.demand == null ? '—' : U.fmt(r.demand, r.decimals > 1 ? 1 : r.decimals);
    var c = r.capacity == null ? '—' : U.fmt(r.capacity, r.decimals > 1 ? 1 : r.decimals);
    return d + ' / ' + c + ' ' + r.unit;
  }
  function hudCard(card, result, open) {
    var r = resById(result, card.res[0]), st = hudStatus(card, result);
    var use = r.usage == null ? 0 : Math.max(0, Math.min(100, r.usage * 100));
    var mark = r.recommendedMargin > 0 ? '<i class="mk" style="left:' + ((1 - r.recommendedMargin) * 100) + '%"></i>' : '';
    return '<button type="button" class="hud-card s-' + st + (open ? ' open' : '') + '" data-action="hud" data-hud="' + card.id + '" aria-expanded="' + !!open + '"' +
      ' title="' + esc(t('hud.' + card.id + '.what')) + '">' +
      '<span class="hud-ic">' + icon(card.id, { size: 22 }) + '</span><span class="hud-body">' +
      '<span class="hud-top"><span class="hud-name">' + esc(t('hud.' + card.id)) + '</span>' +
      '<span class="hud-st" title="' + esc(statusText(st)) + '">' + icon(stateIcon(st), { size: 14, stroke: 2.6 }) + '<span class="sr">' + esc(statusText(st)) + '</span></span></span>' +
      '<span class="hud-val">' + esc(hudValue(card, result)) + '</span>' +
      '<span class="hud-bar"><i class="fl" style="width:' + use + '%"></i>' + mark + '</span>' +
      '<span class="hud-delta" aria-hidden="true"></span></span></button>';
  }
  function hudDetail(id, result) {
    var card = HUD.filter(function (c) { return c.id === id; })[0];
    if (!card) return '';
    var body = hudRes(card, result).map(function (r) {
      return '<div class="hud-d-item"><div class="row-head"><strong>' + labelOf(r.id, r.label) + '</strong>' + badge(r.status) + '</div>' +
        (r.plain ? '<p class="plain">' + esc(r.plain) + '</p>' : '') + '<p class="small">' + esc(r.explanation) + '</p>' +
        explain(r.details.filter(Boolean).join(' '), t('ui.seeMath')) + '</div>';
    }).join('');
    return '<div class="hud-detail" role="region" aria-label="' + esc(t('hud.' + id)) + '"><div class="row-head"><strong>' + esc(t('hud.' + id + '.what')) + '</strong>' +
      '<button type="button" class="btn small" data-action="hud" data-hud="' + id + '">' + esc(t('ui.close')) + '</button></div>' + body + '</div>';
  }
  function hud(state, result) {
    var open = ui.local.hudOpen;
    return '<div class="hud-wrap"><div class="hud" role="group" aria-label="' + esc(t('hud.title')) + '">' +
      HUD.filter(function (c) { return uiMode !== 'simple' || ['mass', 'power', 'cost'].indexOf(c.id) !== -1; })
        .map(function (c) { return hudCard(c, result, open === c.id); }).join('') + '</div>' +
      (open ? hudDetail(open, result) : '') +
      // No Design a cadeia aparece no centro do cockpit (cartão "Ripple effect").
      '<div class="cascade" aria-live="polite">' + (state.phase !== 'design' && ui.local.cascade && ui.local.cascade.phase === state.phase ? ui.local.cascade.html : '') + '</div></div>';
  }

  // Diferença de um recurso entre dois resultados, em texto ("+0,6 kg").
  function deltaText(a, b, card) {
    if (card.metric) {
      var ma = a.metrics[card.metric], mb = b.metrics[card.metric];
      if (ma.value == null || mb.value == null) return mb.value != null ? U.withUnit(mb.value, mb.unit, 1) : '';
      var dm = mb.value - ma.value;
      return Math.abs(dm) < 1e-9 ? '' : (dm > 0 ? '+' : '−') + U.withUnit(Math.abs(dm), mb.unit, 1);
    }
    var ra = resById(a, card.res[0]), rb = resById(b, card.res[0]), parts = [];
    var dec = rb.decimals > 1 ? 1 : rb.decimals;
    if (rb.demand != null && ra.demand != null && Math.abs(rb.demand - ra.demand) > 1e-9) {
      var d = rb.demand - ra.demand;
      parts.push((d > 0 ? '+' : '−') + U.withUnit(Math.abs(d), rb.unit, dec));
    } else if (rb.demand != null && ra.demand == null) parts.push(U.withUnit(rb.demand, rb.unit, dec));
    if (rb.capacity != null && ra.capacity != null && Math.abs(rb.capacity - ra.capacity) > 1e-9) {
      var c = rb.capacity - ra.capacity;
      parts.push(t('hud.limit') + ' ' + (c > 0 ? '+' : '−') + U.withUnit(Math.abs(c), rb.unit, dec));
    } else if (rb.capacity != null && ra.capacity == null) parts.push(t('hud.limit') + ' ' + U.withUnit(rb.capacity, rb.unit, dec));
    return parts.join(' · ');
  }

  // Prévia: mostra no painel o que uma opção mudaria (sem escolher).
  function previewOption(slot, option) {
    var state = MS.store.state;
    if (!rootEl || !state || state.design[slot] === option) { clearPreview(); return; }
    if (MS.hangar) MS.hangar.preview(slot, option); // a peça aparece em amarelo no hangar
    var base = MS.sim.run(state);
    var cand = MS.sim.run(Object.assign({}, state, { design: Object.assign({}, state.design, (function () { var o = {}; o[slot] = option; return o; })()) }));
    HUD.forEach(function (card) {
      var el = rootEl.querySelector('.hud-card[data-hud="' + card.id + '"]');
      if (!el) return;
      var before = hudStatus(card, base), after = hudStatus(card, cand);
      var txt = deltaText(base, cand, card);
      el.querySelector('.hud-delta').textContent = txt ? txt + (after !== before ? ' → ' + statusText(after) : '') : (after !== before ? '→ ' + statusText(after) : '');
      el.classList.remove('pv-ok', 'pv-warn', 'pv-fail', 'pv-pending');
      if (txt || after !== before) el.classList.add('pv', 'pv-' + after);
    });
    var hudEl = rootEl.querySelector('.hud');
    if (hudEl) hudEl.classList.add('previewing');
  }
  function clearPreview() {
    if (!rootEl) return;
    if (MS.hangar) MS.hangar.preview(null);
    var cards = rootEl.querySelectorAll('.hud-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('pv', 'pv-ok', 'pv-warn', 'pv-fail', 'pv-pending');
      var d = cards[i].querySelector('.hud-delta');
      if (d) d.textContent = '';
    }
    var hudEl = rootEl.querySelector('.hud');
    if (hudEl) hudEl.classList.remove('previewing');
  }

  // Cadeia de efeitos: o que a última mudança de projeto alterou.
  function cascadeHTML(prevState, prev, state, cur) {
    var sc = scenario(state), cat = MS.data.catalog;
    var changed = sc.slots.filter(function (s) { return prevState.design[s.id] !== state.design[s.id]; });
    if (!changed.length) return '';
    var what = changed.map(function (s) {
      var id = state.design[s.id], item = id && cat[s.source][id];
      return '<b>' + esc(L(s.label)) + ':</b> ' + esc(item ? L(item.name) : t('ui.none'));
    }).join(', ');
    var items = [];
    HUD.forEach(function (card) {
      var d = deltaText(prev, cur, card), a = hudStatus(card, prev), b = hudStatus(card, cur);
      if (!d && a === b) return;
      items.push({ rank: (b === 'fail' ? 3 : b === 'warn' ? 2 : 1) + (a !== b ? 3 : 0),
        html: '<span class="cz s-' + b + '">' + icon(card.id, { size: 15 }) + ' ' + esc(t('hud.' + card.id)) + ' ' + esc(d) +
          (a !== b ? ' <b>' + esc(statusText(a)) + ' → ' + esc(statusText(b)) + '</b>' : '') + '</span>' });
    });
    cur.requirements.forEach(function (r) {
      var pr = prev.requirements.filter(function (x) { return x.id === r.id; })[0];
      if (pr && pr.status !== r.status && r.status !== 'pending') {
        items.push({ rank: 5, html: '<span class="cz s-' + r.status + '">' + esc(r.id + ' ' + r.title) + ' <b>' + esc(statusText(pr.status)) + ' → ' + esc(statusText(r.status)) + '</b></span>' });
      }
    });
    if (!items.length) return '';
    items.sort(function (x, y) { return y.rank - x.rank; });
    return '<span class="cz-head">' + esc(t('ui.cascade')) + ' ' + what + '</span><span class="cz-arrow" aria-hidden="true">→</span>' +
      items.slice(0, 5).map(function (i) { return i.html; }).join('<span class="cz-arrow" aria-hidden="true">→</span>');
  }

  // ------------------------------------------------------- Moldura da tela
  var FLAGS = {
    en: '<svg viewBox="0 0 19 10" aria-hidden="true"><rect width="19" height="10" fill="#b22234"/><path d="M0 1.15h19M0 2.7h19M0 4.23h19M0 5.77h19M0 7.3h19M0 8.85h19" stroke="#fff" stroke-width=".77"/><rect width="7.6" height="5.38" fill="#3c3b6e"/></svg>',
    pt: '<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#009c3b"/><path d="M10 1.7 18.3 7 10 12.3 1.7 7z" fill="#ffdf00"/><circle cx="10" cy="7" r="3.4" fill="#002776"/></svg>',
    es: '<svg viewBox="0 0 3 2" aria-hidden="true"><rect width="3" height="2" fill="#aa151b"/><rect y=".5" width="3" height="1" fill="#f1bf00"/></svg>'
  };
  function langSwitch() {
    return '<div class="langs" role="group" aria-label="' + esc(t('ui.language')) + '">' + MS.i18n.langs.map(function (l) {
      var on = l.id === MS.i18n.lang;
      return '<button type="button" class="flag' + (on ? ' on' : '') + '" data-action="lang" data-lang="' + l.id + '" aria-pressed="' + on + '" title="' + esc(l.name) + '">' +
        FLAGS[l.id] + '<span>' + l.id.toUpperCase() + '</span></button>';
    }).join('') + '</div>';
  }

  function levelTag(state) {
    var d = MS.levels ? MS.levels.def(MS.levels.id(state)) : null;
    return d && MS.levels.id(state) !== 'normal' ? ' · ' + esc((d.icon ? d.icon + ' ' : '') + L(d.name)) : '';
  }
  function header(state, info, result) {
    var lock = phaseLock(state), room = MS.net ? MS.net.info() : { inRoom: false };
    var steps = info.phases.map(function (p, i) {
      var cls = i === info.index ? 'current' : i <= info.reachedIndex ? 'done' : '';
      var dis = i > info.reachedIndex || (lock && i !== info.index);
      return '<li class="' + cls + (p.nasaStep ? '' : ' extra') + '" style="--i:' + i + '"><button type="button" data-action="goto" data-phase="' + esc(p.id) + '"' +
        (dis ? ' disabled' : '') + (i === info.index ? ' aria-current="step"' : '') + ' title="' + esc(L(p.title) + ' — ' + L(p.subtitle)) + '">' +
        '<span class="num">' + (cls === 'done' && i !== info.index ? icon('ok', { size: 15, stroke: 3 }) : p.nasaStep || '★') + '</span><span class="lbl">' + esc(L(p.title)) + '</span>' +
        '<span class="lbl-s">' + esc(L(p.short)) + '</span></button></li>';
    }).join('');
    return '<header class="top"><div class="brand">' +
      '<div class="logo">' + EMBLEM + '<span class="logo-sep" aria-hidden="true"></span><div><strong class="pixel">' + esc(t('app.name')) + '</strong><span>' + esc(L(scenario(state).title)) + levelTag(state) + '</span></div></div>' +
      '<div class="top-actions">' + (ui.menuHTML ? '<button type="button" class="btn small" data-action="menu-open">' + icon('back', { size: 16 }) + esc(t('menu.open')) + '</button>' : '') +
      langSwitch() +
      '<button type="button" class="btn small' + (room.inRoom ? ' on' : '') + '" data-action="team-toggle">' + icon('team', { size: 16 }) +
        (room.inRoom ? esc(t('ui.team')) + ' · ' + esc(room.code) : esc(t('ui.playTeam'))) + '</button>' +
      '<button type="button" class="btn small" data-action="glossary">' + icon('book', { size: 16 }) + esc(t('ui.glossary')) + '</button>' +
      '<button type="button" class="btn small" data-action="coach">' + icon('info', { size: 16 }) + esc(t('coach.tips')) + '</button>' +
      (MS.sfx ? '<button type="button" class="btn small sfx-btn" data-action="sfx-mute" aria-pressed="' + !MS.sfx.muted() + '" title="' + esc(t(MS.sfx.muted() ? 'sfx.on' : 'sfx.off')) + '" aria-label="' + esc(t(MS.sfx.muted() ? 'sfx.on' : 'sfx.off')) + '">' +
        '<span aria-hidden="true">' + (MS.sfx.muted() ? '🔇' : '🔊') + '</span></button>' : '') +
      '</div></div>' +
      '<nav class="steps" aria-label="' + esc(t('ui.stepsLabel')) + '"><ol>' + steps + '</ol></nav>' +
      hud(state, result) + '</header>';
  }

  // Caixa "O que fazer aqui" + o que a NASA faz neste passo.
  // Só as dicas e "o que a NASA faz" (recolhidas); a frase principal vai no cabeçalho da fase.
  function guideMore(phase) {
    if (!phase.guide || (!(phase.tips || []).length && !phase.nasa)) return '';
    return guide(phase).replace(/^[\s\S]*?(<details class="guide-more">[\s\S]*<\/details>)[\s\S]*$/, '<div class="guide-only">$1</div>');
  }
  function guide(phase) {
    if (!phase.guide) return '';
    var tips = (phase.tips || []).map(function (x) { return '<li>' + rich(x) + '</li>'; }).join('');
    var segs = (phase.segments || []).map(segmentChip).join('');
    var cml = MS.data.flow.cml && MS.data.flow.cml[phase.cml];
    // Frase principal sempre à vista; dicas e "na NASA" abrem sob demanda (a tela fica para o jogo).
    return '<div class="guide"><span class="guide-icon" aria-hidden="true">?</span><div><strong>' + esc(t('ui.whatToDo')) + '</strong>' +
      '<p>' + rich(phase.guide) + '</p><details class="guide-more"><summary>' + esc(t('ui.guideMore')) + '</summary>' + (tips ? '<ul>' + tips + '</ul>' : '') +
      (phase.nasa ? '<div class="nasa"><span class="nasa-tag">' + esc(phase.nasaStep ? t('ui.atNasaStep', { n: phase.nasaStep }) : t('ui.atNasa')) + '</span>' +
        '<p>' + rich(phase.nasa) + '</p><div class="nasa-meta"><span class="small muted">' + term('segments', t('ui.segments')) + ':</span> ' + segs +
        (cml ? ' <span class="cml" title="' + esc(L(MS.data.glossary.cml.text)) + '">' + esc(L(cml)) + '</span>' : '') + '</div></div>' : '') +
      '</details></div></div>';
  }

  // Fontes e cálculos (botão no topo): os recursos da NASA usados e as contas
  // do motor, cada uma com a fórmula, o que quer dizer e a conta ao vivo
  // com os números do projeto atual (explicação que o próprio motor escreve).
  var SRC_NASA = ['nasa1', 'nasa2', 'nasa5', 'nasa6', 'nasa7', 'nasa8', 'nasa9', 'nasa10', 'nasa11', 'nasa3', 'nasa4'];
  var SRC_MATH = [
    { id: 'gsd', metric: 'gsd_m' }, { id: 'swath', metric: 'swath_km' }, { id: 'revisit', metric: 'revisit_days' },
    { id: 'period', metric: 'period_min' }, { id: 'eclipse', metric: 'eclipse_pct' }, { id: 'lifetime', metric: 'lifetime_years' },
    { id: 'power', metric: 'powerGen_W' }, { id: 'contact', metric: 'contactMinPerDay' }, { id: 'downlink', metric: 'downlink_Gbit_day' },
    { id: 'mass', metric: 'mass_kg' }, { id: 'cost', metric: 'cost_k' }, { id: 'science', metric: null }
  ];
  // O conteúdo vai no relatório final (screens-end), em "Fontes e contas":
  // é lá, depois de jogar, que as contas fazem sentido.
  function sourcesPanel(state, result) {
    if (!ui.local.sourcesOpen) return '';
    return '<div class="card sources"><div class="row-head"><h2>' + esc(t('src.title')) + '</h2><button type="button" class="btn small" data-action="sources">' + esc(t('ui.close')) + '</button></div>' +
      sourcesBody(state, result) + '</div>';
  }
  function sourcesBody(state, result) {
    var nasa = SRC_NASA.map(function (k) {
      return '<li><b>' + esc(t('about.' + k + '.name')) + '</b><span>' + esc(t('about.' + k + '.use')) + '</span>' +
        '<a href="' + esc(t('about.' + k + '.url')) + '" target="_blank" rel="noopener">' + esc(t('ui.link')) + ' ↗</a></li>';
    }).join('');
    var math = SRC_MATH.map(function (f) {
      var m = f.metric && result ? result.metrics[f.metric] : null;
      var live = m ? (m.value != null ? m.explanation : t('src.liveWait')) : '';
      return '<li><div class="sf-head"><b>' + esc(t('src.f.' + f.id + '.name')) + '</b>' + (m && m.value != null ? '<span class="sf-val">' + esc(value(m)) + '</span>' : '') + '</div>' +
        '<code class="sf-formula">' + esc(t('src.f.' + f.id + '.formula')) + '</code>' +
        '<p>' + esc(t('src.f.' + f.id + '.plain')) + '</p>' +
        (live ? '<p class="sf-live"><span>' + esc(t('src.live')) + '</span> ' + esc(live) + '</p>' : '') + '</li>';
    }).join('');
    return '<p class="section-note">' + esc(t('src.intro')) + '</p>' +
      '<h3>' + esc(t('about.nasaTitle')) + '</h3><ul class="src-nasa">' + nasa + '</ul>' +
      '<h3>' + esc(t('src.mathTitle')) + '</h3><p class="section-note">' + esc(t('src.mathNote')) + '</p><ul class="src-math">' + math + '</ul>' +
      '<p class="small muted">' + esc(t('about.simple')) + '</p>';
  }

  // Glossário completo (botão no topo).
  function glossaryPanel() {
    if (!ui.local.glossaryOpen) return '';
    var g = MS.data.glossary || {};
    var items = Object.keys(g).sort(function (a, b) { return L(g[a].term).localeCompare(L(g[b].term), MS.i18n.locale()); }).map(function (k) {
      return '<div><dt>' + esc(L(g[k].term)) + '</dt><dd>' + esc(L(g[k].text)) + '</dd></div>';
    }).join('');
    return '<div class="card"><div class="row-head"><h2>' + esc(t('ui.glossary')) + '</h2><button type="button" class="btn small" data-action="glossary">' + esc(t('ui.close')) + '</button></div>' +
      '<p class="section-note">' + esc(t('ui.glossaryNote')) + '</p>' +
      '<dl class="glossary">' + items + '</dl></div>';
  }

  // Sobre o jogo: recursos da NASA usados, simplificações e uso de IA.
  // credits() é o mesmo conteúdo, mostrado no fim do jogo (relatório).
  function credits() {
    var res = ['nasa1', 'nasa2', 'nasa3', 'nasa4', 'nasa5', 'nasa6', 'nasa7', 'nasa8', 'nasa9', 'nasa10', 'nasa11'].map(function (k) {
      return '<li><b>' + esc(t('about.' + k + '.name')) + '</b> — ' + esc(t('about.' + k + '.use')) +
        ' <a href="' + esc(t('about.' + k + '.url')) + '" target="_blank" rel="noopener">' + esc(t('ui.link')) + '</a></li>';
    }).join('');
    return '<p>' + esc(t('about.intro')) + '</p>' +
      '<h3>' + esc(t('about.nasaTitle')) + '</h3><ul>' + res + '</ul>' +
      '<h3>' + esc(t('about.simpleTitle')) + '</h3><p class="small">' + esc(t('about.simple')) + '</p>' +
      '<h3>' + esc(t('about.aiTitle')) + '</h3><p class="small">' + esc(t('about.ai')) + '</p>' +
      '<h3>' + esc(t('about.libsTitle')) + '</h3><p class="small">' + esc(t('about.libs')) + '</p>';
  }
  function aboutPanel() {
    if (!ui.local.aboutOpen) return '';
    var res = ['nasa1', 'nasa2', 'nasa3', 'nasa4'].map(function (k) {
      return '<li><b>' + esc(t('about.' + k + '.name')) + '</b> — ' + esc(t('about.' + k + '.use')) +
        ' <a href="' + esc(t('about.' + k + '.url')) + '" target="_blank" rel="noopener">' + esc(t('ui.link')) + '</a></li>';
    }).join('');
    return '<div class="card about"><div class="row-head"><h2>' + esc(t('about.title')) + '</h2><button type="button" class="btn small" data-action="about">' + esc(t('ui.close')) + '</button></div>' +
      '<p>' + esc(t('about.intro')) + '</p>' +
      '<h3>' + esc(t('about.nasaTitle')) + '</h3><ul>' + res + '</ul>' +
      '<h3>' + esc(t('about.simpleTitle')) + '</h3><p class="small">' + esc(t('about.simple')) + '</p>' +
      '<h3>' + esc(t('about.aiTitle')) + '</h3><p class="small">' + esc(t('about.ai')) + '</p>' +
      '<h3>' + esc(t('about.libsTitle')) + '</h3><p class="small">' + esc(t('about.libs')) + '</p></div>';
  }

  function footer(state, info, screen) {
    var can = MS.store.canAdvance(state);
    var next = info.phases[info.index + 1];
    var lock = phaseLock(state);
    // Em equipe, "Lançar" primeiro pede o GO de todos (ui.teamGo, screens-end.js).
    var go = screen && screen.nextClass === 'launch' && ui.teamGo ? ui.teamGo(state) : { need: false };
    if (go.need && !go.all && can.ok) {
      return '<footer class="nav"><div class="nav-inner">' +
        '<button type="button" class="btn" data-action="prev"' + (info.index === 0 || lock ? ' disabled' : '') + '>← ' + esc(t('ui.back')) + '</button>' +
        '<span class="missing todo">' + esc(t('go.needAll')) + '</span>' +
        '<button type="button" class="btn primary launch" data-action="next"' + (go.asked && !go.no ? ' disabled' : '') + '>' + icon('team', { size: 20 }) +
        esc(go.asked && !go.no ? t('go.wait', { n: go.yes, total: go.total }) : go.no ? t('go.again') : t('go.ask')) + '</button></div></footer>';
    }
    var right = can.isLast
      ? '<button type="button" class="btn primary" data-action="retry"' + (lock ? ' disabled' : '') + '>' + esc(t('ui.retry')) + '</button>'
      : '<button type="button" class="btn primary' + (screen && screen.nextClass ? ' ' + screen.nextClass : '') + '" data-action="next"' + (can.ok && !lock ? '' : ' disabled') + '>' +
        (screen && screen.nextClass === 'launch' ? icon('rocket', { size: 20 }) : '') +
        esc(screen && screen.nextLabel ? t(screen.nextLabel) : t('ui.advanceTo', { name: L(next.short) })) + ' →</button>';
    var missing = can.missing.length ? t('ui.stillToChoose', { list: can.missing.map(L).join(', ') }) : '';
    if (lock) missing = lock + (missing ? ' ' + missing : '');
    return '<footer class="nav"><div class="nav-inner">' +
      '<button type="button" class="btn" data-action="prev"' + (info.index === 0 || lock ? ' disabled' : '') + '>← ' + esc(t('ui.back')) + '</button>' +
      '<span class="missing' + (can.missing.length && !lock ? ' todo' : '') + '">' + esc(missing) + '</span>' + right + '</div></footer>';
  }

  // Endereço completo (url() dentro de variável CSS seria lido a partir de css/).
  function absUrl(u) { try { return new URL(u, document.baseURI).href; } catch (e) { return u; } }
  function renderHTML(state) {
    setLevelUI(state);
    if (ui.local.menuOpen && ui.menuHTML) return ui.menuHTML(state); // menu inicial (js/ui/menu.js)
    var info = MS.store.phaseInfo(state);
    var screen = screens[info.current.screen];
    var body, result = null;
    try {
      result = MS.sim.run(state);
      body = screen ? screen.render(state, result)
        : '<div class="alert s-fail">' + esc(t('ui.noScreen', { id: info.current.screen })) + '</div>';
    } catch (e) {
      body = '<div class="alert s-fail">' + esc(t('ui.screenError')) + ' ' + esc(e.message) + '</div>';
      if (root.console) console.error(e);
    }
    var problems = MS.sim.validate(MS.data);
    var warn = problems.length
      ? '<div class="alert s-fail"><strong>' + esc(t('ui.dataProblems')) + '</strong><ul>' +
        problems.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' : '';
    var ph = info.current;
    var eyebrow = ph.nasaStep ? t('ui.stepOf', { n: ph.nasaStep, total: 6 }) : t('ui.finalStep');
    return (result ? header(state, info, result) : '') + '<main>' + warn + (ui.teamPanel ? ui.teamPanel(state) : '') +
      aboutPanel() + sourcesPanel(state, result) + glossaryPanel() +
      '<div class="phase-head' + (ph.image ? ' has-art' : '') + '"' + (ph.image ? ' style="--ph-art:url(\'' + esc(absUrl(ph.image)) + '\')"' : '') + '><span class="eyebrow">' + esc(eyebrow) + '</span>' +
      '<h1>' + esc(L(ph.title)) + '</h1>' +
      (ph.guide ? '<p class="ph-do"><b>' + esc(t('ui.whatToDo')) + ':</b> ' + rich(ph.guide) + '</p>' : '<p class="muted">' + esc(L(ph.subtitle) || '') + '</p>') +
      (ui.clientLine ? ui.clientLine(state, result) : '') + '</div>' +
      guideMore(ph) + body + (ui.calcPanel && result ? ui.calcPanel(state, result) : '') + '</main>' + footer(state, info, screen) +
      (ui.shoutDock && result ? ui.shoutDock(state, result) : ''); // gritos da equipe (js/ui/shouts-ui.js)
  }

  // --------------------------------------------------------------- Ações
  // Com sala ativa, a ação vai para o anfitrião (MS.net); sozinho, direto ao store.
  function dispatch(name, args) {
    if (MS.net && MS.net.active()) return MS.net.dispatch(name, args);
    return MS.store[name].apply(null, args || []);
  }
  function rerender() { if (MS.store.state) render(MS.store.state); }
  var ACTIONS = {
    select: function (d) { dispatch('select', [d.slot, d.option]); },
    scenario: function (d) { dispatch('setScenario', [d.id]); },
    level: function (d) { ui.local.hints = {}; dispatch('setDifficulty', [d.level]); },
    hint: function (d) { ui.local.hints = ui.local.hints || {}; ui.local.hints[d.slot] = true; rerender(); },
    next: function () {
      var st = MS.store.state, scr = st && screens[MS.store.phaseInfo(st).current.screen];
      var go = scr && scr.nextClass === 'launch' && ui.teamGo ? ui.teamGo(st) : { need: false };
      if (go.need && !go.all) { if (!go.asked || go.no) MS.net.askReady(); return; }
      dispatch('nextPhase');
    },
    prev: function () { dispatch('prevPhase'); },
    goto: function (d) { dispatch('goToPhase', [d.phase]); },
    retry: function () { dispatch('retry'); },
    period: function (d) { dispatch('setPeriod', [d.id]); },
    decide: function (d) { dispatch('decide', [d.id, d.choice]); },
    predict: function (d) { dispatch('setPrediction', [MS.store.state && MS.store.state.prediction === d.id ? null : d.id]); },
    lang: function (d) { MS.i18n.setLang(d.lang); ui.local.cascade = null; rerender(); },
    hud: function (d) { ui.local.hudOpen = ui.local.hudOpen === d.hud ? null : d.hud; rerender(); },
    'sfx-mute': function () { if (MS.sfx) MS.sfx.toggle(); rerender(); },
    glossary: function () { ui.local.glossaryOpen = !ui.local.glossaryOpen; rerender(); if (ui.local.glossaryOpen) root.scrollTo(0, 0); },
    sources: function () { ui.local.sourcesOpen = !ui.local.sourcesOpen; rerender(); if (ui.local.sourcesOpen) root.scrollTo(0, 0); },
    about: function () { ui.local.aboutOpen = !ui.local.aboutOpen; rerender(); if (ui.local.aboutOpen) root.scrollTo(0, 0); },
    coach: function () { if (MS.coach && MS.store.state) MS.coach.start(MS.store.state.phase); },
    reset: function () {
      var msg = roomInfo() ? t('ui.confirmResetTeam') : t('ui.confirmReset');
      if (root.confirm(msg)) dispatch('reset');
    }
  };

  var rootEl = null, lastPhase = null;
  // Guarda qual botão estava em foco para devolver o foco depois de redesenhar.
  var FOCUS_KEYS = ['action', 'slot', 'option', 'phase', 'hud', 'lang', 'id', 'role', 'choice', 'tab'];
  function focusKey() {
    var a = root.document && root.document.activeElement;
    if (!a || !a.dataset || !a.dataset.action || !rootEl || !rootEl.contains(a)) return null;
    return FOCUS_KEYS.filter(function (k) { return a.dataset[k] != null; })
      .map(function (k) { return '[data-' + k + '="' + String(a.dataset[k]).replace(/"/g, '') + '"]'; }).join('');
  }
  // O topo gruda na tela com só o painel de recursos à mostra: o jogador
  // sempre vê massa, energia, orçamento, dados, comunicação e tempo.
  function stickHud() {
    var top = rootEl && rootEl.querySelector('.top'), hw = top && top.querySelector('.hud-wrap');
    if (!hw) return;
    var hide = Math.max(0, hw.offsetTop - 6);
    top.style.top = -hide + 'px';
    // Altura que fica grudada: a coluna da direita (hangar 3D) gruda logo abaixo.
    try { document.documentElement.style.setProperty('--stick-h', (top.offsetHeight - hide) + 'px'); } catch (e) { /* sem document */ }
  }

  function render(state) {
    if (!rootEl) return;
    // Durante o tutorial a tela mostra um projeto de exemplo; o do jogador volta no fim.
    if (MS.tutorial && MS.tutorial.active && state === MS.store.state) return;
    try { document.title = t('app.name'); document.documentElement.lang = MS.i18n.locale(); } catch (e) { /* sem document */ }
    // Cadeia de efeitos: compara com o projeto anterior (mesmo cenário).
    var prev = ui.local.prevState;
    if (prev && prev.scenarioId === state.scenarioId && JSON.stringify(prev.design) !== JSON.stringify(state.design)) {
      try {
        var html = cascadeHTML(prev, MS.sim.run(prev), state, MS.sim.run(state));
        ui.local.cascade = html ? { phase: state.phase, html: html } : null;
      } catch (e) { ui.local.cascade = null; }
    } else if (prev && prev.scenarioId !== state.scenarioId) {
      ui.local.cascade = null;
    }
    ui.local.prevState = state;

    var fk = focusKey();
    rootEl.innerHTML = renderHTML(state);
    try { document.body.setAttribute('data-level', MS.levels ? MS.levels.id(state) : 'normal'); } catch (e) { /* sem document */ }
    stickHud();
    if (MS.viz && MS.viz.attachAll) MS.viz.attachAll(rootEl, state); // visual 3D (se a tela tiver um)
    if (MS.hangar) MS.hangar.attach(rootEl, state); // hangar 3D da coluna direita
    if (ui.menuAttach) ui.menuAttach(rootEl, state); // Terra 3D do menu inicial
    if (MS.coach) MS.coach.attach(rootEl, state);   // balões de ensino
    if (ui.sceneAfter) ui.sceneAfter(rootEl, state); // modo cena: prévia da opção em foco (js/ui/scene.js)
    if (MS.sfx) MS.sfx.after(rootEl, state);         // sons: alerta no vermelho e estrelas (js/ui/sfx.js)
    if (ui.chatAfter) ui.chatAfter(state);           // chat da equipe aparece só com sala (js/ui/chat.js)
    if (state.phase !== lastPhase) {
      if (lastPhase && ui.phaseIntro) ui.phaseIntro(state); // cartão de abertura da fase (js/ui/scene.js)
      root.scrollTo(0, 0);
      lastPhase = state.phase;
      var nav = rootEl.querySelector('.steps'), cur = rootEl.querySelector('.steps .current');
      if (nav && cur) nav.scrollLeft = cur.offsetLeft - 16; // celular: fase atual visível
    } else if (fk) {
      var el = rootEl.querySelector(fk);
      if (el && el.focus) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
    }
  }
  function mount(el) {
    rootEl = el;
    if (root.addEventListener) root.addEventListener('resize', stickHud);
    el.addEventListener('click', function (e) {
      var tg = e.target.closest('[data-action]');
      if (!tg || tg.disabled || !ACTIONS[tg.dataset.action]) return;
      ACTIONS[tg.dataset.action](tg.dataset);
    });
    // Prévia no painel ao passar o mouse ou focar um cartão de opção.
    function onEnter(e) {
      var o = e.target.closest && e.target.closest('.option[data-slot]');
      if (o && !o.disabled) previewOption(o.dataset.slot, o.dataset.option);
    }
    function onLeave(e) {
      var o = e.target.closest && e.target.closest('.option[data-slot]');
      if (o && (!e.relatedTarget || !o.contains(e.relatedTarget))) clearPreview();
    }
    el.addEventListener('mouseover', onEnter);
    el.addEventListener('focusin', onEnter);
    el.addEventListener('mouseout', onLeave);
    el.addEventListener('focusout', onLeave);
  }

  Object.assign(ui, {
    render: render, renderHTML: renderHTML, mount: mount, actions: ACTIONS, langSwitch: langSwitch,
    register: function (id, screen) { screens[id] = screen; },
    screens: screens, hudCards: HUD,
    dispatch: dispatch, roomInfo: roomInfo, phaseLock: phaseLock, preview: previewOption, clearPreview: clearPreview,
    h: { esc: esc, badge: badge, icon: icon, credits: credits, sourcesBody: sourcesBody, sciValue: sciValue, stateTag: stateTag, stateIcon: stateIcon, value: value, explain: explain, specs: specs, scenario: scenario,
         term: term, rich: rich, labelOf: labelOf, segmentChip: segmentChip, statusText: statusText,
         choices: choices, metricRows: metricRows, statusRows: statusRows, resourcePanel: resourcePanel, levelPicker: levelPicker, byMode: byMode, uiMode: function () { return uiMode; } }
  });
})(globalThis);
