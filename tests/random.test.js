/* Testes dos imprevistos (eventos aleatórios com semente). */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert, sim = MS.sim;

  var GOOD = {
    orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar',
    payload: 'cam_mid', structure: 'struct_3u', power: 'eps_deploy',
    adcs: 'adcs_wheels', comms: 'com_sband', obc: 'obc_basic'
  };
  function design(ch) { return Object.assign({}, GOOD, ch || {}); }
  function run(ch, seed, data) { return sim.run({ scenarioId: 'eo_cubesat', design: design(ch), seed: seed }, data); }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  // Cópia dos dados com a chance de um imprevisto trocada.
  function withChance(id, chance) {
    var d = clone(MS.data);
    byId(d.scenarios.eo_cubesat.randomEvents, id).chance = chance;
    return d;
  }

  T.group('Imprevistos');

  test('mesma semente, mesmos imprevistos; sementes diferentes variam', function () {
    assert.equal(JSON.stringify(run({}, 1234)), JSON.stringify(run({}, 1234)));
    var outcomes = {};
    for (var s = 1; s <= 200; s++) {
      outcomes[run({}, s).risks.filter(function (r) { return r.occurs; }).map(function (r) { return r.id; }).join(',')] = true;
    }
    assert(Object.keys(outcomes).length > 3, 'deveria haver combinações diferentes');
  });

  test('sem semente nada é sorteado, mas os riscos aparecem', function () {
    var r = run({}, undefined);
    assert.equal(r.seed, null);
    assert.equal(r.risks.length, 6);
    assert(r.risks.every(function (x) { return !x.occurs; }));
    assert(r.mission.events.every(function (e) { return !e.random; }));
  });

  test('a frequência segue a chance (RE1 ≈ 20% em 3.000 sementes)', function () {
    var n = 0, N = 3000;
    for (var s = 1; s <= N; s++) if (byId(run({}, s).risks, 'RE1').occurs) n++;
    assert.near(n / N, 0.2, 0.03);
  });

  test('chance 0 nunca acontece; chance 1 sempre acontece', function () {
    var d0 = withChance('RE1', 0), d1 = withChance('RE1', 1);
    for (var s = 1; s <= 50; s++) {
      assert(!byId(run({}, s, d0).risks, 'RE1').occurs);
      assert(byId(run({}, s, d1).risks, 'RE1').occurs);
    }
  });

  test('projeto de referência: protegido de 3 riscos, exposto à roda e ao atraso', function () {
    var risks = run({}, 1).risks;
    assert.equal(byId(risks, 'RE2').status, 'ok', 'tempestade solar (folga de energia)');
    assert.equal(byId(risks, 'RE3').status, 'ok', 'bug (rádio banda S)');
    assert.equal(byId(risks, 'RE6').status, 'ok', 'antena (folga de envio)');
    assert.equal(byId(risks, 'RE4').status, 'warn', 'roda de reação');
    assert.equal(byId(risks, 'RE1').status, 'warn', 'atraso, sem mitigação');
    assert.equal(byId(risks, 'RE5').status, 'na', 'detrito só na órbita da ISS');
  });

  test('imprevisto que não se aplica nunca acontece', function () {
    var d = withChance('RE5', 1);
    assert(!byId(run({}, 7, d).risks, 'RE5').occurs, 'SSO não tem RE5');
    assert(byId(run({ orbit: 'iss400', launcher: 'iss_cargo', groundStation: 'gs_national', obc: 'obc_adv' }, 7, d).risks, 'RE5').occurs);
  });

  test('imprevisto sem mitigação reduz o resultado e entra logo depois do evento "after"', function () {
    var d = withChance('RE3', 1);
    var r = run({ comms: 'com_uhf', obc: 'obc_adv' }, 5, d);
    var ids = r.mission.events.map(function (e) { return e.id; });
    assert.equal(ids[ids.indexOf('E5') + 1], 'RE3');
    var ev = byId(r.mission.events, 'RE3');
    assert.equal(ev.status, 'warn');
    assert(ev.random);
    assert(ev.causes.length > 0, 'deveria explicar a causa');
    assert(r.mission.outcome.opsFactor <= 0.75 + 1e-9);
    assert(r.lessons.some(function (l) { return l.source === 'RE3'; }), 'lição do imprevisto');
  });

  test('imprevisto mitigado aparece como OK e não reduz nada', function () {
    var d = withChance('RE3', 1);
    var base = run({}, undefined).mission.outcome.opsFactor;
    var r = run({}, 5, withChance('RE3', 1));
    var ev = byId(r.mission.events, 'RE3');
    assert.equal(ev.status, 'ok');
    T.assert.includes(ev.text, 'banda S');
    assert(d && r.mission.outcome.opsFactor <= base);
  });

  test('imprevisto com effect "abort" encerra a missão', function () {
    var d = withChance('RE1', 1);
    byId(d.scenarios.eo_cubesat.randomEvents, 'RE1').effect = 'abort';
    var r = run({}, 3, d);
    assert.equal(r.mission.aborted, 'RE1');
    assert.equal(byId(r.mission.events, 'E2').status, 'skipped');
    assert.equal(r.mission.outcome.maps, 0);
  });

  test('acrescentar um imprevisto não muda o sorteio dos outros', function () {
    var d = clone(MS.data);
    d.scenarios.eo_cubesat.randomEvents.push({ id: 'RE99', title: 'Novo', text: 'x', chance: 0.5, effect: 'none' });
    for (var s = 1; s <= 30; s++) {
      var a = run({}, s).risks.map(function (r) { return r.occurs; });
      var b = run({}, s, d).risks.slice(0, 6).map(function (r) { return r.occurs; });
      assert.equal(JSON.stringify(a), JSON.stringify(b), 'semente ' + s);
    }
  });

  test('a validação acusa chance inválida e condição desconhecida', function () {
    var d = clone(MS.data);
    var res = d.scenarios.eo_cubesat.randomEvents;
    res[0].chance = 2;
    res[1].mitigatedBy = [{ margin: 'combustivel', op: '>=', value: 0.1 }];
    res[2].mitigatedBy = [{ slot: 'comms', is: 'radio_laser' }];
    var p = sim.validate(d).join(' | ');
    T.assert.includes(p, 'chance');
    T.assert.includes(p, 'combustivel');
    T.assert.includes(p, 'radio_laser');
  });
})(globalThis);
