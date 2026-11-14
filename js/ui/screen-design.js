/* Tela: Design — o "cockpit" do Mission Director (canvas Cockpits por papel).
 *   esquerda: peças em abas, uma por papel da equipe (Ciência, Satélite, Comunicação)
 *   centro:   hangar (satélite montado) + "Ripple effect" (cadeia de efeitos)
 *   direita:  checagem da missão (requisitos) + conselhos da equipe (MS.advice)
 *   abaixo:   lista de equipamentos (MEL), fechada por padrão
 * A aba aberta é preferência de quem joga (ui.local), não vai para o state. */
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

  // Abas de peças: os slots do Design agrupados pelo papel dono (team.roles).
  var TAB_OF_ROLE = { payload: 'sci', bus: 'eng', ground: 'com' };
  function partTabs(state) {
    var sc = h.scenario(state);
    var design = sc.slots.filter(function (s) { return s.phase === 'design'; }).map(function (s) { return s.id; });
    var tabs = [], used = {};
    ((sc.team && sc.team.roles) || []).forEach(function (role) {
      var key = TAB_OF_ROLE[role.id];
      var slots = (role.slots || []).filter(function (id) { return design.indexOf(id) >= 0 && !used[id]; });
      if (!key || !slots.length) return;
      slots.forEach(function (id) { used[id] = true; });
      tabs.push({ key: key, slots: slots });
    });
    var rest = design.filter(function (id) { return !used[id]; });   // slot sem dono: vai na aba Satélite
    if (rest.length) {
      var eng = tabs.filter(function (x) { return x.key === 'eng'; })[0];
      if (eng) eng.slots = eng.slots.concat(rest); else tabs.push({ key: 'eng', slots: rest });
    }
    tabs.forEach(function (tb) { tb.done = tb.slots.filter(function (id) { return state.design[id]; }).length; });
    return tabs;
  }
  function currentTab(tabs) {
    var want = ui.local.partsTab;
    if (want && tabs.some(function (x) { return x.key === want; })) return want;
    var open = tabs.filter(function (x) { return x.done < x.slots.length; })[0];
    return (open || tabs[0] || {}).key;
  }

  function partsPanel(state) {
    var tabs = partTabs(state), cur = currentTab(tabs);
    var all = tabs.reduce(function (n, x) { return n + x.slots.length; }, 0);
    var done = tabs.reduce(function (n, x) { return n + x.done; }, 0);
    var bar = '<div class="ck-tabs" role="tablist" aria-label="' + h.esc(t('ck.parts')) + '">' + tabs.map(function (tb) {
      var on = tb.key === cur, full = tb.done === tb.slots.length;
      return '<button type="button" role="tab" class="ck-tab r-' + tb.key + (on ? ' on' : '') + '" aria-selected="' + on + '" data-action="tab" data-tab="' + tb.key + '">' +
        h.icon(tb.key, { size: 18 }) + '<span>' + h.esc(t('ck.tab.' + tb.key)) + '</span>' +
        '<span class="ck-tab-n' + (full ? ' full' : '') + '">' + (full ? h.icon('ok', { size: 13, stroke: 3 }) : tb.done + '/' + tb.slots.length) + '</span></button>';
    }).join('') + '</div>';
    var active = tabs.filter(function (x) { return x.key === cur; })[0];
    return '<section class="ck-panel ck-parts"><div class="ck-head"><h2>' + h.esc(t('ck.parts')) + '</h2>' +
      '<span class="ck-count">' + h.esc(t('ck.chosen', { n: done, total: all })) + '</span></div>' +
      '<p class="section-note">' + h.esc(t('ck.partsNote')) + '</p>' + bar +
      '<div class="ck-tabpanel" role="tabpanel">' + (active ? h.choices(state, 'design', active.slots) : '') + '</div></section>';
  }

  // Centro: satélite montado + cadeia de efeitos da última troca.
  function centerPanel(state) {
    var cz = ui.local.cascade && ui.local.cascade.phase === state.phase ? ui.local.cascade.html : '';
    return '<section class="ck-center">' +
      '<div class="card hangar-card"><div data-viz="hangar"></div></div>' +
      '<div class="ck-panel ck-ripple"><div class="ck-head"><h2>' + h.icon('arrow', { size: 16 }) + h.esc(t('ck.ripple')) + '</h2></div>' +
      (cz ? '<div class="cascade ripple" aria-live="polite">' + cz + '</div>'
          : '<p class="section-note ck-empty">' + h.esc(t('ck.rippleEmpty')) + '</p>') + '</div></section>';
  }

  var OPS = { '<=': '≤', '>=': '≥', '<': '<', '>': '>' };
  // Requisitos do cliente em forma de checklist: título, valor × meta e estado.
  function missionCheck(result) {
    return '<ul class="ck-checks">' + result.requirements.map(function (r) {
      var val = r.status === 'pending' ? '—' : U.withUnit(r.value, r.unit, 1);
      return '<li class="s-' + r.status + '" title="' + h.esc(r.text) + '"><span class="ck-ci">' + h.icon(h.stateIcon(r.status), { size: 16, stroke: 2.6 }) + '</span>' +
        '<span class="ck-ct"><b>' + h.esc(r.title) + '</b><span class="small muted">' + h.esc((OPS[r.op] || r.op) + ' ' + U.withUnit(r.threshold, r.unit, 1)) + '</span></span>' +
        '<span class="ck-cv">' + h.esc(val) + '</span></li>';
    }).join('') + '</ul>';
  }

  // Conselhos da equipe: uma fala por papel, com a meta e o voto sugerido.
  function crewPanel(state, result) {
    var list = MS.advice.crew(state, result);
    return '<div class="ck-panel ck-crew"><div class="ck-head"><h2>' + h.icon('team', { size: 16 }) + h.esc(t('ck.crew')) + '</h2></div>' +
      '<p class="section-note">' + h.esc(t('ck.crewNote')) + '</p>' + crewList(list) + '</div>';
  }
  function crewList(list, opts) {
    opts = opts || {};
    return '<ul class="crew">' + list.map(function (a) {
      var vote = opts.votes && a.vote ? '<span class="vote v-' + a.vote + '">' + h.icon(a.vote === 'go' ? 'ok' : 'fail', { size: 14, stroke: 2.6 }) + h.esc(t(a.vote === 'go' ? 'ck.go' : 'ck.nogo')) + '</span>' : '';
      return '<li class="crew-item r-' + a.key + ' s-' + a.status + '"><span class="crew-av">' + h.icon(a.key, { size: 20 }) + '</span>' +
        '<div class="crew-body"><div class="crew-top"><b>' + h.esc(a.name) + '</b>' + (vote || h.stateTag(a.status)) + '</div>' +
        '<p>' + h.esc(a.text) + '</p><span class="crew-goal">' + h.esc(t('ck.goal')) + ': ' + h.esc(a.goal) + '</span></div></li>';
    }).join('') + '</ul>';
  }

  ui.actions.tab = function (d) { ui.local.partsTab = d.tab; if (MS.store.state) ui.render(MS.store.state); };

  ui.register('design', {
    nextLabel: 'scr.design.next',
    render: function (state, result) {
      return '<div class="cockpit">' + partsPanel(state) + centerPanel(state) +
        '<aside class="ck-side"><div class="ck-panel"><div class="ck-head"><h2>' + h.icon('ok', { size: 16 }) + h.esc(t('ck.check')) + '</h2></div>' +
        '<p class="section-note ck-cust">' + h.esc(L(h.scenario(state).title)) + '</p>' + missionCheck(result) + '</div>' +
        crewPanel(state, result) + '</aside></div>' +
        '<details class="card ck-mel"><summary>' + h.esc(t('ck.mel')) + '</summary>' +
        '<p class="section-note">' + h.esc(t('mel.intro1')) + ' ' + h.term('contingency', t('mel.introTerm')) + '.</p>' +
        melTable(state, result) + '</details>';
    }
  });

  ui.h.melTable = melTable;
  ui.h.crewList = crewList;
  ui.h.missionCheck = missionCheck;
})(globalThis);
