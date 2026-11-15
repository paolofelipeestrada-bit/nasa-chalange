/* Testes dos níveis de dificuldade (js/levels.js + js/data/levels.js). */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert, LV = MS.levels;
  var GOOD = {
    orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar',
    payload: 'cam_mid', structure: 'struct_3u', power: 'eps_deploy',
    adcs: 'adcs_wheels', comms: 'com_sband', obc: 'obc_basic'
  };
  function stateWith(sid, level, design) {
    var s = MS.store.createState(sid, level);
    s.design = LV.autoFill(LV.scenario(s), Object.assign({}, s.design, design || {}));
    s.seed = null; // sem sorteio: a nota não depende da sorte
    return s;
  }
  function resOf(r, id) { return r.resources.filter(function (x) { return x.id === id; })[0]; }

  T.group('Níveis de dificuldade');

  test('Normal é o cenário original, sem cópia', function () {
    Object.keys(MS.data.scenarios).forEach(function (id) {
      assert(LV.apply(MS.data.scenarios[id], 'normal') === MS.data.scenarios[id], id);
    });
    assert.equal(LV.id({}), 'normal');
    assert.equal(LV.id({ difficulty: 'xyz' }), 'normal');
  });

  test('Fácil: mais dinheiro e prazo, menos imprevistos, 2 peças fixas e o foguete segue a órbita', function () {
    var base = MS.data.scenarios.eo_cubesat, sc = LV.apply(base, 'easy');
    assert.equal(sc.budget_k, Math.round(base.budget_k * 1.3));
    assert.equal(sc.params.deadline_months, base.params.deadline_months + 6);
    assert(sc.randomEvents[0].chance < base.randomEvents[0].chance);
    var s = MS.store.createState('eo_cubesat', 'easy');
    assert.equal(s.design.adcs, 'adcs_wheels');
    assert.equal(s.design.obc, 'obc_basic');
    MS.store.init({ storage: null, render: function () {} });
    MS.store.setDifficulty('easy');
    MS.store.select('orbit', 'sso600');
    assert.equal(MS.store.state.design.launcher, 'rideshare_tug', 'foguete que vai para a SSO 600');
    MS.store.select('orbit', 'iss400');
    assert.equal(MS.store.state.design.launcher, 'iss_cargo');
    assert.equal(base.slots.filter(function (x) { return x.id === 'adcs'; })[0].options.length, 2, 'o cenário original não muda');
  });

  test('Fácil: a Dica de cada cliente leva a uma missão bem-sucedida', function () {
    Object.keys(MS.data.scenarios).forEach(function (sid) {
      var rec = MS.data.levels.easy.recommend[sid];
      assert(rec, 'sem dica para ' + sid);
      var r = MS.sim.run(stateWith(sid, 'easy', rec));
      assert(r.complete, sid + ': projeto incompleto');
      assert(r.score.total >= 90, sid + ': nota ' + r.score.total);
      Object.keys(rec).forEach(function (slot) { assert.equal(LV.recommended({ scenarioId: sid, difficulty: 'easy' }, slot), rec[slot]); });
      assert.equal(LV.recommended({ scenarioId: sid, difficulty: 'normal' }, 'orbit'), null, 'sem dica no Normal');
    });
  });

  test('Difícil: menos dinheiro, mais imprevistos e as escolhas novas (bateria e blindagem)', function () {
    var base = MS.data.scenarios.eo_cubesat, sc = LV.apply(base, 'hard');
    assert(sc.budget_k < base.budget_k);
    assert(sc.params.deadline_months < base.params.deadline_months);
    var ids = sc.slots.map(function (x) { return x.id; });
    assert(ids.indexOf('battery') === ids.indexOf('power') + 1, 'bateria logo depois da energia');
    assert(ids.indexOf('shield') !== -1);
    var bus = sc.team.roles.filter(function (r) { return r.id === 'bus'; })[0];
    assert(bus.slots.indexOf('battery') !== -1 && bus.slots.indexOf('shield') !== -1);
    assert(sc.randomEvents.some(function (e) { return e.id === 'RE7'; }));
    // Os cenários do Difícil passam na mesma validação dos dados
    var d = Object.assign({}, MS.data, { scenarios: {} });
    Object.keys(MS.data.scenarios).forEach(function (k) { d.scenarios[k] = LV.apply(MS.data.scenarios[k], 'hard'); });
    var problems = MS.sim.validate(d);
    assert.equal(problems.length, 0, problems.join(' | '));
  });

  test('Difícil: a bateria precisa cobrir a sombra com folga; a blindagem protege da radiação', function () {
    var small = MS.sim.run(stateWith('eo_cubesat', 'hard', Object.assign({}, GOOD, { battery: 'bat_10', shield: 'shield_none' })));
    var mid = MS.sim.run(stateWith('eo_cubesat', 'hard', Object.assign({}, GOOD, { battery: 'bat_20', shield: 'shield_ta' })));
    assert(resOf(small, 'battery').status !== 'ok', 'bateria de 10 Wh deveria ficar sem folga');
    assert.equal(resOf(mid, 'battery').status, 'ok');
    assert(small.metrics.batteryNeed_Wh.value > 5 && small.metrics.batteryNeed_Wh.value < 15, 'necessidade ' + small.metrics.batteryNeed_Wh.value);
    var re7 = function (r) { return r.risks.filter(function (x) { return x.id === 'RE7'; })[0]; };
    assert.equal(re7(small).mitigated, false);
    assert.equal(re7(mid).mitigated, true);
    assert(!resOf(MS.sim.run(stateWith('eo_cubesat', 'normal', GOOD)), 'battery'), 'sem bateria no Normal');
  });

  test('o nível fica salvo no state e vale para a equipe toda', function () {
    var s = MS.store.createState('eo_cubesat', 'hard');
    var back = MS.store.sanitize(JSON.parse(JSON.stringify(s)));
    assert.equal(back.difficulty, 'hard');
    assert('battery' in back.design);
    var old = JSON.parse(JSON.stringify(s)); delete old.difficulty;
    assert.equal(MS.store.sanitize(old).difficulty, 'normal', 'progresso antigo continua no Normal');
    var members = [{ id: 'a', name: 'A', roles: ['manager'] }, { id: 'b', name: 'B', roles: ['bus'] }];
    var sc = MS.data.scenarios.eo_cubesat;
    assert(MS.team.can(sc, members, 'a', 'setDifficulty', ['easy']).ok, 'o gerente troca o nível');
    assert(!MS.team.can(sc, members, 'b', 'setDifficulty', ['easy']).ok, 'os outros não');
  });

  test('telas: Fácil mostra escolhas do jogo e Dica; Difícil mostra bateria e blindagem', function () {
    var easy = Object.assign(stateWith('eo_cubesat', 'easy', { orbit: 'sso500', groundStation: 'gs_polar' }), { phase: 'design', reached: 'design' });
    var html = MS.ui.renderHTML(easy);
    T.assert.includes(html, 'slot-auto');
    T.assert.includes(html, 'data-action="hint"');
    T.assert.includes(MS.ui.renderHTML(MS.store.createState('eo_cubesat', 'easy')), 'data-action="level"'); // seletor na fase 1
    var hard = Object.assign(stateWith('eo_cubesat', 'hard', { orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar' }), { phase: 'design', reached: 'design' });
    html = MS.ui.renderHTML(hard);
    T.assert.includes(html, 'data-slot="battery"');
    T.assert.includes(html, 'data-slot="shield"');
    MS.ui.renderHTML(MS.store.createState('eo_cubesat')); // volta o modo da tela ao Normal
  });
  test('Fácil tem só 4 escolhas do jogador; Normal sem "Ver a conta"; Difícil com tudo aberto', function () {
    var easy = LV.scenario({ scenarioId: 'eo_cubesat', difficulty: 'easy' });
    assert.equal(easy.slots.filter(function (x) { return !x.auto; }).map(function (x) { return x.id; }).join(','), 'orbit,payload,structure,power');
    var conc = function (lvl) {
      return Object.assign(stateWith('eo_cubesat', lvl, { orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar' }), { phase: 'concept', reached: 'concept' });
    };
    var calc = MS.ui.h.esc(MS.i18n.t('ui.howCalc'));
    assert(MS.ui.renderHTML(conc('normal')).indexOf(calc) === -1, 'Normal sem as contas');
    assert(MS.ui.renderHTML(conc('easy')).indexOf(calc) === -1, 'Fácil sem as contas');
    var full = MS.ui.renderHTML(conc('hard'));
    T.assert.includes(full, calc);
    T.assert.includes(full, 'calc-panel');
    assert(MS.ui.renderHTML(conc('normal')).indexOf('calc-panel') === -1, 'cálculos só no Difícil');
    MS.ui.renderHTML(MS.store.createState('eo_cubesat'));
  });

  test('Calcule você mesmo: cada equação dá o mesmo número que o motor e a resolução fecha', function () {
    var st = stateWith('eo_cubesat', 'hard', Object.assign({}, GOOD, { battery: 'bat_20', shield: 'shield_ta' }));
    var r = MS.sim.run(st), m = r.metrics, R = 6371, MU = 398600.4418;
    MS.data.calcs.forEach(function (c) {
      var g = c.given(m, r.selection), ans = c.answer(m);
      assert(g && ans != null, c.id + ' deveria estar liberado com o projeto completo');
      ['en', 'pt', 'es'].forEach(function (l) { assert(c.title[l] && c.why[l], c.id + ' sem texto ' + l); });
      c.steps.forEach(function (s) {
        var keys = (s.pt.match(/\{(\w+)\}/g) || []).map(function (x) { return x.slice(1, -1); });
        var w = c.work ? c.work(m) : {};
        keys.forEach(function (k) { assert(k === 'answer' || k in g || k in w, c.id + ': {' + k + '} sem valor'); });
      });
    });
    var p = function (id) { return MS.data.calcs.filter(function (c) { return c.id === id; })[0]; };
    var a = R + m.altitude_km.value;
    assert(Math.abs(p('period').answer(m) - 2 * Math.PI * Math.sqrt(a * a * a / MU) / 60) < 1e-6, 'período');
    var cam = r.selection.payload;
    assert(Math.abs(p('gsd').answer(m) - m.altitude_km.value * 1000 * cam.pixel_um * 1e-6 / (cam.focal_mm * 1e-3)) < 1e-6, 'GSD');
    assert.equal(MS.ui.calcCheck(94.6, MS.ui.calcParse('94,5')), 'ok');
    assert.equal(MS.ui.calcCheck(94.6, MS.ui.calcParse('5676')), 'units', 'segundos em vez de minutos');
    assert.equal(MS.ui.calcCheck(94.6, MS.ui.calcParse('80')), 'no');
    assert.equal(MS.ui.calcCheck(94.6, MS.ui.calcParse('abc')), 'nan');
    assert.equal(MS.ui.calcParse('1.234,5'), 1234.5);
  });
})(globalThis);
