/* Telas: Need & Goals, Concept, Requirements.
 * Cada tela só lê o state e o resultado do motor; escolhas viram ações
 * pelo data-action dos cartões (ver ui/core.js). */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h, U = MS.sim.util;
  var t = MS.i18n.t, L = MS.i18n.L;

  // Cartões de cliente: escolher o cenário é escolher o objetivo da missão.
  function scenarioCards(state) {
    var scs = MS.data.scenarios;
    var lock = ui.roomInfo() && !MS.team.can(h.scenario(state), ui.roomInfo().members, ui.roomInfo().me, 'setScenario', []).ok;
    return '<div class="scen-grid">' + Object.keys(scs).map(function (id) {
      var sc = scs[id], on = id === state.scenarioId, c = sc.card || {};
      return '<button type="button" class="scen' + (on ? ' selected' : '') + '" data-action="scenario" data-id="' + h.esc(id) + '" aria-pressed="' + on + '"' + (lock ? ' disabled' : '') + '>' +
        '<span class="scen-ic" aria-hidden="true">' + h.esc(c.icon || '🛰️') + '</span>' +
        '<span class="scen-title">' + h.esc(L(sc.title)) + '</span>' +
        '<span class="scen-cust">' + h.esc(L(sc.customer)) + '</span>' +
        '<span class="scen-pitch">' + h.esc(L(c.pitch)) + '</span>' +
        '<span class="scen-meta">' + h.esc(t('scr.budget')) + ' ' + h.esc(U.fmt(sc.budget_k, 0)) + ' k$ · ' + h.esc(L(c.challenge)) + '</span>' +
        (on ? '<span class="scen-on">✓ ' + h.esc(t('scr.thisMission')) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }

  // Abertura: como vai jogar (sozinho com conselheiros ou em equipe).
  // Versão curta: uma linha por modo; a explicação fica na dica ao passar o mouse.
  function lobby() {
    var room = MS.net ? MS.net.info() : { inRoom: false };
    var roles = ['sci', 'eng', 'mgr', 'com'].map(function (k) {
      return '<span class="lb-role r-' + k + '">' + h.icon(k, { size: 16 }) + '</span>';
    }).join('');
    return '<section class="lobby compact" aria-label="' + h.esc(t('lobby.title')) + '"><div class="lb-seats">' +
      '<div class="lb-seat' + (room.inRoom ? '' : ' on') + '" title="' + h.esc(t('lobby.soloText')) + '"><span class="lb-av r-dir">' + h.icon('dir', { size: 20 }) + '</span>' +
        '<b>' + h.esc(t('lobby.solo')) + '</b>' + (room.inRoom ? '' : h.stateTag('ok', t('lobby.playing'))) + '</div>' +
      '<div class="lb-seat' + (room.inRoom ? ' on' : '') + '" title="' + h.esc(t('lobby.teamText')) + '"><span class="lb-roles">' + roles + '</span>' +
        '<b>' + h.esc(t('lobby.team')) + '</b>' +
        (room.inRoom ? h.stateTag('ok', t('lobby.inRoom', { code: room.code })) : '<button type="button" class="btn small" data-action="team-toggle">' + h.icon('team', { size: 16 }) + h.esc(t('lobby.teamBtn')) + '</button>') +
      '</div></div></section>';
  }

  // ------------------------------------------------------- Need & Goals
  // Uma decisão por tela: escolher o cliente. Embaixo, a missão dele num
  // cartão só (problema, objetivos e limites em uma linha).
  ui.register('need', {
    nextLabel: 'scr.need.next',
    render: function (state) {
      var sc = h.scenario(state);
      var goals = sc.goals.map(function (g) {
        return '<li><span class="gid">' + h.esc(g.id) + '</span><span>' + h.rich(g.text) + '</span></li>';
      }).join('');
      var lat = sc.aoi.latitude_deg;
      var limits = sc.constraints.map(function (c) { return '<li>' + h.rich(c) + '</li>'; }).join('') +
        '<li>' + h.esc(t('scr.need.aoi', { name: L(sc.aoi.name), area: U.withUnit(sc.aoi.area_km2, 'km²', 0), lat: U.fmt(Math.abs(lat), 0) + '° ' + (lat >= 0 ? 'N' : 'S') })) + '</li>';
      return '<div class="card"><h2>' + h.esc(t('scr.need.pick')) + '</h2>' + scenarioCards(state) + '</div>' +
        lobby() +
        '<div class="card mission-brief"><h2>' + h.esc(t('scr.need.goals')) + '</h2>' +
        '<p class="brief-need">' + h.rich(sc.need) + '</p>' +
        '<ul class="goal-list">' + goals + '</ul>' +
        '<details class="brief-limits"><summary>' + h.esc(t('scr.need.constraints')) + '</summary><ul>' + limits + '</ul></details></div>';
    }
  });

  // ------------------------------------------------------------ Concept
  // Comparação das órbitas: 4 efeitos em palavras simples, uma coluna por órbita.
  // Os números vêm do motor (MS.advice.orbitCompare → MS.sim.run).
  var EFFECT_ICON = { cover: 'eye', detail: 'sci', contact: 'comms', life: 'time' };
  function effectText(id, v) {
    var U = MS.sim.util;
    if (v == null) return '—';
    if (id === 'cover') return isFinite(v) ? t('orb.coverV', { n: U.fmt(v, v < 10 ? 1 : 0) }) : t('orb.coverNever');
    if (id === 'detail') return t('orb.detailV', { m: U.fmt(v, 0) });
    if (id === 'contact') return t('orb.contactV', { m: U.fmt(v, 0) });
    return v < 1 ? t('orb.lifeMonths', { n: U.fmt(v * 12, 0) }) : t('orb.lifeV', { n: U.fmt(v, v < 10 ? 1 : 0) });
  }
  function stars(n) {
    if (n == null) return '';
    return '<span class="orb-stars s' + n + '" aria-label="' + h.esc(t('orb.stars', { n: n })) + '">' +
      [1, 2, 3].map(function (i) { return '<i class="' + (i <= n ? 'on' : '') + '"></i>'; }).join('') + '</span>';
  }
  function orbitPanel(state) {
    var cmp = MS.advice.orbitCompare(state), cat = MS.data.catalog;
    // Um bloco por efeito; dentro, uma linha por órbita (cabe na coluna estreita).
    var body = cmp.effects.map(function (e) {
      return '<li class="orb-eff"><div class="orb-q">' + h.icon(EFFECT_ICON[e.id], { size: 16 }) + '<b>' + h.esc(t('orb.' + e.id)) + '</b>' +
        '<small>' + h.esc(t('orb.' + e.id + 'Q')) + '</small></div><ul>' + cmp.rows.map(function (r) {
          return '<li class="' + (r.chosen ? 'on' : '') + (r.stars[e.id] === 0 ? ' never' : '') + '"><span class="orb-n">' + h.esc(L(cat.orbits[r.id].name)) +
            (r.chosen ? ' <span class="orb-mine">' + h.icon('ok', { size: 11, stroke: 3 }) + h.esc(t('orb.yours')) + '</span>' : '') + '</span>' +
            stars(r.stars[e.id]) + '<span class="orb-v">' + h.esc(effectText(e.id, r.values[e.id])) + '</span></li>';
        }).join('') + '</ul></li>';
    }).join('');
    var refs = [];
    if (cmp.refPayload) refs.push(t('orb.refCam', { cam: L(cat.components[cmp.refPayload].name) }));
    if (cmp.refStation) refs.push(t('orb.refGs', { gs: L(cat.groundStations[cmp.refStation].name) }));
    return '<div class="ck-panel orb-panel"><div class="ck-head"><h2>' + h.icon('eye', { size: 16 }) + h.esc(t('orb.title')) + '</h2></div>' +
      '<p class="section-note">' + h.esc(t('orb.note', { region: L(h.scenario(state).aoi.name) })) + '</p>' +
      '<ul class="orb-cmp">' + body + '</ul>' +
      (refs.length ? '<p class="small muted">' + h.esc(refs.join(' ')) + '</p>' : '') + '</div>';
  }

  ui.register('concept', {
    render: function (state, result) {
      var checks = result.checks.filter(function (c) { return c.id === 'launch' || c.id === 'contact'; });
      var all = h.scenario(state).slots.filter(function (s) { return s.phase === 'concept'; });
      var done = all.filter(function (s) { return state.design[s.id]; }).length;
      // Mesmo cockpit do Design: escolhas à esquerda, foguete + órbitas no
      // centro, números e compatibilidade à direita.
      return '<div class="cockpit concept-ck"><section class="ck-panel ck-parts"><div class="ck-head"><h2>' + h.esc(t('ck.choices')) + '</h2>' +
        '<span class="ck-count">' + h.esc(t('ck.chosen', { n: done, total: all.length })) + '</span></div>' + h.choices(state, 'concept') + '</section>' +
        '<div class="ck-right"><section class="ck-center"><div class="card hangar-card"><div data-viz="hangar"></div></div>' + orbitPanel(state) + '</section>' +
        '<aside class="ck-side"><div class="ck-panel"><div class="ck-head"><h2>' + h.esc(t('scr.concept.defines')) + '</h2></div>' +
        '<p class="section-note">' + h.esc(t('scr.concept.note')) + '</p>' +
        h.metricRows(result, ['altitude_km', 'lifetime_years', 'eclipse_pct', 'contactMinPerDay', 'launchWait_months']) +
        '</div><div class="ck-panel"><div class="ck-head"><h2>' + h.esc(t('scr.compat')) + '</h2></div><p class="section-note">' + h.esc(t('scr.compatNote')) + '</p>' + h.statusRows(checks) + '</div></aside></div></div>';
    }
  });

  // ------------------------------------------------------- Requirements
  // Cada requisito como uma cadeia: objetivo do cliente → requisito (número e
  // meta) → escolhas de que depende → como será verificado. Embaixo, o estado
  // agora. As escolhas vêm do motor (requirement.drivers ← MS.sim.metricSlots).
  var OPS_REQ = { '<=': '≤', '>=': '≥', '<': '<', '>': '>' };
  function driverChip(state, sc, slotId) {
    var slot = sc.slots.filter(function (x) { return x.id === slotId; })[0];
    if (!slot) return '';
    var cur = state.design[slotId], cat = MS.data.catalog[slot.source] || {};
    var name = cur && cat[cur] ? L(cat[cur].name) : t(slot.phase === 'design' ? 'req3.inDesign' : 'req3.notYet');
    return '<li class="req-dr' + (cur ? ' set' : '') + '"><b>' + h.esc(L(slot.label)) + '</b><span>' + h.esc(name) + '</span></li>';
  }
  function reqChain(state, sc, r, goal, v, metric) {
    var target = r.ref ? t('req3.refTarget', { m: L((MS.sim.metricInfo()[r.ref] || {}).label) || r.ref })
      : (OPS_REQ[r.op] || r.op) + ' ' + U.withUnit(r.threshold, r.unit, r.threshold === Math.round(r.threshold) ? 0 : 1);
    var now = r.status === 'pending'
      ? '<span class="muted">' + h.esc(t('req3.waiting')) + '</span>'
      : h.stateTag(r.status) + ' <span>' + h.esc(t('req3.now', { v: U.withUnit(r.value, r.unit, metric ? metric.decimals : 1) })) + '</span>';
    var arrow = '<span class="req-arrow" aria-hidden="true">' + h.icon('arrow', { size: 18 }) + '</span>';
    return '<li class="req-chain s-' + r.status + '">' +
      '<div class="req-steps">' +
        '<div class="req-step req-goal"><span class="eyebrow">' + h.icon('team', { size: 14 }) + h.esc(t('req3.goal')) + '</span>' +
          '<p>“' + h.rich(goal || '') + '”</p></div>' + arrow +
        '<div class="req-step req-main"><span class="eyebrow">' + h.esc(r.id) + ' · ' + h.esc(t('req3.req')) + '</span>' +
          '<b class="req-title">' + h.esc(r.title) + '</b><span class="req-target' + (r.ref ? ' ref' : ' pixel') + '">' + h.esc(target) + '</span></div>' + arrow +
        '<div class="req-step req-drivers"><span class="eyebrow">' + h.icon('eng', { size: 14 }) + h.esc(t('req3.drivers')) + '</span>' +
          '<ul>' + (r.drivers || []).map(function (id) { return driverChip(state, sc, id); }).join('') + '</ul></div>' + arrow +
        '<div class="req-step req-verif"><span class="eyebrow">' + h.icon('ok', { size: 14 }) + h.esc(t('req3.verify')) + '</span>' +
          (v ? '<b>' + h.esc(v.method) + '</b><span class="small">' + h.esc(v.title) + '</span>' : '<span class="muted small">—</span>') + '</div>' +
      '</div>' +
      '<div class="req-now">' + now + (r.hint ? '<span class="hint" data-label="' + h.esc(t('ui.tip')) + '">' + h.esc(r.hint) + '</span>' : '') + '</div>' +
      h.explain(r.rationale, t('scr.req.whyValue')) + '</li>';
  }

  ui.register('requirements', {
    nextLabel: 'scr.req.next',
    render: function (state, result) {
      var sc = h.scenario(state);
      var goals = {};
      sc.goals.forEach(function (g) { goals[g.id] = g.text; });
      // Como cada requisito será verificado (plano da fase Build & Verify).
      var verif = {};
      result.verification.forEach(function (v) {
        v.items.forEach(function (it) { if (it.kind === 'requirement') verif[it.id] = v; });
      });
      var n = { ok: 0, fail: 0, pending: 0 };
      result.requirements.forEach(function (r) { n[r.status === 'ok' ? 'ok' : r.status === 'pending' ? 'pending' : 'fail']++; });
      var chip = function (k, ic, key) { return n[k] ? '<span class="rs s-' + k + '">' + h.icon(ic, { size: 14, stroke: 2.6 }) + h.esc(t(key, { n: n[k] })) + '</span>' : ''; };
      var strip = '<div class="req-strip">' + chip('ok', 'ok', 'req3.nOk') + chip('fail', 'fail', 'req3.nFail') + chip('pending', 'pending', 'req3.nPending') + '</div>';
      var rows = result.requirements.map(function (r) {
        return reqChain(state, sc, r, r.goal ? goals[r.goal] : '', verif[r.id], result.metrics[r.metric]);
      }).join('');
      return '<div class="ck-panel req-panel"><div class="ck-head"><h2>' + h.esc(t('scr.req.title', { n: result.requirements.length })) + '</h2>' + strip + '</div>' +
        '<p class="section-note">' + h.esc(t('req3.note')) + ' ' + h.term('verification', t('scr.req.noteTerm')) + '.</p>' +
        '<ol class="req-list">' + rows + '</ol></div>';
    }
  });
})(globalThis);
