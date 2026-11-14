/* Tela: Design — escolha dos componentes, MEL e painel de recursos. */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h, U = MS.sim.util;

  function num(x, d) { return x == null ? '—' : U.fmt(x, d); }

  // MEL: uma linha por slot de componente (escolhido ou não).
  function melTable(state, result) {
    var mel = result.mel, byslot = {};
    mel.items.forEach(function (it) { byslot[it.slot] = it; });
    var rows = h.scenario(state).slots.filter(function (s) { return s.source === 'components'; }).map(function (slot) {
      var it = byslot[slot.id];
      if (!it) return '<tr><td>' + h.esc(slot.label) + '</td><td colspan="7" class="muted">— não escolhido —</td></tr>';
      return '<tr><td>' + h.esc(slot.label) + '</td><td>' + h.esc(it.name) + '<div class="small muted">' + h.esc(it.maturityLabel) + '</div></td>' +
        '<td class="num">' + num(it.mass_kg, 2) + '</td><td class="num">' + U.pct(it.contingency) + '</td>' +
        '<td class="num">' + num(it.massTotal_kg, 2) + '</td><td class="num">' + num(it.avgPowerTotal_W, 2) + '</td>' +
        '<td class="num">' + num(it.volume_U, 1) + '</td><td class="num">' + num(it.cost_k, 0) + '</td></tr>';
    }).join('');
    var t = mel.totals;
    return '<div class="table-wrap"><table><thead><tr><th>Subsistema</th><th>Item</th><th class="num">Massa (kg)</th>' +
      '<th class="num">Contingência</th><th class="num">Massa + cont. (kg)</th><th class="num">Potência média (W)</th>' +
      '<th class="num">Volume (U)</th><th class="num">Custo (k$)</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="2">Total do satélite' + (mel.partial ? ' (parcial)' : '') + '</td>' +
      '<td class="num">' + num(t.mass_kg, 2) + '</td><td></td><td class="num">' + num(t.massTotal_kg, 2) + '</td>' +
      '<td class="num">' + num(t.avgPowerTotal_W, 2) + '</td><td class="num">' + num(t.volume_U, 1) + '</td>' +
      '<td class="num">' + num(t.cost_k, 0) + '</td></tr></tfoot></table></div>' +
      '<p class="small muted">Potência média = potência ligado × fração do tempo ligado, com contingência. ' +
      'A contingência é uma reserva que cresce quanto menos testado o item é. ' +
      'O custo total no painel inclui também lançamento e estação em solo.</p>';
  }

  ui.register('design', {
    nextLabel: 'Integrar e verificar',
    render: function (state, result) {
      var checks = result.checks.filter(function (c) { return c.id === 'pointing' || c.id === 'band' || c.id === 'launch'; });
      return '<div class="cols"><div>' + h.choices(state, 'design') + '</div>' +
        '<aside class="side"><div class="card"><h2>Recursos</h2>' + h.resourcePanel(result) + '</div>' +
        '<div class="card"><h2>Requisitos</h2>' + h.statusRows(result.requirements, { prefixId: true }) + '</div>' +
        '<div class="card"><h2>Compatibilidade</h2>' + h.statusRows(checks) + '</div></aside></div>' +
        '<div class="card"><h2>MEL — lista de equipamentos</h2>' + melTable(state, result) + '</div>';
    }
  });

  ui.h.melTable = melTable;
})(globalThis);
