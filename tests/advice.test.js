/* Testes dos conselhos da equipe, do palpite, da comparação e das cartas (js/advice.js). */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert;
  var GOOD = {
    orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar',
    payload: 'cam_mid', structure: 'struct_3u', power: 'eps_deploy',
    adcs: 'adcs_wheels', comms: 'com_sband', obc: 'obc_basic'
  };
  function stateWith(design, extra) {
    var s = MS.store.createState();
    Object.keys(design || {}).forEach(function (k) { s.design[k] = design[k]; });
    return Object.assign(s, extra || {});
  }
  function crewOf(design) { var s = stateWith(design); return MS.advice.crew(s, MS.sim.run(s)); }
  function byRole(list, id) { return list.filter(function (a) { return a.role === id; })[0]; }

  T.group('Conselhos da equipe');

  test('os 4 papéis falam, cada um com meta e texto', function () {
    var list = crewOf(GOOD);
    assert.equal(list.length, 4);
    list.forEach(function (a) { assert(a.text && a.goal && a.name, 'faltou texto em ' + a.role); });
  });

  test('projeto vencedor: todos votam Go', function () {
    var tl = MS.advice.tally(crewOf(GOOD));
    assert.equal(tl.go, 4); assert(tl.unanimous);
  });

  test('projeto vazio: ninguém vota ainda', function () {
    var list = crewOf({});
    list.forEach(function (a) { assert.equal(a.vote, null, a.role); assert.equal(a.status, 'pending', a.role); });
  });

  test('telescópio grande: Cientista reclama da revisita e Engenheiro do espaço', function () {
    var list = crewOf(Object.assign({}, GOOD, { payload: 'cam_hr' }));
    assert.equal(byRole(list, 'payload').vote, 'nogo');
    assert.equal(byRole(list, 'bus').status, 'fail');
    assert.equal(byRole(list, 'ground').status, 'fail', 'o telescópio gera mais dados do que a antena manda');
  });

  test('conflito: cada papel pode discordar dos outros', function () {
    var list = crewOf(Object.assign({}, GOOD, { payload: 'cam_hr' }));
    assert.equal(byRole(list, 'manager').role, 'manager');
    var votes = list.map(function (a) { return a.vote; });
    assert(votes.indexOf('nogo') !== -1);
  });

  T.group('Prever, comparar e cartas');

  test('faixas do palpite cobrem de 0 a 100%', function () {
    assert.equal(MS.advice.bucket(0.2), 'lt50');
    assert.equal(MS.advice.bucket(0.6), 'mid');
    assert.equal(MS.advice.bucket(0.95), 'most');
    assert.equal(MS.advice.bucket(1), 'all');
    MS.store.PREDICTIONS.forEach(function (id) { assert(['lt50', 'mid', 'most', 'all'].indexOf(id) !== -1); });
  });

  test('retry guarda a tentativa e zera o palpite; sanitize mantém o histórico', function () {
    MS.store.init({ storage: null, render: function () {} });
    MS.store.reset();
    Object.keys(GOOD).forEach(function (k) { MS.store.select(k, GOOD[k]); });
    MS.store.setPrediction('most');
    assert.equal(MS.store.state.prediction, 'most');
    MS.store.retry();
    assert.equal(MS.store.state.prediction, null);
    assert.equal(MS.store.state.attempts.length, 1);
    assert.equal(MS.store.state.attempts[0].prediction, 'most');
    var back = MS.store.sanitize(JSON.parse(JSON.stringify(MS.store.state)));
    assert.equal(back.attempts.length, 1);
    assert.equal(back.attempts[0].design.payload, 'cam_mid');
    assert.throws(function () { MS.store.setPrediction('talvez'); });
  });

  test('trocar uma peça apaga o palpite', function () {
    MS.store.reset();
    MS.store.setPrediction('all');
    MS.store.select('payload', 'cam_wide');
    assert.equal(MS.store.state.prediction, null);
  });

  test('comparação lista só as peças trocadas', function () {
    var a = stateWith(GOOD), b = stateWith(Object.assign({}, GOOD, { payload: 'cam_wide' }));
    var ch = MS.advice.changes(a, b);
    assert.equal(ch.length, 1);
    assert.equal(ch[0].slot, 'payload');
  });

  test('cartas: "pequenas mudanças" só com 1 troca e nota bem maior', function () {
    var prevDesign = Object.assign({}, GOOD, { payload: 'cam_wide' });
    var s = stateWith(GOOD, { period: 'y2019', attempt: 2, decisions: { storm: 'safe', memory: 'compress', power: 'reduce' },
      attempts: [{ attempt: 1, design: prevDesign, period: 'y2019', decisions: { storm: 'safe', memory: 'compress', power: 'reduce' }, seed: 7, prediction: null }] });
    var r = MS.sim.run(s), prev = MS.advice.previous(s);
    assert(prev, 'deveria achar a tentativa anterior');
    var cards = MS.advice.cards(s, r, prev);
    assert.equal(cards.length, MS.advice.CARDS.length);
    var small = cards.filter(function (c) { return c.id === 'small'; })[0];
    assert.equal(small.unlocked, r.score.total - prev.result.score.total >= 15);
    cards.forEach(function (c) { assert(!c.unlocked || c.why, 'carta sem explicação: ' + c.id); });
  });

  T.group('Comparação das órbitas (Conceito)');

  test('uma coluna por órbita, 4 efeitos, mesmo sem câmera escolhida', function () {
    var c = MS.advice.orbitCompare(stateWith({}));
    assert.equal(c.rows.length, 3);
    assert.equal(c.effects.length, 4);
    assert(c.refPayload, 'usa câmera de referência');
    c.rows.forEach(function (r) { c.effects.forEach(function (e) { assert(r.values[e.id] != null, r.id + ' sem ' + e.id); }); });
  });

  test('mais alta: menos detalhe e vida mais longa; ISS cai antes', function () {
    var c = MS.advice.orbitCompare(stateWith({}));
    var by = {}; c.rows.forEach(function (r) { by[r.id] = r; });
    assert(by.sso600.values.detail > by.sso500.values.detail, 'pixel maior a 600 km');
    assert(by.sso600.values.life > by.sso500.values.life);
    assert.equal(by.iss400.stars.life, 1);
    assert.equal(by.sso600.stars.life, 3);
  });

  test('marca a órbita escolhida e usa a câmera do jogador', function () {
    var c = MS.advice.orbitCompare(stateWith({ orbit: 'sso600', payload: 'cam_hr' }));
    assert.equal(c.rows.filter(function (r) { return r.chosen; })[0].id, 'sso600');
    assert(!c.refPayload);
  });

  T.group('Missão perdida no lançamento');

  test('sem ano em órbita, 0% dos dados e o palpite ainda é comparado', function () {
    var s = stateWith(Object.assign({}, GOOD, { payload: 'cam_hr' }), { period: 'y2019', decisions: {} });
    var r = MS.sim.run(s);
    assert(r.mission.aborted, 'telescópio pesado demais deveria falhar no lançamento');
    assert.equal(r.life, null, 'não há diário de um satélite que não chegou à órbita');
    assert.equal(MS.advice.dataFraction(r), 0);
    assert.equal(MS.advice.bucket(0), 'lt50');
  });

  T.group('Cliente (personagem)');

  test('fala em toda fase, nos 3 cenários, sem marcador sobrando', function () {
    ['eo_cubesat', 'fire_watch', 'city_map'].forEach(function (sc) {
      ['need', 'concept', 'requirements', 'design', 'build', 'implement', 'report'].forEach(function (ph) {
        [{}, GOOD].forEach(function (d) {
          var st = stateWith(d, { scenarioId: sc, phase: ph, period: d === GOOD ? 'y2019' : null });
          var c = MS.advice.client(st, MS.sim.run(st));
          assert(c.name && c.text, sc + '/' + ph + ' sem fala');
          assert(c.text.indexOf('{') < 0, sc + '/' + ph + ': ' + c.text);
        });
      });
    });
  });

  test('reage ao projeto: feliz com tudo certo, preocupada quando um requisito falha', function () {
    var ok = stateWith(GOOD, { phase: 'design' });
    assert.equal(MS.advice.client(ok, MS.sim.run(ok)).mood, 'happy');
    var bad = stateWith(Object.assign({}, GOOD, { payload: 'cam_wide' }), { phase: 'design' });
    var c = MS.advice.client(bad, MS.sim.run(bad));
    assert.equal(c.mood, 'worried'); assert.equal(c.key, 'cl.fail');
  });
})(globalThis);
