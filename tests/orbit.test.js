/* Testes do propagador kepleriano (js/viz/orbit.js). */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert, O = MS.orbit;

  T.group('Órbitas (propagador)');

  test('órbita circular de 500 km: raio constante e período ≈ 94,6 min', function () {
    var el = O.circular(500, 97.4);
    for (var k = 0; k < 12; k++) assert.near(O.position(el, k * 0.5).r, 6871, 1e-6);
    assert.near(O.period(el) / 60, 94.6, 0.2);
    assert.near(O.speed(el, 6871), 7.62, 0.02);
  });

  test('a inclinação limita a latitude máxima (ISS 51,6°)', function () {
    var el = O.circular(400, 51.6), maxLat = 0;
    for (var k = 0; k < 360; k++) {
      var p = O.position(el, k * Math.PI / 180);
      maxLat = Math.max(maxLat, Math.asin(p.y / p.r) * 180 / Math.PI);
    }
    assert.near(maxLat, 51.6, 0.05);
  });

  test('equação de Kepler e órbita elíptica (perigeu e apogeu)', function () {
    var E = O.solveKepler(1.2, 0.3);
    assert.near(E - 0.3 * Math.sin(E), 1.2, 1e-10);
    var el = { a_km: 7000, e: 0.1, i_deg: 0, raan_deg: 0, argp_deg: 0 };
    assert.near(O.position(el, 0).r, 6300, 1e-6, 'perigeu');
    assert.near(O.position(el, Math.PI).r, 7700, 1e-6, 'apogeu');
    assert.near(O.atTime(el, O.period(el), 0).r, 6300, 1e-3, 'uma volta depois, de volta ao perigeu');
  });

  test('Hohmann de 380 km até a ISS (420 km): dois impulsos pequenos', function () {
    var h = O.hohmann(O.RE + 380, O.RE + 420);
    assert(h.dv1_kms > 0.005 && h.dv1_kms < 0.05, 'dv1 ' + h.dv1_kms);
    assert(h.dv2_kms > 0.005 && h.dv2_kms < 0.05, 'dv2 ' + h.dv2_kms);
    assert.near(h.time_s / 60, 46, 2, 'meia volta da elipse');
  });
})(globalThis);
