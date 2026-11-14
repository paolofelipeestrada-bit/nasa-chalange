/* Testes do estado (js/state.js). Usam um armazenamento falso:
 * o localStorage real do navegador nunca é tocado. */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert;
  var store = MS.store;
  var FIRST = MS.data.flow.phases[0].id;

  function fakeStorage(initial) {
    var mem = Object.assign({}, initial || {});
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      mem: mem
    };
  }
  function saved(key, value) { var o = {}; o[key] = value; return o; }

  // Começa um jogo novo com armazenamento falso e conta os render().
  function fresh() {
    var f = { renders: 0, storage: fakeStorage() };
    store.init({ storage: f.storage, render: function () { f.renders++; } });
    return f;
  }
  function chooseConcept() {
    store.setOrbit('sso500');
    store.setLauncher('rideshare_sso');
    store.setGroundStation('gs_polar');
  }
  function chooseDesign() {
    store.selectComponent('payload', 'cam_mid');
    store.selectComponent('structure', 'struct_3u');
    store.selectComponent('power', 'eps_deploy');
    store.selectComponent('adcs', 'adcs_wheels');
    store.selectComponent('comms', 'com_sband');
    store.selectComponent('obc', 'obc_basic');
  }

  // ------------------------------------------------------------------
  T.group('Estado e ações');

  test('estado inicial: primeira fase, nada escolhido, tentativa 1', function () {
    fresh();
    var s = store.state;
    assert.equal(s.phase, FIRST);
    assert.equal(s.reached, FIRST);
    assert.equal(s.attempt, 1);
    Object.keys(s.design).forEach(function (k) { assert.equal(s.design[k], null, k); });
  });

  test('o state é congelado: só muda por ações', function () {
    fresh();
    assert(Object.isFrozen(store.state) && Object.isFrozen(store.state.design));
    assert.throws(function () { store.state.design.orbit = 'sso500'; });
  });

  test('cada ação salva e chama render() uma vez', function () {
    var f = fresh();
    var before = f.renders;
    store.setOrbit('sso500');
    assert.equal(f.renders, before + 1);
    assert.equal(store.state.design.orbit, 'sso500');
    assert.equal(JSON.parse(f.storage.getItem(store.STORAGE_KEY)).design.orbit, 'sso500');
  });

  test('uma ação cria um state novo e não altera o anterior', function () {
    fresh();
    var old = store.state;
    store.setOrbit('sso500');
    assert(old !== store.state);
    assert.equal(old.design.orbit, null);
  });

  test('opção inválida gera erro e não muda nada', function () {
    var f = fresh();
    var before = f.renders;
    assert.throws(function () { store.setOrbit('marte'); });
    assert.throws(function () { store.select('slot_inexistente', 'x'); });
    assert.equal(store.state.design.orbit, null);
    assert.equal(f.renders, before);
  });

  test('null desfaz uma escolha', function () {
    fresh();
    store.setOrbit('sso500');
    store.setOrbit(null);
    assert.equal(store.state.design.orbit, null);
  });

  // ------------------------------------------------------------------
  T.group('Navegação entre fases');

  test('só avança quando as escolhas da fase estão feitas', function () {
    fresh();
    assert.equal(store.nextPhase(), true); // need → concept
    assert.equal(store.state.phase, 'concept');
    var c = store.canAdvance();
    assert.equal(c.ok, false);
    assert.equal(c.missing.length, 3);
    assert.equal(store.nextPhase(), false);
    assert.equal(store.state.phase, 'concept');
    chooseConcept();
    assert.equal(store.nextPhase(), true);
    assert.equal(store.state.phase, 'requirements');
  });

  test('fluxo completo e "Ajustar e simular de novo"', function () {
    fresh();
    store.nextPhase(); chooseConcept(); store.nextPhase(); store.nextPhase();
    assert.equal(store.state.phase, 'design');
    assert.equal(store.nextPhase(), false, 'design incompleto');
    chooseDesign();
    while (store.nextPhase()) { /* avança até a fase da missão */ }
    assert.equal(store.state.phase, 'implement', 'a missão espera a data de lançamento');
    store.setPeriod('y2019');
    assert.equal(store.nextPhase(), false, 'e espera a decisão do alerta');
    store.decide('storm', 'safe');
    while (store.nextPhase()) { /* avança até a última fase */ }
    assert.equal(store.state.phase, 'report');
    assert.equal(store.canAdvance().isLast, true);
    store.retry();
    assert.equal(store.state.phase, MS.data.flow.retryPhase);
    assert.equal(store.state.attempt, 2);
    assert.equal(store.state.design.payload, 'cam_mid', 'mantém as escolhas');
    assert.equal(store.goToPhase('report'), false, 'precisa simular de novo');
  });

  test('voltar é livre; pular para frente só até a fase já alcançada', function () {
    fresh();
    store.nextPhase(); chooseConcept(); store.nextPhase(); // requirements
    assert.equal(store.goToPhase('need'), true);
    assert.equal(store.goToPhase('requirements'), true);
    assert.equal(store.goToPhase('design'), false);
    assert.equal(store.prevPhase(), true);
    assert.equal(store.state.phase, 'concept');
  });

  test('mudar o projeto numa fase anterior exige refazer as seguintes', function () {
    fresh();
    store.nextPhase(); chooseConcept(); store.nextPhase(); store.nextPhase(); // design
    store.goToPhase('concept');
    store.setOrbit('iss400');
    assert.equal(store.state.reached, 'concept');
    assert.equal(store.goToPhase('design'), false);
  });

  test('phaseInfo descreve a fase atual', function () {
    fresh();
    store.nextPhase();
    var info = store.phaseInfo();
    assert.equal(info.index, 1);
    assert.equal(info.current.id, 'concept');
    assert.equal(info.phases.length, MS.data.flow.phases.length);
  });

  // ------------------------------------------------------------------
  T.group('Persistência (localStorage)');

  test('progresso salvo é recarregado no init', function () {
    var f = fresh();
    store.nextPhase();
    store.setOrbit('sso500');
    var json = f.storage.mem[store.STORAGE_KEY];
    store.init({ storage: fakeStorage(saved(store.STORAGE_KEY, json)) });
    assert.equal(store.state.phase, 'concept');
    assert.equal(store.state.design.orbit, 'sso500');
  });

  test('JSON corrompido ou versão antiga: começa do zero', function () {
    store.init({ storage: fakeStorage(saved(store.STORAGE_KEY, '{quebrado')) });
    assert.equal(store.state.phase, FIRST);
    var old = JSON.stringify({ version: 0, scenarioId: 'eo_cubesat', phase: 'report', design: {} });
    store.init({ storage: fakeStorage(saved(store.STORAGE_KEY, old)) });
    assert.equal(store.state.phase, FIRST);
  });

  test('ids que sumiram dos dados são descartados e a fase é ajustada', function () {
    var s = store.sanitize({
      version: 1, scenarioId: 'eo_cubesat', phase: 'report', reached: 'report', attempt: 3,
      design: {
        orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar', payload: 'camera_removida',
        structure: 'struct_3u', power: 'eps_deploy', adcs: 'adcs_wheels', comms: 'com_sband', obc: 'obc_basic'
      }
    });
    assert.equal(s.design.payload, null);
    assert.equal(s.phase, 'design', 'sem instrumento não dá para estar no relatório');
    assert.equal(s.attempt, 3);
  });

  test('sem localStorage o jogo funciona (só não salva)', function () {
    var renders = 0;
    store.init({ storage: null, render: function () { renders++; } });
    store.setOrbit('sso500');
    assert.equal(store.state.design.orbit, 'sso500');
    assert.equal(renders, 2, 'init + ação');
  });

  test('armazenamento que lança erro não quebra o jogo', function () {
    var bad = {
      getItem: function () { throw new Error('bloqueado'); },
      setItem: function () { throw new Error('bloqueado'); }
    };
    store.init({ storage: bad });
    store.setOrbit('sso500');
    assert.equal(store.state.design.orbit, 'sso500');
  });

  // ------------------------------------------------------------------
  T.group('Estado + motor');

  test('o state do store roda direto no motor', function () {
    fresh();
    store.nextPhase();
    chooseConcept();
    var r = MS.sim.run(store.state);
    assert.equal(r.complete, false);
    assert.equal(r.missing.length, 6);
    chooseDesign();
    var noLuck = Object.assign({}, store.state, { seed: undefined }); // sem imprevistos
    assert.equal(MS.sim.run(noLuck).score.total, 100);
    assert.equal(MS.sim.run(store.state).risks.length, MS.data.scenarios.eo_cubesat.randomEvents.length);
  });

  test('semente: existe ao criar, muda a cada tentativa e pode ser definida', function () {
    fresh();
    var s1 = store.state.seed;
    assert(typeof s1 === 'number', 'sem semente');
    store.retry();
    assert(store.state.seed !== s1, 'a semente deveria mudar no retry');
    store.setSeed(42);
    assert.equal(store.state.seed, 42);
    assert.throws(function () { store.setSeed('x'); });
    assert.equal(store.sanitize(JSON.parse(JSON.stringify(store.state))).seed, 42, 'semente salva é mantida');
  });
})(globalThis);
