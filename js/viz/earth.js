/* =====================================================================
 * viz/earth.js — LEITURA DO MAPA DA TERRA (puro, sem Three.js, testado)
 *
 *   MS.earth.classAt(lat, lon) → 0 oceano · 1 vegetação · 2 seco · 3 gelo
 *                                (null se o mapa não foi carregado)
 *
 * Os dados ficam em js/data/earthmask.js (grade de 1°, gerada a partir
 * da imagem da Terra do repositório nasa/mission-viz).
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var bytes = null;

  function decode() {
    if (bytes) return bytes;
    var m = MS.data && MS.data.earthMask;
    if (!m || typeof root.atob !== 'function') return null;
    var bin = root.atob(m.data);
    bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function classAt(lat, lon) {
    var b = decode();
    if (!b) return null;
    var m = MS.data.earthMask;
    var row = Math.min(m.height - 1, Math.max(0, Math.floor(90 - lat)));
    var col = ((Math.floor(lon + 180) % 360) + 360) % 360;
    var i = row * m.width + col;
    return (b[i >> 2] >> ((i & 3) * 2)) & 3;
  }

  MS.earth = {
    OCEAN: 0, GREEN: 1, ARID: 2, ICE: 3,
    classAt: classAt,
    available: function () { return !!decode(); }
  };
})(globalThis);
