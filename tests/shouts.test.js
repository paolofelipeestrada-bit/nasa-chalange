/* Testes dos gritos da equipe (js/net/shouts.js). */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert, S = MS.shouts;
  var sc = MS.data.scenarios.eo_cubesat;
  var members = [{ id: 'host', name: 'Ana', roles: ['manager'] }, { id: 'g1', name: 'Bia', roles: ['bus'] }];
  function stateAt(phase, design) {
    var s = MS.store.createState('eo_cubesat');
    s.phase = phase; s.reached = phase;
    Object.assign(s.design, design || {});
    return s;
  }

  T.group('Gritos da equipe');

  test('pede as peças que faltam a quem cuida delas (nunca a mim mesmo)', function () {
    var st = stateAt('design', { payload: 'cam_mid' });
    var asks = S.options(sc, st, MS.sim.run(st), members, 'host').filter(function (o) { return o.kind === 'ask'; }).map(function (o) { return o.shout.slot; });
    ['structure', 'power', 'adcs', 'obc', 'comms'].forEach(function (id) { assert(asks.indexOf(id) !== -1, 'falta pedir ' + id); });
    assert(asks.indexOf('payload') === -1, 'payload já foi escolhido');
    var fromBus = S.options(sc, st, MS.sim.run(st), members, 'g1').filter(function (o) { return o.kind === 'ask'; }).map(function (o) { return o.shout.slot; });
    assert(fromBus.indexOf('power') === -1, 'a Plataforma não pede para si mesma');
    var concept = stateAt('concept');
    var cAsks = S.options(sc, concept, MS.sim.run(concept), members, 'host').filter(function (o) { return o.kind === 'ask'; }).map(function (o) { return o.shout.slot; });
    assert.equal(cAsks.join(','), 'groundStation', 'no Conceito só a estação (órbita e lançador são do gerente)');
  });

  test('avisa só dos recursos no amarelo/vermelho; texto no idioma de quem lê', function () {
    var st = stateAt('design', { orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar', payload: 'cam_hr', structure: 'struct_3u',
      power: 'eps_deploy', adcs: 'adcs_wheels', comms: 'com_sband', obc: 'obc_basic' }); // telescópio num 3U: não cabe
    var alerts = S.options(sc, st, MS.sim.run(st), members, 'host').filter(function (o) { return o.kind === 'alert'; });
    assert(alerts.some(function (o) { return o.shout.id === 'alert:volume' && o.hot; }), 'deveria avisar que não cabe');
    var was = MS.i18n.lang;
    try {
      MS.i18n.setLang('pt', false);
      T.assert.includes(S.text(sc, { id: 'ask', to: 'bus', slot: 'power' }), 'Plataforma');
      T.assert.includes(S.text(sc, { id: 'ask', to: 'bus', slot: 'power' }), 'Energia');
      MS.i18n.setLang('en', false);
      T.assert.includes(S.text(sc, { id: 'ask', to: 'bus', slot: 'power' }), 'Spacecraft engineer');
    } finally { MS.i18n.setLang(was, false); }
  });

  test('gritos vindos da rede: só os conhecidos passam; pedido para o meu papel é "para mim"', function () {
    assert.equal(S.clean(sc, { id: 'hack' }), null);
    assert.equal(S.clean(sc, { id: 'ask', to: 'bus', slot: 'orbit' }), null, 'órbita não é da Plataforma');
    assert.equal(S.clean(sc, { id: 'alert:nada' }), null);
    assert.equal(S.clean(sc, { id: '<img>' }), null);
    assert.equal(JSON.stringify(S.clean(sc, { id: 'ask', to: 'bus', slot: 'power', extra: 'x' })), JSON.stringify({ id: 'ask', to: 'bus', slot: 'power' }));
    assert(S.clean(sc, { id: 'good' }));
    assert(S.forMe(sc, { id: 'ask', to: 'bus', slot: 'power' }, members, 'g1'));
    assert(!S.forMe(sc, { id: 'ask', to: 'bus', slot: 'power' }, members, 'host'));
    assert(!S.forMe(sc, { id: 'good' }, members, 'g1'));
  });

  test('um grito a cada 2 segundos por pessoa', function () {
    assert(S.allow(0, 1000));
    assert(!S.allow(1000, 2500));
    assert(S.allow(1000, 3000));
  });

  test('toda frase de grito tem texto nos 3 idiomas', function () {
    var d = MS.data.shouts, all = [d.ask, d.ready.ask, d.ready.yes, d.ready.no];
    Object.keys(d.alerts).forEach(function (k) { all.push(d.alerts[k]); });
    d.team.forEach(function (p) { all.push(p.text); });
    all.forEach(function (v, i) { ['en', 'pt', 'es'].forEach(function (l) { assert(v && v[l], 'frase ' + i + ' sem ' + l); }); });
  });
})(globalThis);
