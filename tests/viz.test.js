/* Testes do roteiro da animação 3D (js/viz/schedule.js). */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert, VS = MS.vizSchedule;
  var GOOD = {
    orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar',
    payload: 'cam_mid', structure: 'struct_3u', power: 'eps_deploy',
    adcs: 'adcs_wheels', comms: 'com_sband', obc: 'obc_basic'
  };
  function run(ch, seed) { return MS.sim.run({ scenarioId: 'eo_cubesat', design: Object.assign({}, GOOD, ch || {}), seed: seed }); }

  T.group('Visual 3D (roteiro)');

  test('todo "fx" dos dados é um efeito que o 3D conhece', function () {
    Object.keys(MS.data.scenarios).forEach(function (id) {
      var sc = MS.data.scenarios[id];
      (sc.events || []).concat(sc.randomEvents || []).forEach(function (e) {
        if (e.fx) assert(VS.FX.indexOf(e.fx) !== -1, id + ' / ' + e.id + ': fx "' + e.fx + '" desconhecido');
      });
    });
  });

  test('lançamento primeiro; passos em sequência sem buracos', function () {
    var s = VS.build(run({}, undefined));
    assert.equal(s.steps[0].event.fx, 'launch');
    assert.equal(s.orbitStart, s.steps[0].t1);
    for (var i = 1; i < s.steps.length; i++) assert.equal(s.steps[i].t0, s.steps[i - 1].t1);
    assert.equal(s.duration, s.steps[s.steps.length - 1].t1);
    assert.equal(s.launchFailed, false);
    assert.equal(VS.at(s, 0.1).event.id, 'E1');
    assert.equal(VS.at(s, s.duration + 1), null);
  });

  test('falha no lançamento: roteiro só com o lançamento', function () {
    var s = VS.build(run({ payload: 'cam_hr' })); // não cabe no 3U
    assert.equal(s.launchFailed, true);
    assert.equal(s.steps.length, 1);
  });

  test('imprevistos sorteados entram no roteiro; eventos pulados não', function () {
    var seed = 36; // tempestade, bug e falha de roda
    var s = VS.build(run({}, seed));
    var ids = s.steps.map(function (x) { return x.event.id; });
    ['RE2', 'RE3', 'RE4'].forEach(function (id) { assert(ids.indexOf(id) !== -1, id); });
    var lost = VS.build(run({ orbit: 'iss400', launcher: 'iss_cargo' })); // sem contato
    assert.equal(lost.steps[lost.steps.length - 1].event.id, 'E4');
  });
  test('carga para a ISS: a separação vira encontro + acoplamento (passo mais longo)', function () {
    var cargo = VS.build(run({ orbit: 'iss400', launcher: 'iss_cargo', groundStation: 'gs_national', obc: 'obc_adv' }));
    var normal = VS.build(run({}));
    var sep = function (s) { return s.steps.filter(function (x) { return x.event.fx === 'separation'; })[0]; };
    assert.equal(cargo.docking, true);
    assert.equal(normal.docking, false);
    assert(sep(cargo).t1 - sep(cargo).t0 > sep(normal).t1 - sep(normal).t0, 'acoplamento leva mais tempo');
  });
})(globalThis);
