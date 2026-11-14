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

  // ------------------------------------------------------- Need & Goals
  ui.register('need', {
    nextLabel: 'scr.need.next',
    render: function (state) {
      var sc = h.scenario(state);
      var goals = sc.goals.map(function (g) {
        return '<li><span class="gid">' + h.esc(g.id) + '</span><span>' + h.rich(g.text) + '</span></li>';
      }).join('');
      var cons = sc.constraints.map(function (c) { return '<li>' + h.rich(c) + '</li>'; }).join('');
      var journey = MS.data.flow.phases.map(function (p) {
        return '<div><b>' + h.esc((p.nasaStep ? p.nasaStep + '. ' : '★ ') + L(p.title)) + '</b>' + h.esc(L(p.subtitle) || '') + '</div>';
      }).join('');
      var lat = sc.aoi.latitude_deg;
      return '<div class="card"><h2>' + h.esc(t('scr.need.pick')) + '</h2><p class="section-note">' + h.esc(t('scr.need.pickNote')) + '</p>' +
        scenarioCards(state) + '</div>' +
        '<div class="cols"><div>' +
        '<div class="card"><h2>' + h.esc(t('scr.need.problem')) + '</h2><p class="section-note">' + h.esc(t('scr.need.customer')) + ' ' + h.esc(L(sc.customer)) + ' · ' +
          h.segmentChip('user') + '</p>' +
        '<p>' + h.rich(sc.need) + '</p></div>' +
        '<div class="card"><h2>' + h.esc(t('scr.need.goals')) + '</h2><p class="section-note">' + h.esc(t('scr.need.goalsNote1')) + ' ' + h.term('requirement', t('scr.need.goalsTerm')) + ' ' + h.esc(t('scr.need.goalsNote2')) + '</p>' +
        '<ul class="goal-list">' + goals + '</ul></div></div>' +
        '<aside class="side"><div class="card"><h2>' + h.esc(t('scr.need.constraints')) + '</h2><ul>' + cons + '</ul>' +
        '<p class="small muted">' + h.esc(t('scr.need.aoi', { name: L(sc.aoi.name), area: U.withUnit(sc.aoi.area_km2, 'km²', 0), lat: U.fmt(Math.abs(lat), 0) + '° ' + (lat >= 0 ? 'N' : 'S') })) + '</p></div>' +
        '<div class="card"><h2>' + h.esc(t('scr.need.how')) + '</h2><p class="section-note">' + h.esc(t('scr.need.howNote')) + '</p>' +
        '<div class="journey">' + journey + '</div>' +
        '<p class="small muted" style="margin-top:10px">' + h.esc(t('scr.need.howMore')) + '</p></div></aside></div>';
    }
  });

  // ------------------------------------------------------------ Concept
  ui.register('concept', {
    render: function (state, result) {
      var checks = result.checks.filter(function (c) { return c.id === 'launch' || c.id === 'contact'; });
      return '<div class="cols"><div>' + h.choices(state, 'concept') + '</div>' +
        '<aside class="side"><div class="card"><h2>' + h.esc(t('scr.concept.defines')) + '</h2>' +
        '<p class="section-note">' + h.esc(t('scr.concept.note')) + '</p>' +
        h.metricRows(result, ['altitude_km', 'period_min', 'eclipse_pct', 'lifetime_years', 'passesPerDay', 'contactMinPerDay', 'launchWait_months']) +
        '</div><div class="card"><h2>' + h.esc(t('scr.compat')) + '</h2><p class="section-note">' + h.esc(t('scr.compatNote')) + '</p>' + h.statusRows(checks) + '</div></aside></div>';
    }
  });

  // ------------------------------------------------------- Requirements
  ui.register('requirements', {
    nextLabel: 'scr.req.next',
    render: function (state, result) {
      var sc = h.scenario(state);
      var goals = {};
      sc.goals.forEach(function (g) { goals[g.id] = L(g.text); });
      // Como cada requisito será verificado (plano da fase Build & Verify).
      var verif = {};
      result.verification.forEach(function (v) {
        v.items.forEach(function (it) { if (it.kind === 'requirement') verif[it.id] = v; });
      });
      var rows = result.requirements.map(function (r) {
        var now = r.status === 'pending'
          ? '<span class="muted small">' + h.esc(t('scr.req.pending')) + '</span>'
          : h.badge(r.status) + ' <span class="small">' + h.esc(t('scr.req.now')) + ' ' + h.esc(U.withUnit(r.value, r.unit, result.metrics[r.metric].decimals)) + '</span>';
        var v = verif[r.id];
        return '<li><div class="row-head"><strong>' + h.esc(r.id + ' · ' + r.title) + '</strong>' +
          (r.goal ? '<span class="small muted">' + h.esc(t('scr.req.fromGoal', { id: r.goal })) + '</span>' : '') + '</div>' +
          '<p style="margin:4px 0">' + h.esc(r.text) + '</p>' +
          (r.goal ? '<p class="small muted" style="margin:0 0 4px">' + h.esc(t('scr.req.goal', { id: r.goal })) + ' ' + h.rich(goals[r.goal] || '') + '</p>' : '') +
          (v ? '<p class="verif-by"><span>' + h.esc(t('scr.req.verifiedBy')) + '</span> <b>' + h.esc(v.method) + '</b> — ' + h.esc(v.title) + '</p>' : '') +
          h.explain(r.rationale, t('scr.req.whyValue')) + '<div style="margin-top:6px">' + now + '</div></li>';
      }).join('');
      return '<div class="card"><h2>' + h.esc(t('scr.req.title', { n: result.requirements.length })) + '</h2>' +
        '<p class="section-note">' + h.esc(t('scr.req.note1')) + ' ' + h.term('verification', t('scr.req.noteTerm')) + ' ' + h.esc(t('scr.req.note2')) + '</p>' +
        '<ul class="rows">' + rows + '</ul></div>';
    }
  });
})(globalThis);
