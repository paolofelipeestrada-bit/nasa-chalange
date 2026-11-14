/* Testes do motor (js/sim.js) usando os dados reais de /js/data. */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert;
  var sim = MS.sim;

  // Projeto de referência que cumpre tudo (670 k$).
  var GOOD = {
    orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar',
    payload: 'cam_mid', structure: 'struct_3u', power: 'eps_deploy',
    adcs: 'adcs_wheels', comms: 'com_sband', obc: 'obc_basic'
  };
  function design(changes) { return Object.assign({}, GOOD, changes || {}); }
  function runWith(changes, data) { return sim.run({ scenarioId: 'eo_cubesat', design: design(changes) }, data); }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  // ------------------------------------------------------------------
  T.group('Dados');

  test('os dados de /js/data passam na validação', function () {
    var problems = sim.validate(MS.data);
    assert(problems.length === 0, problems.join(' | '));
  });

  test('a validação acusa métrica inexistente num requisito', function () {
    var d = clone(MS.data);
    d.scenarios.eo_cubesat.requirements[0].metric = 'nao_existe';
    assert(sim.validate(d).some(function (p) { return p.indexOf('nao_existe') !== -1; }));
  });

  test('a validação acusa opção que não existe no catálogo', function () {
    var d = clone(MS.data);
    d.scenarios.eo_cubesat.slots[0].options.push('orbita_fantasma');
    assert(sim.validate(d).some(function (p) { return p.indexOf('orbita_fantasma') !== -1; }));
  });

  // ------------------------------------------------------------------
  T.group('Física');

  test('período orbital a 500 km ≈ 94,5 min (15,2 órbitas/dia)', function () {
    var om = sim.util.orbitModel({ altitude_km: 500, inclination_deg: 97.4 });
    assert.near(om.period_min, 94.47, 0.05);
    assert.near(om.orbitsPerDay, 15.24, 0.02);
  });

  test('tempo na sombra a 500 km ≈ 37,8% da órbita', function () {
    var om = sim.util.orbitModel({ altitude_km: 500, inclination_deg: 97.4 });
    assert.near(om.eclipseFraction, 0.378, 0.002);
  });

  test('estação polar: ~11 passagens/dia em SSO e nenhuma na órbita da ISS', function () {
    var cat = MS.data.catalog;
    var sso = sim.util.orbitModel(cat.orbits.sso500), iss = sim.util.orbitModel(cat.orbits.iss400);
    assert.near(sim.util.contactModel(sso, cat.groundStations.gs_polar).passesPerDay, 11.45, 0.1);
    assert.equal(sim.util.contactModel(iss, cat.groundStations.gs_polar).passesPerDay, 0);
  });

  test('GSD = altitude × pixel ÷ focal (25 m a 500 km, 20 m a 400 km)', function () {
    assert.near(runWith().metrics.gsd_m.value, 25, 1e-9);
    assert.near(runWith({ orbit: 'iss400', launcher: 'iss_cargo' }).metrics.gsd_m.value, 20, 1e-9);
  });

  test('números no padrão brasileiro', function () {
    assert.equal(sim.util.fmt(1234.5, 1), '1.234,5');
    assert.equal(sim.util.fmt(0.05, 2), '0,05');
    assert.equal(sim.util.fmt(Infinity), '∞');
    assert.equal(sim.util.withUnit(37.8, '%', 1), '37,8%');
    assert.equal(sim.util.withUnit(25, 'm', 1), '25,0 m');
  });

  // ------------------------------------------------------------------
  T.group('Projeto incompleto');

  test('design vazio: nada quebra e tudo fica pendente', function () {
    var r = sim.run({ scenarioId: 'eo_cubesat', design: {} });
    assert.equal(r.complete, false);
    assert.equal(r.missing.length, 9);
    r.requirements.forEach(function (q) { assert.equal(q.status, 'pending', q.id); });
    assert.equal(r.mission.status, 'pending');
    assert.equal(r.score.status, 'pending');
    assert.includes(r.metrics.gsd_m.explanation, 'Falta escolher');
  });

  test('soma parcial: custo já estourado acusa falha antes de terminar', function () {
    var r = sim.run({ scenarioId: 'eo_cubesat', design: {
      structure: 'struct_6u', payload: 'cam_hr', power: 'eps_deploy', adcs: 'adcs_wheels',
      comms: 'com_sband', obc: 'obc_adv', groundStation: 'gs_polar'
    } });
    assert.equal(byId(r.resources, 'cost').status, 'fail', 'custo'); // 755 k$ sem lançador
    assert.equal(byId(r.resources, 'mass').status, 'pending', 'massa sem lançador');
  });

  // ------------------------------------------------------------------
  T.group('Projeto de referência');

  test('cumpre os 4 requisitos', function () {
    runWith().requirements.forEach(function (q) { assert.equal(q.status, 'ok', q.id + ': ' + q.explanation); });
  });

  test('nenhuma verificação falha e todos os recursos têm folga', function () {
    runWith().checks.forEach(function (c) { assert.equal(c.status, 'ok', c.id + ': ' + c.explanation); });
  });

  test('MEL: 6 itens, 3,35 kg com contingência, satélite de 390 k$', function () {
    var mel = runWith().mel;
    assert.equal(mel.items.length, 6);
    assert.near(mel.totals.massTotal_kg, 3.3525, 1e-6);
    assert.equal(mel.totals.cost_k, 390);
  });

  test('custo total 670 k$ (satélite + lançamento + estação)', function () {
    assert.equal(runWith().metrics.cost_k.value, 670);
  });

  test('missão: 9 eventos ok, nota 100, nenhuma lição', function () {
    var r = runWith();
    assert.equal(r.mission.status, 'ok');
    r.mission.events.forEach(function (e) { assert.equal(e.status, 'ok', e.id); });
    assert.equal(r.score.total, 100);
    assert.equal(r.score.grade, 'Missão exemplar');
    assert.equal(r.lessons.length, 0);
  });

  test('textos dos eventos recebem os valores calculados', function () {
    assert.includes(byId(runWith().mission.events, 'E5').text, '25,0 m');
  });

  test('requisitos, verificações e métricas sempre têm explicação', function () {
    [runWith(), runWith({ comms: 'com_uhf', adcs: 'adcs_mag' }), sim.run({ scenarioId: 'eo_cubesat', design: {} })]
      .forEach(function (r) {
        r.requirements.concat(r.checks).forEach(function (x) {
          assert(x.explanation && x.explanation.length > 10, x.id + ' sem explicação');
        });
        Object.keys(r.metrics).forEach(function (k) { assert(r.metrics[k].explanation, k + ' sem explicação'); });
      });
  });

  // ------------------------------------------------------------------
  T.group('Trade-offs e falhas');

  test('câmera grande-angular: R1 falha (55 m > 30 m) e traz dica', function () {
    var r1 = byId(runWith({ payload: 'cam_wide' }).requirements, 'R1');
    assert.equal(r1.status, 'fail');
    assert.near(r1.value, 55, 1e-9);
    assert(r1.hint, 'deveria ter dica');
  });

  test('rádio UHF: R3 falha (não dá para baixar as imagens)', function () {
    var r = runWith({ comms: 'com_uhf' });
    assert.equal(byId(r.requirements, 'R3').status, 'fail');
    assert.equal(byId(r.checks, 'downlink').status, 'fail');
  });

  test('estação nacional + computador básico: R3 falha', function () {
    assert.equal(byId(runWith({ groundStation: 'gs_national' }).requirements, 'R3').status, 'fail');
  });

  test('estação nacional + computador avançado: R3 passa com alerta de margem', function () {
    var r = runWith({ groundStation: 'gs_national', obc: 'obc_adv' });
    assert.equal(byId(r.requirements, 'R3').status, 'ok');
    assert.equal(byId(r.checks, 'downlink').status, 'warn');
    assert(r.score.total >= 90 && r.score.total < 100, 'nota ' + r.score.total);
  });

  test('órbita da ISS com estação polar: sem contato, missão perdida', function () {
    var r = runWith({ orbit: 'iss400', launcher: 'iss_cargo' });
    assert.equal(byId(r.checks, 'contact').status, 'fail');
    assert.equal(r.mission.aborted, 'E4');
    assert.equal(r.mission.outcome.maps, 0);
    assert.equal(byId(r.mission.events, 'E5').status, 'skipped');
  });

  test('órbita da ISS: vida curta (R4) e revisita longa (R2)', function () {
    var r = runWith({ orbit: 'iss400', launcher: 'iss_cargo', groundStation: 'gs_national', obc: 'obc_adv' });
    assert.equal(byId(r.requirements, 'R4').status, 'fail');
    assert.equal(byId(r.requirements, 'R2').status, 'fail');
    assert.equal(r.mission.aborted, null);
  });

  test('lançador que não vai para a órbita: missão termina no lançamento', function () {
    var r = runWith({ orbit: 'iss400' }); // rideshare só vai para SSO
    assert.equal(byId(r.checks, 'launch').status, 'fail');
    assert.equal(r.mission.aborted, 'E1');
  });

  test('telescópio numa estrutura 3U: não cabe', function () {
    var r = runWith({ payload: 'cam_hr' });
    assert.equal(byId(r.checks, 'volume').status, 'fail');
    assert.equal(r.mission.aborted, 'E1');
  });

  test('painéis fixos em 3U com rodas de reação: falta energia e a missão degrada', function () {
    var r = runWith({ power: 'eps_body' });
    assert.equal(byId(r.checks, 'power').status, 'fail');
    assert.equal(byId(r.mission.events, 'E3').status, 'warn');
    assert.near(r.mission.outcome.opsFactor, 0.3, 1e-9);
  });

  test('câmera média com magnetorques: imagens borradas, nenhum mapa útil', function () {
    var r = runWith({ adcs: 'adcs_mag' });
    assert.equal(byId(r.checks, 'pointing').status, 'fail');
    assert.equal(byId(r.mission.events, 'E5').status, 'fail');
    assert.equal(r.mission.outcome.maps, 0);
    assert.equal(r.mission.aborted, null);
  });

  test('6U com painéis fixos: energia ok, mas estoura o orçamento (805 k$)', function () {
    var r = runWith({ structure: 'struct_6u', power: 'eps_body' });
    assert.equal(r.metrics.cost_k.value, 805);
    assert.equal(byId(r.checks, 'cost').status, 'fail');
    assert.equal(byId(r.checks, 'power').status, 'ok');
    assert.equal(byId(r.score.parts, 'budget').points, 0);
  });

  test('lições reúnem as dicas das falhas, sem repetir', function () {
    var texts = runWith({ payload: 'cam_wide', comms: 'com_uhf' }).lessons.map(function (l) { return l.text; });
    assert(texts.length >= 2, 'esperava pelo menos 2 lições');
    assert.equal(texts.length, texts.filter(function (t, i) { return texts.indexOf(t) === i; }).length);
  });

  // ------------------------------------------------------------------
  T.group('Orientado a dados');

  test('requisito novo, só nos dados, é avaliado pelo motor', function () {
    var d = clone(MS.data);
    d.scenarios.eo_cubesat.requirements.push({
      id: 'R5', title: 'Massa', text: 'Massa de no máximo 3 kg.',
      metric: 'mass_kg', op: '<=', value: 3, hint: 'Tire peso.'
    });
    assert.equal(sim.validate(d).length, 0, 'dados válidos');
    var r5 = byId(runWith({}, d).requirements, 'R5');
    assert.equal(r5.status, 'fail'); // 3,35 kg
    assert.equal(r5.hint, 'Tire peso.');
  });

  test('componente novo, só nos dados, entra na MEL e nas contas', function () {
    var d = clone(MS.data);
    d.catalog.components.cam_tele = Object.assign({}, d.catalog.components.cam_mid, { name: 'Câmera tele', focal_mm: 220 });
    byId(d.scenarios.eo_cubesat.slots, 'payload').options.push('cam_tele');
    assert.equal(sim.validate(d).length, 0, 'dados válidos');
    var r = runWith({ payload: 'cam_tele' }, d);
    assert.near(r.metrics.gsd_m.value, 12.5, 1e-9);
    assert.equal(r.mel.items[0].name, 'Câmera tele');
  });

  test('evento novo, só nos dados, entra na linha do tempo', function () {
    var d = clone(MS.data);
    d.scenarios.eo_cubesat.events.splice(1, 0, {
      id: 'EX', when: 'Dia 0', title: 'Teste de massa',
      conditions: [{ metric: 'mass_kg', op: '<=', value: 3 }], onFail: { degrade: 0.5 },
      success: 'Leve.', failure: 'Massa de {mass_kg} kg.'
    });
    assert.equal(sim.validate(d).length, 0, 'dados válidos');
    var r = runWith({}, d);
    var ex = byId(r.mission.events, 'EX');
    assert.equal(ex.status, 'warn');
    assert.includes(ex.text, '3,35');
    assert.near(r.mission.outcome.opsFactor, 0.5, 1e-9);
  });

  test('cenário novo (cópia com outro orçamento) roda sem mudar o motor', function () {
    var d = clone(MS.data);
    var sc = clone(d.scenarios.eo_cubesat);
    sc.id = 'eo_cubesat_low';
    sc.budget_k = 500;
    d.scenarios.eo_cubesat_low = sc;
    assert.equal(sim.validate(d).length, 0, 'dados válidos');
    var r = sim.run({ scenarioId: 'eo_cubesat_low', design: design() }, d);
    assert.equal(byId(r.checks, 'cost').status, 'fail');
  });

  // ------------------------------------------------------------------
  T.group('Pureza');

  test('o motor não altera o state nem os dados', function () {
    var state = { scenarioId: 'eo_cubesat', design: design() };
    var before = JSON.stringify(state) + JSON.stringify(MS.data);
    sim.run(state);
    sim.run({ scenarioId: 'eo_cubesat', design: {} });
    assert.equal(JSON.stringify(state) + JSON.stringify(MS.data), before);
  });

  test('mesma entrada, mesma saída', function () {
    assert.equal(JSON.stringify(runWith()), JSON.stringify(runWith()));
  });
})(globalThis);
