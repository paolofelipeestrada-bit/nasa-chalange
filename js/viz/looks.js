/* =====================================================================
 * viz/looks.js — APARÊNCIA 3D DE CADA ITEM (puro, sem Three.js, testado)
 *
 *   MS.looks.resolve(source, item) → { kind, ...parâmetros }
 *
 * A aparência sai dos próprios dados do catálogo, para que um item novo
 * já ganhe um modelo 3D coerente sem mexer no código:
 *   câmera     comprimento da lente segue focal_mm (≥ 300 mm vira telescópio)
 *   estrutura  formato 3U / 6U (formFactor)
 *   energia    asas abertas quando gera mais do que painéis no corpo dariam
 *   atitude    rodas de reação quando a precisão é melhor que 1°
 *   rádio      antena conforme a banda (UHF fitas, S placa, X prato)
 *   computador placas e dissipador conforme memória e compressão
 *   órbita     altitude e inclinação reais
 *   estação    tamanho do prato conforme as bandas; neve perto dos polos
 *
 * Para forçar outra aparência, ponha no item do catálogo um campo
 * look: { ... } (ex.: look: { upper: 'capsule' } num lançador). Os
 * desenhos ficam em js/viz/parts3d.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  // Tipos de modelo que js/viz/parts3d.js sabe desenhar.
  var KINDS = ['orbit', 'rocket', 'station', 'camera', 'frame', 'solar', 'adcs', 'radio', 'computer', 'iss'];

  function num(x, d) { return typeof x === 'number' && isFinite(x) ? x : d; }
  // Valor por formato ({ '3U': 7, '6U': 14 }) ou número simples.
  function ffValue(v, ff) {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object') return num(v[ff], null);
    return null;
  }

  var BY_SOURCE = {
    orbits: function (it) {
      var alt = num(it.altitude_km, 500), inc = num(it.inclination_deg, 0);
      return {
        kind: 'orbit', altitude_km: alt, inclination_deg: inc,
        // Órbita da estação espacial (~400 km, 51,6°): o modelo mostra a ISS no anel.
        station: alt <= 430 && Math.abs(inc - 51.6) < 1.5
      };
    },
    launchers: function () {
      return { kind: 'rocket', stages: 2, upper: 'fairing', tug: false };
    },
    groundStations: function (it) {
      var bands = it.bands || [];
      return {
        kind: 'station',
        dish_m: bands.indexOf('X') !== -1 ? 3.7 : 2.4, // banda X pede prato maior
        snow: Math.abs(num(it.latitude_deg, 0)) >= 60
      };
    }
  };

  var BY_ROLE = {
    payload: function (it) {
      var f = num(it.focal_mm, 80);
      return { kind: 'camera', focal_mm: f, telescope: f >= 300, bands: num(it.bands, 1) };
    },
    structure: function (it) {
      var ff = it.formFactor || '3U';
      return { kind: 'frame', formFactor: ff, units: parseInt(ff, 10) || 3 };
    },
    power: function (it) {
      // Painéis no corpo de um 3U dão no máximo ~8 W; acima disso, são asas abertas.
      var w3 = ffValue(it.solarPower_W, '3U');
      return { kind: 'solar', wings: w3 != null ? w3 > 10 : false };
    },
    adcs: function (it) {
      return { kind: 'adcs', wheels: num(it.accuracy_deg, 5) < 1 };
    },
    comms: function (it) {
      return { kind: 'radio', band: it.band || 'UHF' };
    },
    obc: function (it) {
      return { kind: 'computer', boards: num(it.storage_GB, 4) >= 32 ? 2 : 1, heatsink: num(it.compressionRatio, 1) >= 4 };
    }
  };

  function resolve(source, item) {
    if (!item) return null;
    var fn = source === 'components' ? BY_ROLE[item.role] : BY_SOURCE[source];
    var base = fn ? fn(item) : { kind: null };
    if (item.look && typeof item.look === 'object') {
      Object.keys(item.look).forEach(function (k) { base[k] = item.look[k]; });
    }
    return base;
  }

  // Todas as opções de um cenário com a aparência resolvida (usado nos testes).
  function forScenario(sc, catalog) {
    var out = [];
    (sc.slots || []).forEach(function (slot) {
      (slot.options || []).forEach(function (id) {
        var item = (catalog[slot.source] || {})[id];
        out.push({ slot: slot.id, id: id, look: resolve(slot.source, item) });
      });
    });
    return out;
  }

  MS.looks = { KINDS: KINDS, resolve: resolve, forScenario: forScenario };
})(globalThis);
