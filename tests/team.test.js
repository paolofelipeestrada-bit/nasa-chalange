/* Testes do modo equipe: regras (js/net/team.js) e apoio no estado. */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert, team = MS.team;
  var sc = MS.data.scenarios.eo_cubesat;
  function room() {
    return [
      { id: 'host', name: 'Ana', roles: ['manager'], host: true },
      { id: 'g1', name: 'Bia', roles: ['bus'] },
      { id: 'g2', name: 'Caio', roles: [] }
    ];
  }

  T.group('Modo equipe (regras)');

  test('dono do papel muda as escolhas dele; os outros não', function () {
    var m = room();
    assert(team.can(sc, m, 'g1', 'select', ['power', 'eps_body']).ok, 'Plataforma muda energia');
    var no = team.can(sc, m, 'host', 'select', ['power', 'eps_body']);
    assert(!no.ok);
    T.assert.includes(no.reason, 'Bia');
  });

  test('papel sem dono fica livre para qualquer um', function () {
    assert(team.can(sc, room(), 'g2', 'select', ['payload', 'cam_mid']).ok);
  });

  test('só o Gerente de missão conduz as fases', function () {
    var m = room();
    assert(team.can(sc, m, 'host', 'nextPhase', []).ok);
    ['nextPhase', 'prevPhase', 'goToPhase', 'retry', 'reset'].forEach(function (a) {
      assert(!team.can(sc, m, 'g1', a, []).ok, a);
    });
    var free = m.map(function (x) { return Object.assign({}, x, { roles: x.id === 'host' ? [] : x.roles }); });
    assert(team.can(sc, free, 'g2', 'nextPhase', []).ok, 'sem gerente: qualquer um avança');
  });

  test('ações fora da lista e estranhos são recusados', function () {
    assert(!team.can(sc, room(), 'g1', 'setSeed', [1]).ok, 'setSeed não é ação de sala');
    assert(!team.can(sc, room(), 'intruso', 'select', ['orbit', 'sso500']).ok);
  });

  test('assumir papel livre funciona; papel de outro é recusado', function () {
    var r = team.claim(sc, room(), 'g2', ['payload']);
    assert(r.ok);
    assert.equal(team.holder(r.members, 'payload').name, 'Caio');
    var no = team.claim(sc, room(), 'g2', ['bus']);
    assert(!no.ok);
    T.assert.includes(no.reason, 'Bia');
  });

  test('largar papel e ids desconhecidos ou repetidos', function () {
    var r = team.claim(sc, room(), 'g1', []);
    assert.equal(team.holder(r.members, 'bus'), null);
    var r2 = team.claim(sc, room(), 'g2', ['payload', 'payload', 'papel_fantasma']);
    assert.equal(JSON.stringify(team.member(r2.members, 'g2').roles), '["payload"]');
  });

  test('todo slot do cenário tem exatamente um papel', function () {
    sc.slots.forEach(function (s) { assert(team.roleOfSlot(sc, s.id), s.id + ' sem papel'); });
  });

  test('descrição das ações para os avisos', function () {
    assert.equal(team.describe(sc, 'select', ['power', 'eps_deploy']), 'escolheu "Painéis abertos (asas)" em Energia');
    assert.equal(team.describe(sc, 'nextPhase', []), 'avançou de fase');
    assert.equal(team.cleanName('  <b>Zé</b> '), 'bZé/b');
    assert.equal(team.cleanName(''), 'Jogador');
  });

  test('a validação acusa slot em dois papéis', function () {
    var d = JSON.parse(JSON.stringify(MS.data));
    d.scenarios.eo_cubesat.team.roles[1].slots.push('orbit');
    T.assert.includes(MS.sim.validate(d).join(' | '), 'orbit');
  });

  T.group('Modo equipe (estado)');

  test('load substitui o state pelo do anfitrião e chama render', function () {
    var renders = 0;
    MS.store.init({ storage: null, render: function () { renders++; } });
    var hostState = Object.assign(MS.store.createState(), { phase: 'concept', reached: 'concept', seed: 777 });
    hostState.design = Object.assign({}, hostState.design, { orbit: 'sso500' });
    assert.equal(MS.store.load(JSON.parse(JSON.stringify(hostState))), true);
    assert.equal(MS.store.state.seed, 777);
    assert.equal(MS.store.state.design.orbit, 'sso500');
    assert.equal(renders, 2);
    assert.equal(MS.store.load({ lixo: true }), false, 'state inválido é ignorado');
  });

  test('onChange avisa cada mudança e pode ser desligado', function () {
    MS.store.init({ storage: null });
    var n = 0, off = MS.store.onChange(function () { n++; });
    MS.store.setOrbit('sso500');
    MS.store.setOrbit('iss400');
    off();
    MS.store.setOrbit('sso500');
    assert.equal(n, 2);
  });

  test('setPersistence(false) não sobrescreve o jogo salvo', function () {
    var mem = {};
    var storage = { getItem: function (k) { return mem[k] || null; }, setItem: function (k, v) { mem[k] = v; } };
    MS.store.init({ storage: storage });
    MS.store.setOrbit('sso500');
    var saved = mem[MS.store.STORAGE_KEY];
    MS.store.setPersistence(false);
    MS.store.setOrbit('iss400');
    assert.equal(mem[MS.store.STORAGE_KEY], saved);
    MS.store.setPersistence(true);
  });
})(globalThis);
