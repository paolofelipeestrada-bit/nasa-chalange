/* Telas: Need & Goals, Concept, Requirements.
 * Cada tela só lê o state e o resultado do motor; escolhas viram ações
 * pelo data-action dos cartões (ver ui/core.js). */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h, U = MS.sim.util;

  // ------------------------------------------------------- Need & Goals
  ui.register('need', {
    nextLabel: 'Começar o conceito',
    render: function (state) {
      var sc = h.scenario(state);
      var goals = sc.goals.map(function (g) {
        return '<li><span class="gid">' + h.esc(g.id) + '</span><span>' + h.esc(g.text) + '</span></li>';
      }).join('');
      var cons = sc.constraints.map(function (c) { return '<li>' + h.rich(c) + '</li>'; }).join('');
      var journey = MS.data.flow.phases.map(function (p) {
        return '<div><b>' + h.esc(p.short || p.title) + '</b>' + h.esc(p.subtitle || '') + '</div>';
      }).join('');
      return '<div class="cols"><div>' +
        '<div class="card"><h2>O problema do cliente</h2><p class="section-note">Cliente: ' + h.esc(sc.customer) + '</p>' +
        '<p>' + h.esc(sc.need) + '</p></div>' +
        '<div class="card"><h2>Objetivos da missão</h2><p class="section-note">O que a missão precisa entregar. Cada objetivo vira um [[requirement|requisito]] na fase 3.</p>'.replace('[[requirement|requisito]]', h.term('requirement', 'requisito')) +
        '<ul class="goal-list">' + goals + '</ul></div></div>' +
        '<aside class="side"><div class="card"><h2>Restrições</h2><ul>' + cons + '</ul>' +
        '<p class="small muted">Área de interesse: <b>' + h.esc(sc.aoi.name) + '</b> — ' + h.esc(U.withUnit(sc.aoi.area_km2, 'km²', 0)) +
        ', perto da latitude ' + h.esc(U.fmt(Math.abs(sc.aoi.latitude_deg), 0)) + '° ' + (sc.aoi.latitude_deg >= 0 ? 'N' : 'S') + '.</p></div>' +
        '<div class="card"><h2>Como se joga</h2><p class="section-note">Você passa pelas mesmas fases de um projeto espacial de verdade:</p>' +
        '<div class="journey">' + journey + '</div>' +
        '<p class="small muted" style="margin-top:10px">Dá para voltar, ajustar e simular de novo quantas vezes quiser. ' +
        'Para jogar com amigos, use <b>Jogar em equipe</b> no topo.</p></div></aside></div>';
    }
  });

  // ------------------------------------------------------------ Concept
  ui.register('concept', {
    render: function (state, result) {
      var checks = result.checks.filter(function (c) { return c.id === 'launch' || c.id === 'contact'; });
      return '<div class="cols"><div>' + h.choices(state, 'concept') + '</div>' +
        '<aside class="side"><div class="card"><h2>O que o conceito define</h2>' +
        '<p class="section-note">Calculado na hora a partir das suas escolhas. Clique em "Como foi calculado" para ver a conta.</p>' +
        h.metricRows(result, ['altitude_km', 'period_min', 'eclipse_pct', 'lifetime_years', 'passesPerDay', 'contactMinPerDay']) +
        '</div><div class="card"><h2>Compatibilidade</h2><p class="section-note">As escolhas combinam entre si?</p>' + h.statusRows(checks) + '</div></aside></div>';
    }
  });

  // ------------------------------------------------------- Requirements
  ui.register('requirements', {
    nextLabel: 'Projetar o satélite',
    render: function (state, result) {
      var sc = h.scenario(state);
      var goals = {};
      sc.goals.forEach(function (g) { goals[g.id] = g.text; });
      var rows = result.requirements.map(function (r) {
        var now = r.status === 'pending'
          ? '<span class="muted small">Ainda não dá para avaliar: depende das escolhas do Design.</span>'
          : h.badge(r.status) + ' <span class="small">Com o conceito atual: ' + h.esc(U.withUnit(r.value, r.unit, result.metrics[r.metric].decimals)) + '</span>';
        return '<li><div class="row-head"><strong>' + h.esc(r.id + ' · ' + r.title) + '</strong>' +
          (r.goal ? '<span class="small muted">vem do objetivo ' + h.esc(r.goal) + '</span>' : '') + '</div>' +
          '<p style="margin:4px 0">' + h.esc(r.text) + '</p>' +
          (r.goal ? '<p class="small muted" style="margin:0 0 4px">Objetivo ' + h.esc(r.goal) + ': ' + h.esc(goals[r.goal] || '') + '</p>' : '') +
          h.explain(r.rationale, 'Por que este valor') + '<div style="margin-top:6px">' + now + '</div></li>';
      }).join('');
      return '<div class="card"><h2>Os ' + result.requirements.length + ' requisitos da missão</h2>' +
        '<p class="section-note">Cada ' + h.term('requirement', 'requisito') + ' será conferido numa ' + h.term('verification', 'verificação') +
        ' antes do lançamento. Guarde estes números: o painel do Design mostra se o projeto os cumpre.</p>' +
        '<ul class="rows">' + rows + '</ul></div>';
    }
  });
})(globalThis);
