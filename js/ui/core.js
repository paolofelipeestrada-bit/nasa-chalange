/* =====================================================================
 * ui/core.js — NÚCLEO DA INTERFACE
 *
 *   MS.ui.render(state)       redesenha tudo (chamado pelo store a cada ação)
 *   MS.ui.renderHTML(state)   mesmo HTML, como texto (usado nos testes)
 *   MS.ui.mount(el)           liga a interface a um elemento e aos cliques
 *   MS.ui.register(id, tela)  registra uma tela (ver js/ui/screens-*.js)
 *
 * Tela = { render(state, result) → HTML, nextLabel?: texto do botão Avançar }
 * "result" é sempre MS.sim.run(state): a tela só mostra, nunca calcula.
 *
 * Cliques: qualquer elemento com data-action="..." chama a ação de ACTIONS
 * (ex.: <button data-action="select" data-slot="orbit" data-option="sso500">).
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var ui = MS.ui = MS.ui || {};
  var screens = {};
  var U = MS.sim.util;

  // ------------------------------------------------------------- Helpers
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var STATUS_TEXT = { ok: 'OK', warn: 'Atenção', fail: 'Falha', pending: 'Pendente', skipped: 'Não ocorreu', na: 'Não se aplica' };
  function badge(status, text) {
    return '<span class="badge s-' + esc(status) + '">' + esc(text || STATUS_TEXT[status] || status) + '</span>';
  }
  function value(m) { return m && m.value != null ? U.withUnit(m.value, m.unit, m.decimals) : '—'; }
  function scenario(state) { return MS.data.scenarios[state.scenarioId]; }
  function explain(text, label) {
    return text ? '<details><summary>' + esc(label || 'Como foi calculado') + '</summary>' + esc(text) + '</details>' : '';
  }

  // Campos que aparecem nos cartões de opção: [campo, rótulo, unidade, casas].
  // Campo novo no catálogo? Acrescente aqui para ele aparecer nos cartões.
  var SPEC_FIELDS = [
    ['altitude_km', 'Altitude', 'km', 0], ['inclination_deg', 'Inclinação', '°', 1],
    ['lifetime_years', 'Vida orbital', 'anos', 1], ['orbits', 'Vai para', 'orbits'],
    ['maxMass_kg', 'Massa máx.', 'kg', 1], ['latitude_deg', 'Latitude', 'lat'], ['bands', 'Bandas', 'list'],
    ['focal_mm', 'Focal', 'mm', 0], ['pixelsAcross', 'Pixels/linha', '', 0],
    ['requiredPointing_deg', 'Exige apontar', '°', 2], ['capacity_U', 'Volume útil', 'U', 1],
    ['solarPower_W', 'Geração ao sol', 'W', 0], ['accuracy_deg', 'Precisão', '°', 2],
    ['band', 'Banda', 'text'], ['dataRate_kbps', 'Taxa', 'rate'], ['storage_GB', 'Memória', 'GB', 0],
    ['compressionRatio', 'Compressão', 'ratio'],
    ['mass_kg', 'Massa', 'kg', 2], ['power_W', 'Potência', 'W', 1], ['volume_U', 'Volume', 'U', 1],
    ['cost_k', 'Custo', 'k$', 0], ['maturity', 'Maturidade', 'maturity']
  ];
  function fmtSpec(v, unit, dec) {
    var cat = MS.data.catalog;
    if (unit === 'orbits') return v.map(function (id) { return cat.orbits[id] ? cat.orbits[id].name : id; }).join(', ');
    if (unit === 'list') return Array.isArray(v) ? v.join(', ') : String(v); // estação: lista · câmera: nº de bandas
    if (unit === 'text') return String(v);
    if (unit === 'lat') return U.fmt(Math.abs(v), 0) + '° ' + (v >= 0 ? 'N' : 'S');
    if (unit === 'rate') return v >= 1000 ? U.fmt(v / 1000, 1) + ' Mbps' : U.fmt(v, 1) + ' kbps';
    if (unit === 'ratio') return U.fmt(v, 0) + ':1';
    if (unit === 'maturity') return (cat.maturity[v] || {}).label || v;
    return U.withUnit(v, unit, dec);
  }
  // ff = formato da estrutura escolhida; sem formato, mostra "3U: x · 6U: y".
  function specs(item, ff) {
    var rows = SPEC_FIELDS.map(function (f) {
      var v = item[f[0]];
      if (v == null || (f[0] === 'power_W' && v === 0) || (f[0] === 'volume_U' && v === 0)) return '';
      var text;
      if (typeof v === 'object' && !Array.isArray(v)) {
        var one = U.byFF(v, ff);
        text = one != null ? fmtSpec(one, f[2], f[3])
          : Object.keys(v).map(function (k) { return k + ': ' + fmtSpec(v[k], f[2], f[3]); }).join(' · ');
      } else {
        text = fmtSpec(v, f[2], f[3]);
      }
      return '<dt>' + esc(f[1]) + '</dt><dd>' + esc(text) + '</dd>';
    }).join('');
    return '<dl class="specs">' + rows + '</dl>';
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
  // Cartões de escolha para todos os slots da fase indicada (vem dos dados).
  function choices(state, phaseId) {
    var cat = MS.data.catalog;
    var structId = state.design.structure;
    var ff = structId && cat.components[structId] ? cat.components[structId].formFactor : null;
    var room = roomInfo(), sc = scenario(state);
    return sc.slots.filter(function (s) { return s.phase === phaseId; }).map(function (slot) {
      var cur = state.design[slot.id];
      var owner = room ? MS.team.slotOwner(sc, room.members, slot.id) : null;
      var locked = room && !MS.team.can(sc, room.members, room.me, 'select', [slot.id]).ok;
      var ownerTag = owner && owner.role
        ? ' <span class="owner' + (owner.member && owner.member.id === room.me ? ' mine' : '') + '">' +
          esc(owner.role.name + ': ' + (owner.member ? owner.member.name : 'livre')) + '</span>' : '';
      var cards = slot.options.map(function (id) {
        var it = cat[slot.source][id], sel = cur === id;
        return '<button type="button" class="option' + (sel ? ' selected' : '') + '" aria-pressed="' + sel + '"' + (locked ? ' disabled' : '') +
          ' data-action="select" data-slot="' + esc(slot.id) + '" data-option="' + esc(id) + '">' +
          '<span class="option-name">' + esc(it.name) + '</span>' +
          '<span class="option-desc">' + esc(it.description || '') + '</span>' + specs(it, ff) + '</button>';
      }).join('');
      return '<section class="slot"><h3>' + esc(slot.label) + ownerTag + (cur ? '' : ' <span class="muted small">— escolha uma opção</span>') +
        '</h3><div class="options">' + cards + '</div></section>';
    }).join('');
  }

  // Lista de métricas do motor, com explicação.
  function metricRows(result, keys) {
    return '<ul class="rows">' + keys.map(function (k) {
      var m = result.metrics[k];
      return '<li><div class="row-head"><span>' + esc(m.label) + '</span><span class="value">' + esc(value(m)) +
        '</span></div>' + explain(m.explanation) + '</li>';
    }).join('') + '</ul>';
  }

  // Lista de itens com status: requisitos, verificações ou recursos.
  function statusRows(items, opts) {
    opts = opts || {};
    return '<ul class="rows">' + items.map(function (x) {
      var title = (opts.prefixId ? x.id + ' · ' : '') + (x.title || x.label);
      return '<li><div class="row-head"><span><strong>' + esc(title) + '</strong></span>' + badge(x.status) + '</div>' +
        (x.text ? '<div class="small">' + esc(x.text) + '</div>' : '') +
        (x.status === 'pending' ? '<div class="small muted">' + esc(x.explanation) + '</div>' : explain(x.explanation, 'Por quê')) +
        (x.hint ? '<div class="hint">' + esc(x.hint) + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  // Painel de recursos: barra de uso + marca da folga recomendada.
  function resourcePanel(result) {
    return result.resources.map(function (r) {
      var use = r.usage == null ? 0 : Math.max(0, Math.min(100, r.usage * 100));
      var mark = r.recommendedMargin > 0 ? '<div class="mark" style="left:' + ((1 - r.recommendedMargin) * 100) + '%"></div>' : '';
      return '<div class="res s-' + r.status + '"><div class="row-head"><span>' + esc(r.label) + '</span>' + badge(r.status) + '</div>' +
        '<div class="bar"><div class="fill" style="width:' + use + '%"></div>' + mark + '</div>' +
        '<div class="res-text">' + esc(r.explanation) + '</div></div>';
    }).join('') + '<p class="small muted">A marca na barra é o limite recomendado (folga mínima).</p>';
  }

  // ------------------------------------------------------- Moldura da tela
  function header(state, info) {
    var lock = phaseLock(state), room = MS.net ? MS.net.info() : { inRoom: false };
    var steps = info.phases.map(function (p, i) {
      var cls = i === info.index ? 'current' : i < info.index ? 'done' : '';
      return '<li><button type="button" class="' + cls + '" data-action="goto" data-phase="' + esc(p.id) + '"' +
        (i > info.reachedIndex || (lock && i !== info.index) ? ' disabled' : '') + (i === info.index ? ' aria-current="step"' : '') + '>' +
        (i + 1) + '. ' + esc(p.title) + '</button></li>';
    }).join('');
    return '<header class="top"><div class="brand"><strong>' + esc(scenario(state).title) + '</strong>' +
      '<span class="muted small">Tentativa ' + state.attempt +
      ' · <button type="button" class="btn small" data-action="team-toggle">' + (room.inRoom ? 'Equipe · ' + esc(room.code) : 'Jogar em equipe') + '</button>' +
      ' <button type="button" class="btn small" data-action="reset"' + (lock ? ' disabled' : '') + '>Recomeçar</button></span></div>' +
      '<nav class="steps" aria-label="Fases"><ol>' + steps + '</ol></nav></header>';
  }

  function footer(state, info, screen) {
    var can = MS.store.canAdvance(state);
    var next = info.phases[info.index + 1];
    var lock = phaseLock(state);
    var right = can.isLast
      ? '<button type="button" class="btn primary" data-action="retry"' + (lock ? ' disabled' : '') + '>Ajustar e simular de novo</button>'
      : '<button type="button" class="btn primary" data-action="next"' + (can.ok && !lock ? '' : ' disabled') + '>' +
        esc(screen && screen.nextLabel ? screen.nextLabel : 'Avançar: ' + next.title) + ' →</button>';
    var missing = can.missing.length ? 'Falta escolher: ' + can.missing.join(', ') : '';
    if (lock) missing = lock + (missing ? ' ' + missing + '.' : '');
    return '<footer class="nav"><div class="nav-inner">' +
      '<button type="button" class="btn" data-action="prev"' + (info.index === 0 || lock ? ' disabled' : '') + '>← Voltar</button>' +
      '<span class="missing">' + esc(missing) + '</span>' + right + '</div></footer>';
  }

  function renderHTML(state) {
    var info = MS.store.phaseInfo(state);
    var screen = screens[info.current.screen];
    var body;
    try {
      var result = MS.sim.run(state);
      body = screen ? screen.render(state, result)
        : '<div class="alert s-fail">A tela "' + esc(info.current.screen) + '" não foi registrada.</div>';
    } catch (e) {
      body = '<div class="alert s-fail">Erro ao montar a tela: ' + esc(e.message) + '</div>';
      if (root.console) console.error(e);
    }
    var problems = MS.sim.validate(MS.data);
    var warn = problems.length
      ? '<div class="alert s-fail"><strong>Problemas nos dados:</strong><ul>' +
        problems.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' : '';
    return header(state, info) + '<main>' + warn + (ui.teamPanel ? ui.teamPanel(state) : '') +
      '<div class="phase-head"><h1>' + esc(info.current.title) + '</h1><p class="muted">' + esc(info.current.subtitle || '') + '</p></div>' +
      body + '</main>' + footer(state, info, screen);
  }

  // --------------------------------------------------------------- Ações
  // Com sala ativa, a ação vai para o anfitrião (MS.net); sozinho, direto ao store.
  function dispatch(name, args) {
    if (MS.net && MS.net.active()) return MS.net.dispatch(name, args);
    return MS.store[name].apply(null, args || []);
  }
  var ACTIONS = {
    select: function (d) { dispatch('select', [d.slot, d.option]); },
    next: function () { dispatch('nextPhase'); },
    prev: function () { dispatch('prevPhase'); },
    goto: function (d) { dispatch('goToPhase', [d.phase]); },
    retry: function () { dispatch('retry'); },
    reset: function () {
      var msg = roomInfo() ? 'Apagar as escolhas da equipe inteira e começar do zero?' : 'Apagar todas as escolhas e começar do zero?';
      if (root.confirm(msg)) dispatch('reset');
    }
  };

  var rootEl = null, lastPhase = null;
  function render(state) {
    if (!rootEl) return;
    rootEl.innerHTML = renderHTML(state);
    if (MS.viz && MS.viz.attachAll) MS.viz.attachAll(rootEl, state); // visual 3D (se a tela tiver um)
    if (state.phase !== lastPhase) {
      root.scrollTo(0, 0);
      lastPhase = state.phase;
      var nav = rootEl.querySelector('.steps'), cur = rootEl.querySelector('.steps .current');
      if (nav && cur) nav.scrollLeft = cur.offsetLeft - nav.offsetLeft - 16; // celular: fase atual visível
    }
  }
  function mount(el) {
    rootEl = el;
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action]');
      if (!t || t.disabled || !ACTIONS[t.dataset.action]) return;
      ACTIONS[t.dataset.action](t.dataset);
    });
  }

  Object.assign(ui, {
    render: render, renderHTML: renderHTML, mount: mount, actions: ACTIONS,
    register: function (id, screen) { screens[id] = screen; },
    screens: screens,
    dispatch: dispatch, roomInfo: roomInfo,
    h: { esc: esc, badge: badge, value: value, explain: explain, specs: specs, scenario: scenario,
         choices: choices, metricRows: metricRows, statusRows: statusRows, resourcePanel: resourcePanel }
  });
})(globalThis);
