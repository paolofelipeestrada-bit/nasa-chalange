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
        return '<li><strong>' + h.esc(g.id) + '</strong> — ' + h.esc(g.text) + '</li>';
      }).join('');
      var cons = sc.constraints.map(function (c) { return '<li>' + h.esc(c) + '</li>'; }).join('');
      return '<div class="card"><h2>A necessidade</h2><p class="muted small">Cliente: ' + h.esc(sc.customer) + '</p>' +
        '<p>' + h.esc(sc.need) + '</p></div>' +
        '<div class="card"><h2>Objetivos da missão</h2><ul>' + goals + '</ul></div>' +
        '<div class="card"><h2>Restrições</h2><ul>' + cons + '</ul>' +
        '<p class="small muted">Área de interesse: ' + h.esc(sc.aoi.name) + ' — ' + h.esc(U.withUnit(sc.aoi.area_km2, 'km²', 0)) +
        ', perto da latitude ' + h.esc(U.fmt(Math.abs(sc.aoi.latitude_deg), 0)) + '° ' + (sc.aoi.latitude_deg >= 0 ? 'N' : 'S') + '.</p></div>' +
        '<div class="card"><h2>Como funciona</h2><p>Você vai escolher o conceito da missão, conhecer os requisitos, ' +
        'projetar o satélite, verificar o projeto e lançar. No fim, o relatório mostra o que deu certo, o que falhou e por quê. ' +
        'Dá para ajustar e simular de novo quantas vezes quiser.</p></div>';
    }
  });

  // ------------------------------------------------------------ Concept
  ui.register('concept', {
    render: function (state, result) {
      var checks = result.checks.filter(function (c) { return c.id === 'launch' || c.id === 'contact'; });
      return '<div class="cols"><div>' + h.choices(state, 'concept') + '</div>' +
        '<aside class="side"><div class="card"><h2>Análise do conceito</h2>' +
        h.metricRows(result, ['altitude_km', 'period_min', 'eclipse_pct', 'lifetime_years', 'passesPerDay', 'contactMinPerDay']) +
        '</div><div class="card"><h2>Compatibilidade</h2>' + h.statusRows(checks) + '</div></aside></div>';
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
          ? '<span class="muted small">Ainda não dá para avaliar: faltam escolhas do Design.</span>'
          : '<span class="small">Com o conceito atual: ' + h.esc(U.withUnit(r.value, r.unit, result.metrics[r.metric].decimals)) + '</span> ' + h.badge(r.status);
        return '<li><div class="row-head"><strong>' + h.esc(r.id + ' · ' + r.title) + '</strong></div>' +
          '<p>' + h.esc(r.text) + '</p>' +
          (r.goal ? '<p class="small muted">Atende ao objetivo ' + h.esc(r.goal) + ': ' + h.esc(goals[r.goal] || '') + '</p>' : '') +
          h.explain(r.rationale, 'Por que este valor') + '<div>' + now + '</div></li>';
      }).join('');
      return '<div class="card"><p>Os objetivos viraram requisitos mensuráveis. ' +
        'O projeto será verificado contra cada um deles na fase Build &amp; Verify.</p>' +
        '<ul class="rows">' + rows + '</ul></div>';
    }
  });
})(globalThis);
