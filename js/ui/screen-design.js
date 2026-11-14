/* Tela: Design — escolha dos componentes, MEL e painel de recursos. */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h, U = MS.sim.util;
  var t = MS.i18n.t, L = MS.i18n.L;

  function num(x, d) { return x == null ? '—' : U.fmt(x, d); }

  // MEL: uma linha por slot de componente (escolhido ou não).
  function melTable(state, result) {
    var mel = result.mel, byslot = {};
    mel.items.forEach(function (it) { byslot[it.slot] = it; });
    var rows = h.scenario(state).slots.filter(function (s) { return s.source === 'components'; }).map(function (slot) {
      var it = byslot[slot.id];
      if (!it) return '<tr><td>' + h.esc(L(slot.label)) + '</td><td colspan="7" class="muted">— ' + h.esc(t('mel.notChosen')) + ' —</td></tr>';
      return '<tr><td>' + h.esc(L(slot.label)) + '</td><td>' + h.esc(it.name) + '<div class="small muted">' + h.esc(it.maturityLabel) + '</div></td>' +
        '<td class="num">' + num(it.mass_kg, 2) + '</td><td class="num">' + U.pct(it.contingency) + '</td>' +
        '<td class="num">' + num(it.massTotal_kg, 2) + '</td><td class="num">' + num(it.avgPowerTotal_W, 2) + '</td>' +
        '<td class="num">' + num(it.volume_U, 1) + '</td><td class="num">' + num(it.cost_k, 0) + '</td></tr>';
    }).join('');
    var tt = mel.totals;
    return '<div class="table-wrap"><table><thead><tr><th>' + h.esc(t('mel.subsystem')) + '</th><th>' + h.esc(t('mel.item')) + '</th><th class="num">' + h.esc(t('mel.mass')) + '</th>' +
      '<th class="num">' + h.esc(t('mel.contingency')) + '</th><th class="num">' + h.esc(t('mel.massCont')) + '</th><th class="num">' + h.esc(t('mel.power')) + '</th>' +
      '<th class="num">' + h.esc(t('mel.volume')) + '</th><th class="num">' + h.esc(t('mel.cost')) + '</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="2">' + h.esc(t('mel.total')) + (mel.partial ? ' (' + h.esc(t('mel.partial')) + ')' : '') + '</td>' +
      '<td class="num">' + num(tt.mass_kg, 2) + '</td><td></td><td class="num">' + num(tt.massTotal_kg, 2) + '</td>' +
      '<td class="num">' + num(tt.avgPowerTotal_W, 2) + '</td><td class="num">' + num(tt.volume_U, 1) + '</td>' +
      '<td class="num">' + num(tt.cost_k, 0) + '</td></tr></tfoot></table></div>' +
      '<p class="small muted">' + h.esc(t('mel.note')) + '</p>';
  }

  // Resumo do projeto: requisitos, recursos, custo e escolhas feitas.
  function summary(state, result) {
    function chip(status, icon, html) { return '<div class="sum s-' + status + '"><span class="ic">' + icon + '</span><span>' + html + '</span></div>'; }
    var reqs = result.requirements, okR = reqs.filter(function (r) { return r.status === 'ok'; }).length;
    var failR = reqs.some(function (r) { return r.status === 'fail'; });
    var res = result.resources, okRes = res.filter(function (r) { return r.status === 'ok'; }).length;
    var failRes = res.some(function (r) { return r.status === 'fail'; });
    var pendRes = res.some(function (r) { return r.status === 'pending'; });
    var slots = h.scenario(state).slots.filter(function (s) { return s.phase === 'design'; });
    var done = slots.filter(function (s) { return state.design[s.id]; }).length;
    return '<div class="summary">' +
      chip(done === slots.length ? 'ok' : 'pending', done === slots.length ? '✓' : done, h.esc(t('sum.choices')) + ' <b>' + done + '/' + slots.length + '</b>') +
      chip(failR ? 'fail' : okR === reqs.length ? 'ok' : 'pending', failR ? '!' : okR === reqs.length ? '✓' : '…', h.esc(t('sum.reqs')) + ' <b>' + okR + '/' + reqs.length + '</b>') +
      chip(failRes ? 'fail' : okRes === res.length ? 'ok' : pendRes ? 'pending' : 'warn',
        failRes ? '!' : okRes === res.length ? '✓' : pendRes ? '…' : '~',
        h.esc(t('sum.margins')) + ' <b>' + okRes + '/' + res.length + '</b>') +
      '</div>';
  }

  ui.register('design', {
    nextLabel: 'scr.design.next',
    render: function (state, result) {
      var checks = result.checks.filter(function (c) { return c.id === 'pointing' || c.id === 'band' || c.id === 'launch'; });
      return summary(state, result) +
        '<div class="cols"><div>' + h.choices(state, 'design') + '</div>' +
        '<aside class="side">' + '<div class="card hangar-card"><div data-viz="hangar"></div></div>' + '<div class="card"><h2>' + h.esc(t('scr.design.resources')) + '</h2><p class="section-note">' + h.esc(t('scr.design.resourcesNote')) + '</p>' + h.resourcePanel(result) + '</div>' +
        '<div class="card"><h2>' + h.esc(t('scr.design.reqs')) + '</h2><p class="section-note">' + h.esc(t('scr.design.reqsNote')) + '</p>' + h.statusRows(result.requirements, { prefixId: true }) + '</div>' +
        '<div class="card"><h2>' + h.esc(t('scr.compat')) + '</h2>' + h.statusRows(checks) + '</div></aside></div>' +
        '<div class="card"><h2>' + h.term('mel', t('mel.title')) + '</h2>' +
        '<p class="section-note">' + h.esc(t('mel.intro1')) + ' ' + h.term('contingency', t('mel.introTerm')) + '.</p>' +
        melTable(state, result) + '</div>';
    }
  });

  ui.h.melTable = melTable;
})(globalThis);
