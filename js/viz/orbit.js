/* =====================================================================
 * viz/orbit.js — PROPAGADOR KEPLERIANO (puro, sem Three.js, testado)
 *
 * Mesma ideia do OrbitalPropagator.js do repositório da NASA
 * nasa/mission-viz: os 5 elementos orbitais definem a elipse, e a
 * anomalia diz onde o satélite está nela.
 *   el = { a_km, e, i_deg, raan_deg, argp_deg }
 *        semi-eixo maior, excentricidade, inclinação, nodo ascendente,
 *        argumento do perigeu
 *
 *   MS.orbit.position(el, nu)        → { x, y, z } em km (Y = norte)
 *   MS.orbit.atTime(el, t_s, M0)     → posição depois de t segundos
 *   MS.orbit.speed(el, r_km)         → km/s (equação vis-viva)
 *   MS.orbit.period(el)              → segundos
 *   MS.orbit.circular(alt, inc)      → elementos de uma órbita circular
 *   MS.orbit.hohmann(r1, r2)         → transferência entre duas órbitas
 *
 * Eixos da cena 3D: equador no plano XZ, norte em +Y (os mesmos de
 * latitude/longitude do resto do jogo).
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var MU = 398600.4418, RE = 6371, DEG = Math.PI / 180;

  function circular(alt_km, inc_deg, raan_deg) {
    return { a_km: RE + alt_km, e: 0, i_deg: inc_deg || 0, raan_deg: raan_deg || 0, argp_deg: 0 };
  }
  function period(el) { return 2 * Math.PI * Math.sqrt(Math.pow(el.a_km, 3) / MU); }

  // Equação de Kepler M = E − e·sen E, resolvida por Newton.
  function solveKepler(M, e) {
    var E = e < 0.8 ? M : Math.PI;
    for (var k = 0; k < 30; k++) {
      var f = E - e * Math.sin(E) - M, d = 1 - e * Math.cos(E);
      E -= f / d;
      if (Math.abs(f) < 1e-12) break;
    }
    return E;
  }
  function trueFromMean(M, e) {
    if (!e) return M;
    var E = solveKepler(M, e);
    return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  }

  function position(el, nu) {
    var e = el.e || 0, r = el.a_km * (1 - e * e) / (1 + e * Math.cos(nu));
    var i = el.i_deg * DEG, O = (el.raan_deg || 0) * DEG, u = (el.argp_deg || 0) * DEG + nu;
    var x = r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i));
    var y = r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i));
    var z = r * (Math.sin(u) * Math.sin(i));
    return { x: x, y: z, z: -y, r: r }; // cena: Y = norte
  }

  function atTime(el, t_s, M0) {
    var n = 2 * Math.PI / period(el);
    return position(el, trueFromMean((M0 || 0) + n * t_s, el.e || 0));
  }

  function speed(el, r_km) { return Math.sqrt(MU * (2 / r_km - 1 / el.a_km)); }

  // Transferência de Hohmann entre órbitas circulares de raio r1 e r2 (km).
  function hohmann(r1, r2) {
    var a = (r1 + r2) / 2;
    var v1 = Math.sqrt(MU / r1), v2 = Math.sqrt(MU / r2);
    var vp = Math.sqrt(MU * (2 / r1 - 1 / a)), va = Math.sqrt(MU * (2 / r2 - 1 / a));
    return {
      a_km: a, e: Math.abs(r2 - r1) / (r1 + r2),
      dv1_kms: Math.abs(vp - v1), dv2_kms: Math.abs(v2 - va),
      time_s: Math.PI * Math.sqrt(a * a * a / MU)
    };
  }

  MS.orbit = {
    MU: MU, RE: RE,
    circular: circular, period: period, solveKepler: solveKepler, trueFromMean: trueFromMean,
    position: position, atTime: atTime, speed: speed, hohmann: hohmann
  };
})(globalThis);
