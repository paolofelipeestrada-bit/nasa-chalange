/* Testes da missão no tempo (js/life.js) com o clima espacial real (DONKI). */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert;
  var GOOD = {
    orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar',
    payload: 'cam_mid', structure: 'struct_3u', power: 'eps_deploy',
    adcs: 'adcs_wheels', comms: 'com_sband', obc: 'obc_basic'
  };
  function run(design, period, decisions) {
    return MS.sim.run({ scenarioId: 'eo_cubesat', design: design, period: period, decisions: decisions || {}, seed: 7 });
  }
  function all(policy) { return { storm: policy || 'radiation', memory: 'overwrite', power: 'reduce' }; }

  T.group('Missão no tempo');

  test('os dados do DONKI estão completos e dentro das janelas', function () {
    var P = MS.data.spaceWeather.periods;
    ['y2019', 'y2024'].forEach(function (id) {
      var p = P[id];
      assert(p.gst.length === p.totals.gst, id + ': tempestades');
      p.gst.concat(p.flr, p.sep).forEach(function (e) {
        assert(e[0] >= p.window[0] && e[0] <= p.window[1], id + ': data fora da janela ' + e[0]);
      });
    });
    assert(P.y2024.totals.gst > 5 * P.y2019.totals.gst, '2024 deveria ter muito mais tempestades');
  });

  test('sem data de lançamento, a missão é a de sempre (sem simulação no tempo)', function () {
    var r = run(GOOD, null);
    assert.equal(r.life, null);
    assert.equal(r.mission.status, 'ok');
  });

  test('a missão para no primeiro alerta e pede uma decisão', function () {
    var r = run(GOOD, 'y2024', {});
    assert.equal(r.mission.status, 'decide');
    assert.equal(r.mission.decision.id, 'storm');
    assert.equal(r.score.status, 'pending');
    assert(r.life.series.length > 0, 'deveria haver dados até o dia da decisão');
  });

  test('é determinística: mesmas escolhas, mesmo resultado', function () {
    var a = run(GOOD, 'y2024', all()), b = run(GOOD, 'y2024', all());
    assert.equal(JSON.stringify(a.life.totals), JSON.stringify(b.life.totals));
  });

  test('o Sol de 2024 derruba a órbita mais rápido que o de 2019', function () {
    var a = run(GOOD, 'y2019', all()).life.totals.altitudeLoss, b = run(GOOD, 'y2024', all()).life.totals.altitudeLoss;
    assert(b > 2 * a, '2024 (' + b + ' km) deveria perder bem mais que 2019 (' + a + ' km)');
  });

  test('ignorar os alertas reinicia o computador e gasta os painéis', function () {
    var keep = run(GOOD, 'y2024', all('keep')).life, prot = run(GOOD, 'y2024', all('radiation')).life;
    assert(keep.tally.resets > prot.tally.resets, 'mais reinícios sem proteção');
    assert(keep.totals.panels < prot.totals.panels, 'painéis mais gastos sem proteção');
  });

  test('o modo de segurança custa dias de foto', function () {
    var safe = run(GOOD, 'y2024', all('safe')).life, keep = run(GOOD, 'y2024', all('keep')).life;
    assert(safe.tally.safeDays > 0);
    assert(safe.tally.resets === 0, 'com modo de segurança em todo alerta, nenhum reinício');
    assert(safe.totals.altitudeLoss < keep.totals.altitudeLoss, 'de lado para o vento, menos arrasto');
  });

  test('a órbita da Estação Espacial cai antes de um ano em 2024', function () {
    var iss = Object.assign({}, GOOD, { orbit: 'iss400', launcher: 'iss_cargo' });
    var r = run(iss, 'y2024', all('keep'));
    assert.equal(r.life.totals.end, 'reentry');
    assert(r.life.totals.opDays < 365);
  });

  test('rádio lento: a memória enche e o jogo pergunta o que fazer', function () {
    var uhf = Object.assign({}, GOOD, { comms: 'com_uhf' });
    var r = run(uhf, 'y2019', { storm: 'keep' });
    assert.equal(r.mission.status, 'decide');
    assert.equal(r.mission.decision.id, 'memory');
  });

  test('a decisão vira regra: trocar o projeto apaga as decisões', function () {
    MS.store.init({ storage: null, render: function () {} });
    MS.store.setPeriod('y2024');
    MS.store.decide('storm', 'safe');
    assert.equal(MS.store.state.decisions.storm, 'safe');
    MS.store.select('orbit', 'sso500');
    assert.equal(JSON.stringify(MS.store.state.decisions), '{}');
    assert.throws(function () { MS.store.decide('storm', 'nada'); });
  });

  test('a tela da missão mostra a data, a decisão e os gráficos', function () {
    var s = Object.assign(MS.store.createState(), { phase: 'implement', reached: 'implement', design: Object.assign({}, GOOD) });
    T.assert.includes(MS.ui.renderHTML(s), 'data-action="period"');
    s.period = 'y2024';
    var html = MS.ui.renderHTML(s);
    T.assert.includes(html, 'data-action="decide"');
    T.assert.includes(html, 'life-chart');
    s.decisions = all();
    html = MS.ui.renderHTML(s);
    assert(html.indexOf('data-action="decide"') === -1, 'sem decisão pendente');
    T.assert.includes(html, 'ccmc.gsfc.nasa.gov/DONKI/view/GST/');
  });
})(globalThis);
