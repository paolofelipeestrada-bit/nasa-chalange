/* Telas: Build & Verify, Implement, Mission Report. */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h, U = MS.sim.util;

  function count(list, status) { return list.filter(function (x) { return x.status === status; }).length; }

  var RISK_TEXT = { ok: 'Protegido', warn: 'Exposto', na: 'Não se aplica' };

  // Registro de riscos: o que pode dar errado e se o projeto aguenta.
  function riskCard(result) {
    if (!result.risks.length) return '';
    var rows = result.risks.map(function (r) {
      return '<li><div class="row-head"><strong>' + h.esc(r.title) + '</strong>' + h.badge(r.status, RISK_TEXT[r.status]) + '</div>' +
        '<div class="small">' + h.esc(r.description) + '</div>' +
        (r.applies ? '<div class="small muted">Chance: ' + U.pct(r.chance) + ' · impacto: ' + h.esc(r.impact) + '</div>' : '') +
        h.explain(r.explanation, 'Por quê') + '</li>';
    }).join('');
    var exposed = count(result.risks, 'warn');
    return '<div class="card"><h2>Riscos da missão</h2><p class="small muted">Imprevistos são sorteados durante a missão. ' +
      'Um projeto com folga ou com as escolhas certas fica protegido. ' +
      (exposed ? exposed + ' risco(s) com o projeto exposto.' : 'Nenhum risco com o projeto exposto.') + '</p>' +
      '<ul class="rows">' + rows + '</ul></div>';
  }

  // ------------------------------------------------------ Build & Verify
  ui.register('build', {
    nextLabel: 'Lançar a missão',
    render: function (state, result) {
      var v = result.verification, fails = count(v, 'fail'), warns = count(v, 'warn');
      var alert = fails
        ? '<div class="alert s-fail"><strong>' + fails + ' verificação(ões) reprovada(s).</strong> Volte ao Design para corrigir, ' +
          'ou lance mesmo assim e veja as consequências na missão.</div>'
        : warns
          ? '<div class="alert s-warn"><strong>Aprovado com ressalvas:</strong> ' + warns + ' verificação(ões) com margem abaixo da recomendada.</div>'
          : '<div class="alert s-ok"><strong>Todas as verificações aprovadas.</strong> O satélite está pronto para o lançamento.</div>';
      var rows = v.map(function (x) {
        var items = x.items.map(function (it) {
          return '<li><div class="row-head"><span class="small">' + h.esc(it.label) + '</span>' + h.badge(it.status) + '</div>' +
            h.explain(it.explanation, 'Resultado') + '</li>';
        }).join('');
        return '<div class="card"><div class="row-head"><h3>' + h.esc(x.id + ' · ' + x.title) + '</h3>' + h.badge(x.status) + '</div>' +
          '<p class="small muted">Método: ' + h.esc(x.method) + ' — ' + h.esc(x.description) + '</p>' +
          '<ul class="rows">' + items + '</ul></div>';
      }).join('');
      return alert + rows + riskCard(result);
    }
  });

  // ----------------------------------------------------------- Implement
  ui.register('implement', {
    nextLabel: 'Ver relatório',
    render: function (state, result) {
      var m = result.mission;
      var events = m.events.map(function (e) {
        var causes = e.causes && e.causes.length ? h.explain(e.causes.join(' '), 'Causa') : '';
        return '<li><div class="when">' + h.esc(e.when) + '</div><div><div class="row-head"><span>' +
          (e.random ? '<span class="tag">Imprevisto</span>' : '') + '<strong>' + h.esc(e.title) + '</strong></span>' +
          h.badge(e.status) + '</div><p class="small">' + h.esc(e.text) + '</p>' + causes + '</div></li>';
      }).join('');
      var o = m.outcome;
      var summary = o ? '<div class="alert s-' + m.status + '"><strong>' +
        (m.aborted ? 'Missão perdida.' : 'Mapas entregues: ' + U.fmt(o.maps, 1) + ' de ' + U.fmt(o.target, 0) + '.') +
        '</strong> ' + h.esc(o.explanation) + '</div>' : '';
      return '<div class="card viz-card"><div data-viz="mission"></div></div>' +
        '<div class="card"><h2>Linha do tempo da missão</h2><ol class="timeline">' + events + '</ol></div>' + summary;
    }
  });

  // ------------------------------------------------------ Mission Report
  ui.register('report', {
    render: function (state, result) {
      var s = result.score;
      if (s.status === 'pending') return '<div class="alert s-warn">Complete o projeto para ver o relatório.</div>';
      var parts = s.parts.map(function (p) {
        return '<tr><td>' + h.esc(p.label) + '<div class="small muted">' + h.esc(p.explanation) + '</div></td>' +
          '<td class="num">' + U.fmt(p.points, 0) + ' / ' + U.fmt(p.max, 0) + '</td></tr>';
      }).join('');
      var lessons = result.lessons.length
        ? '<ul>' + result.lessons.map(function (l) { return '<li>' + h.esc(l.text) + '</li>'; }).join('') + '</ul>'
        : '<p>Nenhuma falha ou alerta. Para ir além, tente cumprir tudo gastando menos.</p>';
      var cost = result.metrics.cost_k;
      var happened = result.risks.filter(function (r) { return r.occurs; });
      var luck = '<div class="card"><h2>Imprevistos desta tentativa</h2>' + (happened.length
        ? '<ul class="rows">' + happened.map(function (r) {
            return '<li><div class="row-head"><strong>' + h.esc(r.title) + '</strong>' +
              h.badge(r.mitigated ? 'ok' : 'warn', r.mitigated ? 'Mitigado' : 'Causou dano') + '</div>' +
              '<div class="small muted">Impacto: ' + h.esc(r.impact) + '</div></li>';
          }).join('') + '</ul>'
        : '<p>Nenhum imprevisto aconteceu. Sorte! Veja no Build &amp; Verify os riscos a que o projeto ficou exposto.</p>') + '</div>';
      return '<div class="card"><div class="score"><span class="big">' + s.total + '</span><span class="muted">de ' + s.max +
        ' pontos</span><h2>' + h.esc(s.grade || '') + '</h2></div>' +
        '<p class="small muted">Tentativa ' + state.attempt + ' · custo ' + h.esc(h.value(cost)) + ' · ' +
        h.esc(result.mission.explanation) + '</p></div>' +
        '<div class="card"><h2>Pontuação</h2><div class="table-wrap"><table><tbody>' + parts + '</tbody></table></div></div>' +
        '<div class="card"><h2>Requisitos</h2>' + h.statusRows(result.requirements, { prefixId: true }) + '</div>' + luck +
        '<div class="card"><h2>Lições para a próxima tentativa</h2>' + lessons +
        '<div class="actions"><button type="button" class="btn primary" data-action="retry">Ajustar e simular de novo</button>' +
        '<button type="button" class="btn" data-action="reset">Recomeçar do zero</button></div></div>';
    }
  });
})(globalThis);
