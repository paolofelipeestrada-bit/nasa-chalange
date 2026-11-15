/* =====================================================================
 * sim.js — MOTOR DE SIMULAÇÃO (100% independente da interface)
 *
 *   MS.sim.run(state [, data])  → resultados + explicações
 *       state = { scenarioId, design: { slotId: optionId | null } }
 *       data  = MS.data (padrão): fases, catálogo e cenários
 *   MS.sim.validate(data)       → lista de problemas nos dados ([] = ok)
 *
 * O motor não toca no DOM, no localStorage nem no state: só calcula.
 * Regras físicas ficam aqui; números e textos ficam em /js/data.
 * Textos do motor: chaves de MS.i18n (js/i18n/en.js, pt.js, es.js).
 * Cada métrica traz "plain" (frase simples) e "explanation" (a conta).
 * Status usados em tudo: 'ok' | 'warn' | 'fail' | 'pending'.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var I = MS.i18n || { t: function (k) { return k; }, L: function (v) { return v; }, sep: function () { return { thousands: '.', decimal: ',' }; }, isText: function () { return false; } };
  function t(key, params) { return I.t(key, params); }
  function L(v) { return I.L(v); }

  // ------------------------------------------------- Constantes físicas
  var R_EARTH_KM = 6371;         // raio médio da Terra
  var MU_KM3_S2 = 398600.4418;   // parâmetro gravitacional da Terra
  var EQUATOR_KM = 40075;        // circunferência no equador
  var MIN_PER_DAY = 1440;
  var DEG = Math.PI / 180;

  // ------------------------------------------------------------ Métricas
  // Tudo o que o motor calcula. Requisitos e eventos usam estas chaves.
  // Rótulo: t('m.<chave>'). unitKey = unidade traduzida (t('u.<unitKey>')).
  var METRICS = {
    altitude_km:          { unit: 'km',   decimals: 0 },
    period_min:           { unit: 'min',  decimals: 1 },
    orbitsPerDay:         { unit: '',     decimals: 1 },
    eclipse_pct:          { unit: '%',    decimals: 1 },
    lifetime_years:       { unitKey: 'years', decimals: 1 },
    gsd_m:                { unit: 'm',    decimals: 1 },
    swath_km:             { unit: 'km',   decimals: 1 },
    revisit_days:         { unitKey: 'days', decimals: 1 },
    areaPerDay_km2:       { unit: 'km²',  decimals: 0 },
    dataPerDay_Gbit:      { unit: 'Gbit', decimals: 2 },
    passesPerDay:         { unitKey: 'perDay', decimals: 1 },
    contactMinPerDay:     { unitKey: 'minPerDay', decimals: 0 },
    downlink_Gbit_day:    { unitKey: 'gbitPerDay', decimals: 2 },
    powerGen_W:           { unit: 'W',    decimals: 1 },
    powerUse_W:           { unit: 'W',    decimals: 1 },
    mass_kg:              { unit: 'kg',   decimals: 2 },
    massLimit_kg:         { unit: 'kg',   decimals: 1 },
    volume_U:             { unit: 'U',    decimals: 1 },
    volumeCapacity_U:     { unit: 'U',    decimals: 1 },
    storageNeed_Gbit:     { unit: 'Gbit', decimals: 1 },
    storage_Gbit:         { unit: 'Gbit', decimals: 0 },
    pointingAccuracy_deg: { unit: '°',    decimals: 2 },
    pointingRequired_deg: { unit: '°',    decimals: 2 },
    cost_k:               { unit: 'k$',   decimals: 0 },
    budget_k:             { unit: 'k$',   decimals: 0 },
    devTime_months:       { unitKey: 'months', decimals: 0 },
    launchWait_months:    { unitKey: 'months', decimals: 0 },
    schedule_months:      { unitKey: 'months', decimals: 0 },
    deadline_months:      { unitKey: 'months', decimals: 0 }
  };
  function unitOf(def) { return def.unitKey ? t('u.' + def.unitKey) : def.unit; }

  // Recursos: demanda × capacidade (ambas métricas acima). Rótulo: t('res.<id>').
  var RESOURCES = [
    { id: 'mass',     demand: 'mass_kg',          capacity: 'massLimit_kg' },
    { id: 'volume',   demand: 'volume_U',         capacity: 'volumeCapacity_U' },
    { id: 'power',    demand: 'powerUse_W',       capacity: 'powerGen_W' },
    { id: 'downlink', demand: 'dataPerDay_Gbit',  capacity: 'downlink_Gbit_day' },
    { id: 'storage',  demand: 'storageNeed_Gbit', capacity: 'storage_Gbit' },
    { id: 'cost',     demand: 'cost_k',           capacity: 'budget_k' },
    { id: 'time',     demand: 'schedule_months',  capacity: 'deadline_months' }
  ];

  // Verificações de projeto (checks). Textos: t('chk.<id>.label|fail|warn').
  var CHECKS = {
    mass: { warn: true }, volume: { warn: true }, power: { warn: true }, downlink: { warn: true },
    storage: { warn: true }, cost: { warn: true }, time: { warn: true },
    pointing: {}, launch: {}, contact: {}, band: {}
  };
  var CHECK_IDS = Object.keys(CHECKS);

  // Campos exigidos nos dados (usados por validate).
  var COMPONENT_FIELDS = ['role', 'name', 'maturity', 'mass_kg', 'power_W', 'volume_U', 'cost_k'];
  var ROLE_FIELDS = {
    payload:   ['pixel_um', 'focal_mm', 'pixelsAcross', 'bands', 'bitDepth', 'requiredPointing_deg'],
    structure: ['formFactor', 'capacity_U'],
    power:     ['solarPower_W'],
    adcs:      ['accuracy_deg'],
    comms:     ['band', 'dataRate_kbps'],
    obc:       ['storage_GB', 'compressionRatio']
  };
  var SOURCE_FIELDS = {
    orbits:         ['name', 'altitude_km', 'inclination_deg', 'lifetime_years'],
    launchers:      ['name', 'orbits', 'maxMass_kg', 'cost_k'],
    groundStations: ['name', 'latitude_deg', 'bands', 'cost_k']
  };
  // Escolhas que o motor sabe interpretar: id do slot → seção do catálogo.
  var ENGINE_SLOTS = {
    orbit: 'orbits', launcher: 'launchers', groundStation: 'groundStations',
    payload: 'components', structure: 'components', power: 'components',
    adcs: 'components', comms: 'components', obc: 'components'
  };

  // ---------------------------------------------------------- Utilitários
  function isNum(x) { return typeof x === 'number' && !isNaN(x); }

  // Número no padrão do idioma: en 1,234.5 · pt/es 1.234,5.
  function fmt(x, decimals) {
    if (!isNum(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '-∞';
    var sep = I.sep();
    var a = Math.abs(x);
    var d = decimals == null ? (a >= 100 ? 0 : a >= 10 ? 1 : 2) : decimals;
    var parts = a.toFixed(d).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep.thousands);
    return (x < 0 && Number(a.toFixed(d)) !== 0 ? '-' : '') + parts.join(sep.decimal);
  }
  function withUnit(x, unit, decimals) {
    var n = fmt(x, decimals);
    if (!unit) return n;
    return n + (unit === '%' || unit === '°' ? '' : ' ') + unit;
  }
  function pct(x, decimals) { return isNum(x) && isFinite(x) ? fmt(x * 100, decimals == null ? 0 : decimals) + '%' : '—'; }
  function fmtLat(lat) { return fmt(Math.abs(lat), 0) + '° ' + (lat >= 0 ? 'N' : 'S'); }
  function fmtRate(kbps) { return kbps >= 1000 ? fmt(kbps / 1000, 1) + ' Mbps' : fmt(kbps, 1) + ' kbps'; }
  function round6(x) { return isNum(x) ? Math.round(x * 1e6) / 1e6 : x; }
  function tol(ref) { return 1e-9 * Math.max(1, Math.abs(ref)); }

  // Valor do catálogo: número ou objeto por formato ({ '3U': 1, '6U': 2 }).
  function byFF(value, ff) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && ff && isNum(value[ff])) return value[ff];
    return null;
  }

  var OPS = {
    '<=': function (a, b) { return a <= b + tol(b); },
    '<':  function (a, b) { return a < b; },
    '>=': function (a, b) { return a >= b - tol(b); },
    '>':  function (a, b) { return a > b; },
    '==': function (a, b) { return Math.abs(a - b) <= tol(b); }
  };
  var OP_TEXT = { '<=': '≤', '<': '<', '>=': '≥', '>': '>', '==': '=' };

  var STATUS_RANK = { ok: 0, warn: 1, pending: 2, fail: 3 };
  function worst(list) {
    return list.reduce(function (acc, s) { return STATUS_RANK[s] > STATUS_RANK[acc] ? s : acc; }, 'ok');
  }
  function indexBy(list, key) {
    var o = {};
    list.forEach(function (x) { o[x[key]] = x; });
    return o;
  }

  // ------------------------------------------------------- Seleção (design)
  // Troca ids por objetos do catálogo. Ids ausentes ou inválidos = faltando.
  function resolveSelection(design, scenario, catalog) {
    var sel = {}, missing = [];
    scenario.slots.forEach(function (slot) {
      var id = design ? design[slot.id] : null;
      var section = catalog[slot.source] || {};
      var ok = id && slot.options.indexOf(id) !== -1 && section[id];
      if (ok) {
        sel[slot.id] = Object.assign({ id: id }, section[id]);
        sel[slot.id].name = L(section[id].name);
      } else {
        sel[slot.id] = null;
        missing.push(slot.id);
      }
    });
    return { sel: sel, missing: missing };
  }

  // ------------------------------------------------------------------ MEL
  // Master Equipment List: uma linha por componente, com contingência.
  function buildMEL(ctx) {
    var sel = ctx.sel;
    var ff = sel.structure ? sel.structure.formFactor : null;
    var maturity = ctx.catalog.maturity || {};
    var items = [];
    var partial = false;

    function val(c, key) {
      if (c[key] === undefined) return 0;
      var v = byFF(c[key], ff);
      if (v === null) partial = true; // depende de um formato ainda não escolhido
      return v;
    }

    ctx.scenario.slots.forEach(function (slot) {
      if (slot.source !== 'components') return;
      var c = sel[slot.id];
      if (!c) { partial = true; return; }
      var mat = maturity[c.maturity] || { label: String(c.maturity), contingency: 0 };
      var k = mat.contingency || 0;
      var mass = val(c, 'mass_kg');
      var power = val(c, 'power_W');
      var duty = isNum(c.duty) ? c.duty : 1;
      var avg = isNum(power) ? power * duty : null;
      items.push({
        slot: slot.id, slotLabel: L(slot.label), id: c.id, name: c.name,
        maturity: c.maturity, maturityLabel: L(mat.label), contingency: k,
        devMonths: isNum(mat.devMonths) ? mat.devMonths : 0,
        mass_kg: mass, massTotal_kg: isNum(mass) ? mass * (1 + k) : null,
        power_W: power, duty: duty, avgPower_W: avg, avgPowerTotal_W: isNum(avg) ? avg * (1 + k) : null,
        volume_U: val(c, 'volume_U'), cost_k: val(c, 'cost_k')
      });
    });

    function sum(key) {
      return round6(items.reduce(function (s, it) { return s + (isNum(it[key]) ? it[key] : 0); }, 0));
    }
    return {
      items: items,
      partial: partial,
      totals: {
        mass_kg: sum('mass_kg'), massTotal_kg: sum('massTotal_kg'),
        avgPower_W: sum('avgPower_W'), avgPowerTotal_W: sum('avgPowerTotal_W'),
        volume_U: sum('volume_U'), cost_k: sum('cost_k')
      }
    };
  }

  // ------------------------------------------------------- Modelo orbital
  function orbitModel(o) {
    var a = R_EARTH_KM + o.altitude_km;
    var period = 2 * Math.PI * Math.sqrt(a * a * a / MU_KM3_S2) / 60;
    var i = o.inclination_deg;
    return {
      a_km: a,
      period_min: period,
      orbitsPerDay: MIN_PER_DAY / period,
      eclipseFraction: Math.asin(R_EARTH_KM / a) / Math.PI, // pior caso: Sol no plano da órbita
      maxLat_deg: i <= 90 ? i : 180 - i                     // latitude máxima do traço no solo
    };
  }

  // Contato com a estação: círculo de visada (raio lambda, em graus de
  // arco da Terra) e chance de cada cruzamento da latitude cair nele.
  function contactModel(om, station) {
    var eps = isNum(station.minElevation_deg) ? station.minElevation_deg : 10;
    var eta = Math.asin(R_EARTH_KM * Math.cos(eps * DEG) / om.a_km) / DEG;
    var lambda = 90 - eps - eta;
    var lat = Math.abs(station.latitude_deg);
    var perOrbit = 0;
    if (lat <= om.maxLat_deg + lambda) {
      var cosLat = Math.cos(lat * DEG);
      var p = cosLat > 1e-6 ? Math.min(1, 2 * lambda / (360 * cosLat)) : 1;
      perOrbit = Math.min(1, 2 * p); // cruza a latitude subindo e descendo
    }
    var maxPass = (2 * lambda / 360) * om.period_min;
    var avgPass = maxPass * Math.PI / 4; // corda média de um círculo
    var passes = perOrbit * om.orbitsPerDay;
    return {
      lambda_deg: lambda, perOrbit: perOrbit, passesPerDay: passes,
      maxPass_min: maxPass, avgPass_min: avgPass, contactMinPerDay: passes * avgPass
    };
  }

  // ------------------------------------------------------------- Métricas
  // Cada métrica: valor, unidade, frase simples (plain) e a conta
  // (explanation). Faltando escolhas, o valor fica null e a explicação
  // diz o que falta. "partial" = soma parcial (faltam componentes).
  function computeMetrics(ctx, mel) {
    var sel = ctx.sel, sc = ctx.scenario, p = sc.params || {};
    var m = {};

    function set(key, value, explanation, partial, plain) {
      var def = METRICS[key];
      m[key] = {
        key: key, label: t('m.' + key), unit: unitOf(def), decimals: def.decimals,
        value: isNum(value) ? value : null, partial: !!partial, explanation: explanation, plain: plain || ''
      };
    }
    function missingText(slots) {
      return t('eng.missing', { list: slots.filter(function (s) { return !sel[s]; })
        .map(function (s) { return ctx.slotLabel[s] || s; }).join(', ') });
    }
    function pend(keys, slots) {
      var txt = missingText(slots);
      keys.forEach(function (k) { set(k, null, txt); });
    }
    var soFar = mel.partial ? t('eng.soFar') : '';

    // Órbita
    var o = sel.orbit, om = o ? orbitModel(o) : null;
    var ff = sel.structure ? sel.structure.formFactor : null;
    if (om) {
      var shadowMin = om.eclipseFraction * om.period_min;
      set('altitude_km', o.altitude_km, t('x.altitude', { name: o.name }), false,
        t('p.altitude', { h: fmt(o.altitude_km, 0) }));
      set('period_min', om.period_min, t('x.period', { r: fmt(R_EARTH_KM, 0), h: fmt(o.altitude_km, 0), a: fmt(om.a_km, 0), T: fmt(om.period_min, 1) }), false,
        t('p.period', { T: fmt(om.period_min, 0), n: fmt(om.orbitsPerDay, 0) }));
      set('orbitsPerDay', om.orbitsPerDay, t('x.orbitsPerDay', { min: fmt(MIN_PER_DAY, 0), T: fmt(om.period_min, 1), n: fmt(om.orbitsPerDay, 1) }), false,
        t('p.orbitsPerDay', { n: fmt(om.orbitsPerDay, 1) }));
      set('eclipse_pct', om.eclipseFraction * 100, t('x.eclipse', { pct: pct(om.eclipseFraction, 1), min: fmt(shadowMin, 0) }), false,
        t('p.eclipse', { min: fmt(shadowMin, 0) }));
      set('lifetime_years', o.lifetime_years, t('x.lifetime', { h: fmt(o.altitude_km, 0), y: fmt(o.lifetime_years, 1) }), false,
        t('p.lifetime', { h: fmt(o.altitude_km, 0), y: fmt(o.lifetime_years, 1) }));
    } else {
      pend(['altitude_km', 'period_min', 'orbitsPerDay', 'eclipse_pct', 'lifetime_years'], ['orbit']);
    }

    // Instrumento e cobertura
    var cam = sel.payload, gsd = null, area = null;
    if (om && cam) {
      gsd = (o.altitude_km * 1000) * (cam.pixel_um * 1e-6) / (cam.focal_mm * 1e-3);
      var swath = gsd * cam.pixelsAcross / 1000;
      var lat = sc.aoi.latitude_deg;
      var light = isNum(o.lightingFactor) ? o.lightingFactor : 1;
      var reaches = Math.abs(lat) <= om.maxLat_deg;
      var circ = EQUATOR_KM * Math.cos(lat * DEG);
      var revisit = reaches ? circ / (om.orbitsPerDay * swath * light) : Infinity;
      area = reaches ? sc.aoi.area_km2 / revisit : 0;
      set('gsd_m', gsd, t('x.gsd', { h: fmt(o.altitude_km, 0), px: fmt(cam.pixel_um, 2), f: fmt(cam.focal_mm, 0), gsd: fmt(gsd, 1) }), false,
        t('p.gsd', { gsd: fmt(gsd, 1) }));
      set('swath_km', swath, t('x.swath', { gsd: fmt(gsd, 1), px: fmt(cam.pixelsAcross, 0), sw: fmt(swath, 1) }), false,
        t('p.swath', { sw: fmt(swath, 0) }));
      set('revisit_days', revisit, reaches
        ? t('x.revisit', { circ: fmt(circ, 0), n: fmt(om.orbitsPerDay, 1), sw: fmt(swath, 1), light: pct(light), r: fmt(revisit, 1) })
        : t('x.revisitNever', { i: fmt(o.inclination_deg, 1), lat: fmtLat(lat) }), false,
        reaches ? t('p.revisit', { r: fmt(revisit, 0) }) : t('p.revisitNever'));
      set('areaPerDay_km2', area, reaches
        ? t('x.areaDay', { area: fmt(sc.aoi.area_km2, 0), r: fmt(revisit, 1), a: fmt(area, 0) })
        : t('x.areaNever'));
    } else {
      pend(['gsd_m', 'swath_km', 'revisit_days', 'areaPerDay_km2'], ['orbit', 'payload']);
    }

    // Dados gerados
    var obc = sel.obc, data = null;
    if (om && cam && obc) {
      var raw = (area * 1e6 / (gsd * gsd)) * cam.bands * cam.bitDepth / 1e9;
      data = raw / obc.compressionRatio;
      set('dataPerDay_Gbit', data, t('x.data', { b: cam.bands, bits: cam.bitDepth, raw: fmt(raw, 2), c: fmt(obc.compressionRatio, 0), d: fmt(data, 2) }), false,
        t('p.data', { d: fmt(data, 2) }));
    } else {
      pend(['dataPerDay_Gbit'], ['orbit', 'payload', 'obc']);
    }

    // Contato e envio ao solo
    var gs = sel.groundStation, com = sel.comms;
    var cm = (om && gs) ? contactModel(om, gs) : null;
    if (cm) {
      set('passesPerDay', cm.passesPerDay, cm.passesPerDay > 0
        ? t('x.passes', { lat: fmtLat(gs.latitude_deg), lam: fmt(cm.lambda_deg, 1), pct: pct(cm.perOrbit), n: fmt(om.orbitsPerDay, 1), p: fmt(cm.passesPerDay, 1) })
        : t('x.passesNever', { max: fmt(om.maxLat_deg, 1), lam: fmt(cm.lambda_deg, 1), lat: fmtLat(gs.latitude_deg) }), false,
        cm.passesPerDay > 0 ? t('p.passes', { p: fmt(cm.passesPerDay, 1) }) : t('p.passesNever'));
      set('contactMinPerDay', cm.contactMinPerDay, t('x.contact', { p: fmt(cm.passesPerDay, 1), avg: fmt(cm.avgPass_min, 1), max: fmt(cm.maxPass_min, 1), c: fmt(cm.contactMinPerDay, 0) }), false,
        t('p.contact', { c: fmt(cm.contactMinPerDay, 0) }));
    } else {
      pend(['passesPerDay', 'contactMinPerDay'], ['orbit', 'groundStation']);
    }
    if (cm && com) {
      var bandOk = (gs.bands || []).indexOf(com.band) !== -1;
      var eff = isNum(p.contactEfficiency) ? p.contactEfficiency : 1;
      var cap = bandOk ? com.dataRate_kbps * 1000 * cm.contactMinPerDay * 60 * eff / 1e9 : 0;
      set('downlink_Gbit_day', cap, bandOk
        ? t('x.downlink', { rate: fmtRate(com.dataRate_kbps), c: fmt(cm.contactMinPerDay, 0), eff: pct(eff), cap: fmt(cap, 2) })
        : t('x.downlinkBand', { band: com.band }), false,
        bandOk ? t('p.downlink', { cap: fmt(cap, 2) }) : t('p.downlinkBand'));
    } else {
      pend(['downlink_Gbit_day'], ['orbit', 'groundStation', 'comms']);
    }

    // Energia
    var useW = mel.totals.avgPowerTotal_W;
    set('powerUse_W', useW, t('x.powerUse', { w: fmt(useW, 2), soFar: soFar }), mel.partial, t('p.powerUse', { w: fmt(useW, 1) }));
    var pw = sel.power;
    if (om && pw && ff) {
      var solar = byFF(pw.solarPower_W, ff);
      var sun = 1 - om.eclipseFraction;
      var etaS = isNum(p.powerStorageEfficiency) ? p.powerStorageEfficiency : 1;
      var gen = isNum(solar) ? solar * sun * etaS : null;
      set('powerGen_W', gen, isNum(solar)
        ? t('x.powerGen', { s: fmt(solar, 1), sun: pct(sun), eta: pct(etaS), g: fmt(gen, 2) })
        : t('x.powerNoFF', { ff: ff }), false,
        isNum(solar) ? t('p.powerGen', { g: fmt(gen, 1) }) : '');
    } else {
      pend(['powerGen_W'], ['orbit', 'structure', 'power']);
    }

    // Massa e volume
    set('mass_kg', mel.totals.massTotal_kg, t('x.mass', { m: fmt(mel.totals.mass_kg, 2), mt: fmt(mel.totals.massTotal_kg, 2), soFar: soFar }), mel.partial,
      t('p.mass', { mt: fmt(mel.totals.massTotal_kg, 2) }));
    var Ln = sel.launcher;
    if (Ln && ff) {
      var limit = byFF(Ln.maxMass_kg, ff);
      set('massLimit_kg', limit, isNum(limit)
        ? t('x.massLimit', { name: Ln.name, lim: fmt(limit, 1), ff: ff })
        : t('x.massLimitNo', { name: Ln.name, ff: ff }), false,
        isNum(limit) ? t('p.massLimit', { lim: fmt(limit, 1) }) : '');
    } else {
      pend(['massLimit_kg'], ['launcher', 'structure']);
    }
    set('volume_U', mel.totals.volume_U, t('x.volume', { v: fmt(mel.totals.volume_U, 1), soFar: soFar }), mel.partial);
    if (sel.structure) {
      set('volumeCapacity_U', sel.structure.capacity_U, t('x.volCap', { ff: ff, c: fmt(sel.structure.capacity_U, 1) }));
    } else {
      pend(['volumeCapacity_U'], ['structure']);
    }

    // Memória
    var days = isNum(p.storageDays) ? p.storageDays : 1;
    if (obc) set('storage_Gbit', obc.storage_GB * 8, t('x.storage', { gb: fmt(obc.storage_GB, 0), gbit: fmt(obc.storage_GB * 8, 0) }));
    else pend(['storage_Gbit'], ['obc']);
    if (isNum(data)) set('storageNeed_Gbit', data * days, t('x.storageNeed', { days: fmt(days, 0), d: fmt(data, 2), need: fmt(data * days, 1) }));
    else pend(['storageNeed_Gbit'], ['orbit', 'payload', 'obc']);

    // Apontamento
    if (sel.adcs) set('pointingAccuracy_deg', sel.adcs.accuracy_deg, t('x.pointAcc', { name: sel.adcs.name, acc: fmt(sel.adcs.accuracy_deg, 2) }));
    else pend(['pointingAccuracy_deg'], ['adcs']);
    if (cam) set('pointingRequired_deg', cam.requiredPointing_deg, t('x.pointReq', { name: cam.name, req: fmt(cam.requiredPointing_deg, 2) }));
    else pend(['pointingRequired_deg'], ['payload']);

    // Custo
    var launchCost = (Ln && ff) ? byFF(Ln.cost_k, ff) : null;
    var gsCost = gs ? gs.cost_k : null;
    var cost = mel.totals.cost_k + (isNum(launchCost) ? launchCost : 0) + (isNum(gsCost) ? gsCost : 0);
    set('cost_k', cost, t('x.cost', {
      mel: fmt(mel.totals.cost_k, 0),
      launch: isNum(launchCost) ? fmt(launchCost, 0) + ' k$' : t('eng.tbd'),
      gs: isNum(gsCost) ? fmt(gsCost, 0) + ' k$' : t('eng.tbd'),
      total: fmt(cost, 0)
    }), mel.partial || !isNum(launchCost) || !isNum(gsCost), t('p.cost', { total: fmt(cost, 0) }));
    set('budget_k', sc.budget_k, t('x.budget'));

    // Prazo: construir e testar (a peça mais lenta manda) + espera do lançador
    var base = isNum(p.baseDev_months) ? p.baseDev_months : 12;
    var slowest = null;
    mel.items.forEach(function (it) { if (!slowest || it.devMonths > slowest.devMonths) slowest = it; });
    var extra = slowest ? slowest.devMonths : 0;
    var dev = base + extra;
    set('devTime_months', dev, extra > 0
      ? t('x.devTime', { base: fmt(base, 0), extra: fmt(extra, 0), name: slowest.name, mat: slowest.maturityLabel, dev: fmt(dev, 0), soFar: soFar })
      : t('x.devTimeBase', { base: fmt(base, 0), soFar: soFar }), mel.partial, t('p.devTime', { dev: fmt(dev, 0) }));
    var wait = Ln ? (isNum(Ln.waitMonths) ? Ln.waitMonths : 0) : null;
    if (Ln) set('launchWait_months', wait, t('x.launchWait', { name: Ln.name, w: fmt(wait, 0) }), false, t('p.launchWait', { w: fmt(wait, 0) }));
    else pend(['launchWait_months'], ['launcher']);
    var sched = dev + (isNum(wait) ? wait : 0);
    set('schedule_months', sched, t('x.schedule', { dev: fmt(dev, 0), w: isNum(wait) ? fmt(wait, 0) : t('eng.tbd'), s: fmt(sched, 0) }),
      mel.partial || !Ln, t('p.schedule', { s: fmt(sched, 0) }));
    var deadline = isNum(p.deadline_months) ? p.deadline_months : 24;
    set('deadline_months', deadline, t('x.deadline', { d: fmt(deadline, 0) }));

    return m;
  }

  // Troca {métrica} no texto pelo valor formatado (sem unidade).
  function fill(text, metrics) {
    return String(L(text) || '').replace(/\{(\w+)\}/g, function (all, key) {
      var mt = metrics[key];
      return mt ? fmt(mt.value, mt.decimals) : all;
    });
  }

  // ------------------------------------------------------------- Recursos
  // Folga (margem) = (capacidade − demanda) ÷ capacidade.
  function evalResource(def, metrics, margins) {
    var d = metrics[def.demand], c = metrics[def.capacity];
    var rec = isNum(margins[def.id]) ? margins[def.id] : 0;
    var label = t('res.' + def.id);
    var r = {
      id: def.id, label: label, unit: d.unit, decimals: d.decimals,
      demand: d.value, capacity: c.value, partial: d.partial || c.partial,
      usage: null, margin: null, recommendedMargin: rec, status: 'pending',
      details: [d.explanation, c.explanation], plain: [d.plain, c.plain].filter(Boolean).join(' ')
    };
    var u = function (x) { return withUnit(x, r.unit, r.decimals); };
    if (!isNum(r.demand) || !isNum(r.capacity)) {
      r.explanation = !isNum(r.demand) ? d.explanation : c.explanation;
      return r;
    }
    r.usage = r.capacity > 0 ? r.demand / r.capacity : (r.demand > 0 ? Infinity : 0);
    r.margin = r.capacity > 0 ? (r.capacity - r.demand) / r.capacity : (r.demand > 0 ? -Infinity : 0);
    if (r.demand > r.capacity + tol(r.capacity)) r.status = 'fail';
    else if (r.partial) r.status = 'pending';
    else r.status = r.margin >= rec - 1e-9 ? 'ok' : 'warn';

    if (r.capacity <= 0) {
      r.explanation = t('eng.resZero', { label: d.label, demand: u(r.demand) });
    } else if (r.status === 'fail') {
      var over = r.usage >= 2 ? t('eng.resOverTimes', { n: fmt(r.usage, 1) }) : t('eng.resOverPct', { pct: pct(r.usage - 1) });
      r.explanation = t('eng.resFail', { label: d.label, demand: u(r.demand), cap: withUnit(r.capacity, r.unit, c.decimals), over: over });
    } else {
      r.explanation = t('eng.resOk', { label: d.label, demand: u(r.demand), cap: withUnit(r.capacity, r.unit, c.decimals), pct: pct(r.margin) }) +
        (rec > 0 ? t('eng.resRec', { pct: pct(rec) }) : '.') +
        (r.partial && r.status !== 'fail' ? t('eng.partialSum') : '');
    }
    return r;
  }

  // ------------------------------------------------- Verificações (checks)
  function computeChecks(ctx, metrics, resources) {
    var sel = ctx.sel, out = [];
    function add(id, status, explanation) {
      var def = CHECKS[id];
      out.push({
        id: id, label: t('chk.' + id + '.label'), status: status, explanation: explanation,
        hint: status === 'fail' ? t('chk.' + id + '.fail') : status === 'warn' && def.warn ? t('chk.' + id + '.warn') : null
      });
    }
    function missing(slots) {
      return t('eng.missing', { list: slots.filter(function (s) { return !sel[s]; })
        .map(function (s) { return ctx.slotLabel[s] || s; }).join(', ') });
    }

    resources.forEach(function (r) { add(r.id, r.status, r.explanation); });

    var acc = metrics.pointingAccuracy_deg.value, req = metrics.pointingRequired_deg.value;
    if (isNum(acc) && isNum(req)) {
      var okP = acc <= req + tol(req);
      add('pointing', okP ? 'ok' : 'fail', t('x.pointing', { acc: withUnit(acc, '°', 2), op: okP ? '≤' : '>', req: withUnit(req, '°', 2) }));
    } else {
      add('pointing', 'pending', missing(['adcs', 'payload']));
    }

    var Ln = sel.launcher, o = sel.orbit, st = sel.structure;
    if (Ln && o) {
      if (Ln.orbits.indexOf(o.id) === -1) add('launch', 'fail', t('x.launchNoOrbit', { name: Ln.name, orbit: o.name }));
      else if (!st) add('launch', 'pending', t('x.launchPending', { missing: missing(['structure']) }));
      else if (!isNum(byFF(Ln.maxMass_kg, st.formFactor))) add('launch', 'fail', t('x.launchNoFF', { name: Ln.name, ff: st.formFactor }));
      else add('launch', 'ok', t('x.launchOk', { name: Ln.name, ff: st.formFactor, orbit: o.name }));
    } else {
      add('launch', 'pending', missing(['launcher', 'orbit']));
    }

    var passes = metrics.passesPerDay;
    add('contact', !isNum(passes.value) ? 'pending' : passes.value > 0 ? 'ok' : 'fail', passes.explanation);

    var gs = sel.groundStation, com = sel.comms;
    if (gs && com) {
      var okB = (gs.bands || []).indexOf(com.band) !== -1;
      add('band', okB ? 'ok' : 'fail', okB
        ? t('x.bandOk', { band: com.band })
        : t('x.bandFail', { band: com.band, bands: (gs.bands || []).join(', ') }));
    } else {
      add('band', 'pending', missing(['groundStation', 'comms']));
    }
    return out;
  }

  // ----------------------------------------------------------- Requisitos
  // Compara uma métrica com um valor fixo (value) ou com outra métrica (ref).
  function compareMetric(spec, metrics) {
    var mt = metrics[spec.metric];
    if (!mt) return { status: 'fail', value: null, threshold: null, explanation: t('eng.unknownMetric', { m: spec.metric }) };
    var ref = spec.ref ? metrics[spec.ref] : null;
    if (spec.ref && !ref) return { status: 'fail', value: null, threshold: null, explanation: t('eng.unknownMetric', { m: spec.ref }) };
    var threshold = ref ? ref.value : spec.value;
    if (!isNum(mt.value)) return { status: 'pending', value: null, threshold: threshold, unit: mt.unit, explanation: mt.explanation };
    if (!isNum(threshold)) return { status: 'pending', value: mt.value, threshold: null, unit: mt.unit, explanation: ref ? ref.explanation : t('eng.noRef') };
    var pass = OPS[spec.op] ? OPS[spec.op](mt.value, threshold) : false;
    var u = function (x) { return withUnit(x, mt.unit, mt.decimals); };
    var target = ref ? ref.label.toLowerCase() + ': ' + u(threshold) : u(threshold);
    return {
      status: pass ? 'ok' : 'fail', value: mt.value, threshold: threshold, unit: mt.unit,
      explanation: t('eng.reqExpl', { label: mt.label, value: u(mt.value), verdict: t(pass ? 'eng.meets' : 'eng.notMeets'), op: OP_TEXT[spec.op] || spec.op, target: target }) +
        ' ' + mt.explanation + (ref ? ' ' + ref.explanation : ''),
      plain: mt.plain
    };
  }

  function evaluateRequirements(sc, metrics) {
    return (sc.requirements || []).map(function (rq) {
      var r = compareMetric(rq, metrics);
      return {
        id: rq.id, title: L(rq.title), text: L(rq.text), goal: rq.goal || null, rationale: L(rq.rationale) || '',
        weight: isNum(rq.weight) ? rq.weight : 1, metric: rq.metric, op: rq.op,
        status: r.status, value: r.value, threshold: r.threshold, unit: r.unit || '',
        explanation: r.explanation, plain: r.plain || '', hint: r.status === 'fail' ? (L(rq.hint) || null) : null
      };
    });
  }

  // ------------------------------------------------ Plano de verificação
  function evaluateVerification(sc, reqs, checks) {
    var R = indexBy(reqs, 'id'), C = indexBy(checks, 'id');
    return (sc.verification || []).map(function (v) {
      var items = [];
      (v.requirements || []).forEach(function (id) {
        var r = R[id];
        items.push(r
          ? { kind: 'requirement', id: id, label: id + ' ' + r.title, status: r.status, explanation: r.explanation }
          : { kind: 'requirement', id: id, label: id, status: 'fail', explanation: t('eng.unknownReq') });
      });
      (v.checks || []).forEach(function (id) {
        var c = C[id];
        items.push(c
          ? { kind: 'check', id: id, label: c.label, status: c.status, explanation: c.explanation }
          : { kind: 'check', id: id, label: id, status: 'fail', explanation: t('eng.unknownCheck') });
      });
      return {
        id: v.id, title: L(v.title), method: L(v.method) || '', description: L(v.description) || '',
        status: worst(items.map(function (i) { return i.status; })), items: items
      };
    });
  }

  // ---------------------------------------------------- Missão (Implement)
  // Condições usadas em eventos e imprevistos:
  //   { check }  { requirement }  { metric, op, value|ref }
  //   { slot, is }               escolha feita (is: id ou lista de ids)
  //   { margin, op, value }      folga de um recurso (0,25 = 25%)
  function evalCondition(c, env) {
    if (c.check) {
      var k = env.C[c.check];
      if (!k) return { status: 'fail', explanation: t('eng.unknownCheckX', { id: c.check }) };
      return { status: k.status === 'warn' ? 'ok' : k.status, explanation: k.label + ': ' + k.explanation };
    }
    if (c.requirement) {
      var r = env.R[c.requirement];
      if (!r) return { status: 'fail', explanation: t('eng.unknownReqX', { id: c.requirement }) };
      return { status: r.status, explanation: r.id + ' ' + r.title + ': ' + r.explanation };
    }
    if (c.metric) return compareMetric(c, env.metrics);
    if (c.slot) {
      var item = env.sel[c.slot], want = [].concat(c.is || []);
      var label = env.slotLabel[c.slot] || c.slot;
      if (!item) return { status: 'pending', explanation: t('eng.slotNotChosen', { label: label }) };
      var okSlot = want.indexOf(item.id) !== -1;
      return {
        status: okSlot ? 'ok' : 'fail',
        explanation: okSlot ? t('eng.slotIs', { label: label, name: item.name })
          : t('eng.slotNeeds', { label: label, name: item.name, list: want.map(function (id) {
            return '"' + env.optionName(c.slot, id) + '"';
          }).join(t('eng.or')) })
      };
    }
    if (c.margin) {
      var res = env.res[c.margin];
      if (!res) return { status: 'fail', explanation: t('eng.unknownRes', { id: c.margin }) };
      if (!isNum(res.margin)) return { status: 'pending', explanation: res.explanation };
      var okM = OPS[c.op] ? OPS[c.op](res.margin, c.value) : false;
      return {
        status: okM ? 'ok' : 'fail',
        explanation: t('eng.marginCond', { label: res.label.toLowerCase(), pct: pct(res.margin), op: OP_TEXT[c.op] || c.op, val: pct(c.value) })
      };
    }
    return { status: 'ok', explanation: '' };
  }

  // ------------------------------------------------ Imprevistos e riscos
  // Sorteio determinístico: mesma semente + mesmo id = mesmo resultado.
  // Cada imprevisto usa o próprio id, então acrescentar um não muda os outros.
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function roll(seed, id) {
    var a = (seed ^ hashStr(String(id))) >>> 0;
    a = a + 0x6D2B79F5 | 0;
    var t1 = Math.imul(a ^ a >>> 15, 1 | a);
    t1 = t1 + Math.imul(t1 ^ t1 >>> 7, 61 | t1) ^ t1;
    return ((t1 ^ t1 >>> 14) >>> 0) / 4294967296;
  }
  function effectText(eff) {
    if (eff === 'abort') return t('eng.effAbort');
    if (eff && typeof eff === 'object' && isNum(eff.degrade)) {
      return eff.degrade === 0 ? t('eng.effZero') : t('eng.effDegrade', { pct: pct(eff.degrade) });
    }
    return t('eng.effNone');
  }

  // Registro de riscos: para cada imprevisto, se se aplica, se o projeto
  // está protegido e (com semente) se aconteceu nesta tentativa.
  function computeRisks(ctx, env, seed) {
    var hasSeed = isNum(seed);
    return (ctx.scenario.randomEvents || []).filter(function (re) {
      return !(ctx.lifeMode && re.fx === 'storm'); // clima espacial real substitui o sorteio
    }).map(function (re) {
      var applies = (re.appliesIf || []).map(function (c) { return evalCondition(c, env); });
      var doesApply = applies.every(function (x) { return x.status === 'ok'; });
      var mit = (re.mitigatedBy || []).map(function (c) { return evalCondition(c, env); });
      var mitigated = mit.length > 0 && mit.every(function (x) { return x.status === 'ok'; });
      var r = hasSeed ? roll(seed, re.id) : null;
      var occurs = doesApply && hasSeed && r < re.chance;
      var status = !doesApply ? 'na' : mitigated ? 'ok' : 'warn';
      var why = !doesApply
        ? t('eng.riskNA', { why: applies.filter(function (x) { return x.status !== 'ok'; }).map(function (x) { return x.explanation; }).join(' ') })
        : mitigated
          ? t('eng.riskProtected', { why: mit.map(function (x) { return x.explanation; }).join(' ') })
          : mit.length
            ? t('eng.riskExposed', { why: mit.filter(function (x) { return x.status !== 'ok'; }).map(function (x) { return x.explanation; }).join(' ') })
            : t('eng.riskUnavoidable');
      return {
        id: re.id, title: L(re.title), when: L(re.when) || '', after: re.after || null,
        description: L(re.description) || '', chance: re.chance,
        applies: doesApply, mitigated: mitigated, occurs: occurs, roll: r, status: status,
        impact: mitigated ? t('eng.mitigatedImpact') : effectText(re.effect),
        explanation: why, def: re, mitigationResults: mit
      };
    });
  }

  // A missão terminou antes de o satélite chegar à órbita?
  function neverFlew(mission) {
    if (!mission || !mission.aborted) return false;
    var ev = (mission.events || []).filter(function (e) { return e.id === mission.aborted; })[0];
    return !!ev && (ev.fx === 'launch' || ev.fx === 'delay');
  }

  function runMission(ctx, env, risks) {
    var sc = ctx.scenario, p = sc.params || {}, metrics = env.metrics;
    var events = sc.events || [];
    if (ctx.missing.length) {
      return {
        status: 'pending', aborted: null, outcome: null,
        explanation: t('eng.completeToSim'),
        events: events.map(function (ev) {
          return { id: ev.id, when: L(ev.when) || '', title: L(ev.title), status: 'pending', text: '', causes: [], random: false };
        })
      };
    }

    // Sequência: eventos planejados + imprevistos sorteados logo depois do
    // evento indicado em "after" (sem "after": no fim).
    var occurring = risks.filter(function (r) { return r.occurs; });
    var seq = [];
    events.forEach(function (ev) {
      seq.push({ ev: ev, risk: null });
      occurring.filter(function (r) { return r.after === ev.id; }).forEach(function (r) { seq.push({ ev: r.def, risk: r }); });
    });
    occurring.filter(function (r) { return !r.after || !events.some(function (e) { return e.id === r.after; }); })
      .forEach(function (r) { seq.push({ ev: r.def, risk: r }); });

    var log = [], aborted = null, factor = 1;
    seq.forEach(function (step) {
      var ev = step.ev, risk = step.risk;
      var base = { id: ev.id, when: L(ev.when) || '', title: L(ev.title), random: !!risk, fx: ev.fx || null };
      if (aborted) {
        log.push(Object.assign(base, { status: 'skipped', text: t('eng.skipped', { title: L(aborted.title) }), causes: [] }));
        return;
      }
      var failed, success, failure, eff;
      if (risk) {
        failed = risk.mitigated ? [] : (risk.mitigationResults.filter(function (x) { return x.status !== 'ok'; }).length
          ? risk.mitigationResults.filter(function (x) { return x.status !== 'ok'; })
          : [{ explanation: t('eng.noAvoid') }]);
        success = ev.mitigatedText || ev.text;
        failure = ev.text;
        eff = ev.effect || 'none';
      } else {
        failed = (ev.conditions || [])
          .map(function (c) { return evalCondition(c, env); })
          .filter(function (r) { return r.status !== 'ok'; });
        success = ev.success;
        failure = ev.failure;
        eff = ev.onFail || 'abort';
      }
      if (!failed.length) {
        log.push(Object.assign(base, { status: 'ok', text: fill(success, metrics), causes: [] }));
        return;
      }
      var status = 'warn';
      if (eff === 'abort') { aborted = ev; status = 'fail'; }
      else if (typeof eff === 'object' && isNum(eff.degrade)) {
        factor *= eff.degrade;
        if (eff.degrade === 0) status = 'fail';
      }
      log.push(Object.assign(base, {
        status: status, effect: eff, text: fill(failure, metrics),
        causes: failed.map(function (r) { return r.explanation; })
      }));
    });

    var life = env.life;
    if (life && life.pending && !aborted) {
      return { status: 'decide', aborted: null, decision: life.pending, events: log, outcome: null, explanation: t('eng.decide') };
    }
    if (life && !aborted && life.totals.end !== 'complete') {
      log.push({ id: 'LIFE', when: '', title: t('life.end.' + life.totals.end), random: false, fx: null, status: 'fail',
        text: t('life.endText.' + life.totals.end, { day: life.totals.opDays }), causes: [] });
    }

    // Resultado: mapas úteis entregues no período de operação.
    var planned = isNum(p.plannedDuration_years) ? p.plannedDuration_years : 1;
    var days = Math.min(planned, metrics.lifetime_years.value) * 365;
    var revisit = metrics.revisit_days.value;
    var data = metrics.dataPerDay_Gbit.value, cap = metrics.downlink_Gbit_day.value;
    var dataFraction = data > 0 ? Math.min(1, cap / data) : 1;
    if (life) {
      days = life.totals.opDays;
      dataFraction = life.totals.dataFraction;
      factor *= life.totals.quality;
    }
    var imgDays = life ? life.totals.imagingDays : days;
    var possible = isFinite(revisit) && revisit > 0 ? imgDays / revisit : 0;
    var maps = aborted ? 0 : possible * dataFraction * factor;
    var target = (isNum(p.targetMapsPerYear) ? p.targetMapsPerYear : 12) * planned;
    var value = target > 0 ? Math.min(1, maps / target) : 0;
    var outcome = {
      days: days, imagingDays: imgDays, dataFraction: dataFraction, opsFactor: factor,
      maps: maps, target: target, value: value,
      explanation: aborted
        ? t('eng.outcomeAborted', { title: L(aborted.title) })
        : life
          ? t('eng.outcomeLife', { img: fmt(imgDays, 0), rev: fmt(revisit, 1), data: pct(dataFraction), ops: pct(factor), maps: fmt(maps, 1), target: fmt(target, 0) })
          : t('eng.outcome', { days: fmt(days, 0), rev: fmt(revisit, 1), data: pct(dataFraction), ops: pct(factor), maps: fmt(maps, 1), target: fmt(target, 0) })
    };
    return {
      status: aborted ? 'fail' : value >= 1 - 1e-9 ? 'ok' : value > 0 ? 'warn' : 'fail',
      aborted: aborted ? aborted.id : null,
      events: log, outcome: outcome, explanation: outcome.explanation
    };
  }

  // ------------------------------------------------------------ Pontuação
  function computeScore(sc, reqs, resources, mission) {
    var w = Object.assign({ requirements: 40, mission: 40, budget: 10, margins: 10 }, sc.scoring || {});
    if (mission.status === 'pending' || mission.status === 'decide') return { status: 'pending', total: null, max: null, parts: [], grade: null };
    var totalW = 0, okW = 0, okN = 0;
    reqs.forEach(function (r) { totalW += r.weight; if (r.status === 'ok') { okW += r.weight; okN++; } });
    var cost = resources.filter(function (r) { return r.id === 'cost'; })[0];
    var within = !!cost && cost.status !== 'fail';
    var okRes = resources.filter(function (r) { return r.status === 'ok'; }).length;
    var o = mission.outcome;
    var parts = [
      { id: 'requirements', label: t('s.requirements'), max: w.requirements,
        points: totalW ? w.requirements * okW / totalW : 0,
        explanation: t('s.requirementsX', { ok: okN, n: reqs.length }) },
      { id: 'mission', label: t('s.mission'), max: w.mission,
        points: w.mission * (o ? o.value : 0),
        explanation: o ? o.explanation : '' },
      { id: 'budget', label: t('s.budget'), max: w.budget,
        points: within ? w.budget : 0,
        explanation: cost ? t('s.budgetX', { cost: fmt(cost.demand, 0), within: t(within ? 'eng.within' : 'eng.above'), budget: fmt(cost.capacity, 0) }) : '' },
      { id: 'margins', label: t('s.margins'), max: w.margins,
        points: resources.length ? w.margins * okRes / resources.length : 0,
        explanation: t('s.marginsX', { ok: okRes, n: resources.length }) }
    ];
    var total = Math.round(parts.reduce(function (s, x) { return s + x.points; }, 0));
    var max = parts.reduce(function (s, x) { return s + x.max; }, 0);
    var grade = (sc.grades || []).slice()
      .sort(function (a, b) { return b.min - a.min; })
      .filter(function (g) { return total >= g.min; })[0];
    return { status: 'ok', total: total, max: max, parts: parts, grade: grade ? L(grade.label) : null };
  }

  // Lições: dicas das falhas (requisitos, verificações, imprevistos sofridos).
  function collectLessons(reqs, checks, risks, life) {
    var out = [], seen = {};
    function add(source, text) {
      if (text && !seen[text]) { seen[text] = true; out.push({ source: source, text: text }); }
    }
    reqs.forEach(function (r) { if (r.status === 'fail') add(r.id, r.hint); });
    checks.forEach(function (c) { if (c.status === 'fail') add(c.id, c.hint); });
    (risks || []).forEach(function (r) { if (r.occurs && !r.mitigated) add(r.id, L(r.def.lesson)); });
    checks.forEach(function (c) { if (c.status === 'warn') add(c.id, c.hint); });
    if (life && !life.pending) {
      var tl = life.totals, ty = life.tally;
      if (tl.end === 'reentry') add('LIFE', t('life.lesson.reentry'));
      if (tl.end === 'battery') add('LIFE', t('life.lesson.battery'));
      if (ty.resets > 0) add('LIFE', t('life.lesson.resets', { n: ty.resets }));
      if (tl.lost > 0.01 * Math.max(tl.generated, 1e-9)) add('LIFE', t('life.lesson.lost', { pct: pct(tl.lost / Math.max(tl.generated, 1e-9)) }));
    }
    return out;
  }

  // ------------------------------------------------------- Ponto de entrada
  function run(state, data) {
    data = data || MS.data;
    if (!data || !data.scenarios) throw new Error('Dados não carregados (MS.data).');
    var sc = data.scenarios[state && state.scenarioId];
    if (!sc) throw new Error('Cenário desconhecido: ' + (state && state.scenarioId));
    var catalog = data.catalog || {};
    var r = resolveSelection(state.design, sc, catalog);
    var slotLabel = {};
    sc.slots.forEach(function (s) { slotLabel[s.id] = L(s.label); });
    var sw = data.spaceWeather && data.spaceWeather.periods;
    var period = state && state.period && sw ? sw[state.period] : null;
    var ctx = { scenario: sc, catalog: catalog, sel: r.sel, missing: r.missing, slotLabel: slotLabel, lifeMode: !!period };

    var mel = buildMEL(ctx);
    var metrics = computeMetrics(ctx, mel);
    var margins = (sc.params && sc.params.margins) || {};
    var resources = RESOURCES.map(function (def) { return evalResource(def, metrics, margins); });
    var checks = computeChecks(ctx, metrics, resources);
    var requirements = evaluateRequirements(sc, metrics);
    var verification = evaluateVerification(sc, requirements, checks);
    var env = {
      metrics: metrics, sel: r.sel, slotLabel: slotLabel,
      R: indexBy(requirements, 'id'), C: indexBy(checks, 'id'), res: indexBy(resources, 'id'),
      optionName: function (slotId, id) {
        var slot = sc.slots.filter(function (s) { return s.id === slotId; })[0];
        var item = slot && (catalog[slot.source] || {})[id];
        return item ? L(item.name) : id;
      }
    };
    // Missão no tempo (js/life.js): só com o projeto completo e a janela de lançamento escolhida.
    var life = null;
    if (period && !r.missing.length && MS.life) {
      var mv = function (k) { return metrics[k].value; };
      life = MS.life.simulate({
        periodId: state.period, period: period, decisions: state.decisions || {},
        h0: mv('altitude_km'), lifeYears: mv('lifetime_years'),
        plannedDays: (isNum(sc.params && sc.params.plannedDuration_years) ? sc.params.plannedDuration_years : 1) * 365,
        dataPerDay: mv('dataPerDay_Gbit'), downlinkPerDay: mv('downlink_Gbit_day'), storage: mv('storage_Gbit'),
        powerGen: mv('powerGen_W'), powerUse: mv('powerUse_W')
      });
    }
    env.life = life;
    // Sem semente (state.seed), os imprevistos aparecem como riscos mas não são sorteados.
    var seed = state && isNum(state.seed) ? state.seed >>> 0 : null;
    var risks = computeRisks(ctx, env, seed);
    var mission = runMission(ctx, env, risks);
    var score = computeScore(sc, requirements, resources, mission);

    return {
      scenarioId: sc.id,
      seed: seed,
      complete: r.missing.length === 0,
      missing: r.missing.map(function (id) { return { slot: id, label: slotLabel[id] }; }),
      selection: r.sel,
      mel: mel, metrics: metrics, resources: resources, checks: checks,
      requirements: requirements, verification: verification,
      risks: risks.map(function (x) { var o = Object.assign({}, x); delete o.def; delete o.mitigationResults; return o; }),
      mission: mission, score: score,
      // Missão perdida antes de chegar à órbita (lançamento ou atraso): o ano em órbita não aconteceu.
      life: neverFlew(mission) ? null : life, period: state && state.period || null,
      lessons: collectLessons(requirements, checks, risks, life)
    };
  }

  // ------------------------------------------------------------ Validação
  // Confere os dados de /js/data e devolve problemas legíveis ([] = ok).
  // (Mensagens para quem edita os dados; ficam em português.)
  function validate(data) {
    var errs = [];
    function err(msg) { errs.push(msg); }
    function need(obj, fields, where) {
      fields.forEach(function (f) {
        if (obj[f] === undefined || obj[f] === null) err(`${where}: falta o campo "${f}".`);
      });
    }
    // Todas as versões de um texto (string ou { en, pt, es }).
    function versions(v) {
      if (v == null) return [];
      if (typeof v === 'object' && !Array.isArray(v)) return Object.keys(v).map(function (k) { return v[k]; });
      return [v];
    }
    function checkPlaceholders(text, w) {
      versions(text).forEach(function (s) {
        String(s || '').replace(/\{(\w+)\}/g, function (all, key) {
          if (!METRICS[key]) err(`${w}: {${key}} não é uma métrica.`);
          return all;
        });
      });
    }
    if (!data) return ['MS.data não existe.'];

    // Fases
    var flow = data.flow || {};
    var phases = Array.isArray(flow.phases) ? flow.phases : [];
    if (!phases.length) err('flow.phases está vazio.');
    var phaseIds = phases.map(function (ph) { return ph.id; });
    phaseIds.forEach(function (id, i) { if (phaseIds.indexOf(id) !== i) err(`Fase repetida: ${id}.`); });
    if (flow.retryPhase && phaseIds.indexOf(flow.retryPhase) === -1) err(`flow.retryPhase "${flow.retryPhase}" não é uma fase.`);
    if (flow.defaultScenario && !(data.scenarios || {})[flow.defaultScenario]) err(`flow.defaultScenario "${flow.defaultScenario}" não existe.`);

    // Catálogo
    var cat = data.catalog || {};
    var maturity = cat.maturity || {};
    Object.keys(SOURCE_FIELDS).concat(['components']).forEach(function (src) {
      if (!cat[src]) err(`catalog.${src} não existe.`);
    });
    Object.keys(SOURCE_FIELDS).forEach(function (src) {
      Object.keys(cat[src] || {}).forEach(function (id) { need(cat[src][id], SOURCE_FIELDS[src], `catalog.${src}.${id}`); });
    });
    Object.keys(cat.launchers || {}).forEach(function (id) {
      (cat.launchers[id].orbits || []).forEach(function (o) {
        if (!(cat.orbits || {})[o]) err(`catalog.launchers.${id}: órbita "${o}" não existe.`);
      });
    });
    Object.keys(cat.components || {}).forEach(function (id) {
      var c = cat.components[id], where = `catalog.components.${id}`;
      need(c, COMPONENT_FIELDS, where);
      if (c.role && !ROLE_FIELDS[c.role]) err(`${where}: papel "${c.role}" desconhecido.`);
      else if (c.role) need(c, ROLE_FIELDS[c.role], where);
      if (c.maturity && !maturity[c.maturity]) err(`${where}: maturidade "${c.maturity}" não existe.`);
    });

    // Cenários
    var scs = data.scenarios || {};
    if (!Object.keys(scs).length) err('Nenhum cenário em MS.data.scenarios.');
    Object.keys(scs).forEach(function (sid) {
      var sc = scs[sid], where = `cenário ${sid}`;
      if (sc.id !== sid) err(`${where}: campo id ("${sc.id}") diferente da chave.`);
      need(sc, ['title', 'budget_k', 'aoi', 'slots', 'requirements', 'events'], where);
      if (sc.aoi) need(sc.aoi, ['area_km2', 'latitude_deg'], where + '.aoi');

      function checkSpec(s, w) {
        if (!METRICS[s.metric]) err(`${w}: métrica "${s.metric}" não existe.`);
        if (!OPS[s.op]) err(`${w}: operador "${s.op}" inválido.`);
        if (s.ref !== undefined) { if (!METRICS[s.ref]) err(`${w}: métrica de referência "${s.ref}" não existe.`); }
        else if (!isNum(s.value)) err(`${w}: falta "value" (número) ou "ref".`);
      }

      var slotIds = (sc.slots || []).map(function (s) { return s.id; });
      Object.keys(ENGINE_SLOTS).forEach(function (id) {
        if (slotIds.indexOf(id) === -1) err(`${where}: falta a escolha "${id}" (o motor precisa dela).`);
      });
      (sc.slots || []).forEach(function (s) {
        var w = `${where}, escolha ${s.id}`;
        if (!ENGINE_SLOTS[s.id]) { err(`${w}: o motor não conhece esta escolha.`); return; }
        if (s.source !== ENGINE_SLOTS[s.id]) err(`${w}: source deve ser "${ENGINE_SLOTS[s.id]}".`);
        if (phaseIds.indexOf(s.phase) === -1) err(`${w}: fase "${s.phase}" não existe.`);
        if (!s.options || !s.options.length) err(`${w}: sem opções.`);
        (s.options || []).forEach(function (oid) {
          var item = (cat[s.source] || {})[oid];
          if (!item) err(`${w}: opção "${oid}" não existe em catalog.${s.source}.`);
          else if (s.source === 'components' && item.role !== s.id) err(`${w}: "${oid}" tem papel "${item.role}", esperado "${s.id}".`);
        });
      });

      var reqIds = [];
      (sc.requirements || []).forEach(function (r) {
        var w = `${where}, requisito ${r.id}`;
        if (reqIds.indexOf(r.id) !== -1) err(`${w}: id repetido.`);
        reqIds.push(r.id);
        checkSpec(r, w);
      });

      (sc.verification || []).forEach(function (v) {
        var w = `${where}, verificação ${v.id}`;
        (v.requirements || []).forEach(function (id) { if (reqIds.indexOf(id) === -1) err(`${w}: requisito "${id}" não existe.`); });
        (v.checks || []).forEach(function (id) { if (!CHECKS[id]) err(`${w}: verificação "${id}" não existe.`); });
      });

      function checkCond(c, w) {
        if (c.check) { if (!CHECKS[c.check]) err(`${w}: verificação "${c.check}" não existe.`); }
        else if (c.requirement) { if (reqIds.indexOf(c.requirement) === -1) err(`${w}: requisito "${c.requirement}" não existe.`); }
        else if (c.metric) checkSpec(c, w);
        else if (c.slot) {
          var slot = (sc.slots || []).filter(function (s) { return s.id === c.slot; })[0];
          if (!slot) err(`${w}: escolha "${c.slot}" não existe.`);
          else [].concat(c.is || []).forEach(function (id) {
            if (slot.options.indexOf(id) === -1) err(`${w}: "${id}" não é opção de "${c.slot}".`);
          });
          if (!c.is) err(`${w}: condição de escolha sem "is".`);
        }
        else if (c.margin) {
          if (!RESOURCES.some(function (r) { return r.id === c.margin; })) err(`${w}: recurso "${c.margin}" não existe.`);
          if (!OPS[c.op]) err(`${w}: operador "${c.op}" inválido.`);
          if (!isNum(c.value)) err(`${w}: falta "value" (número).`);
        }
        else err(`${w}: condição sem check, requirement, metric, slot ou margin.`);
      }
      function validEffect(f) {
        return f === undefined || f === 'abort' || f === 'none' ||
          (!!f && typeof f === 'object' && isNum(f.degrade) && f.degrade >= 0 && f.degrade <= 1);
      }
      var eventIds = (sc.events || []).map(function (e) { return e.id; });

      if (sc.team) {
        var owned = {};
        (sc.team.roles || []).forEach(function (role) {
          var w = `${where}, papel ${role.id}`;
          if (!role.id || !role.name) err(`${w}: falta "id" ou "name".`);
          (role.slots || []).forEach(function (sid) {
            if (slotIds.indexOf(sid) === -1) err(`${w}: escolha "${sid}" não existe.`);
            if (owned[sid]) err(`${w}: escolha "${sid}" já pertence ao papel ${owned[sid]}.`);
            owned[sid] = role.id;
          });
        });
        if (!isNum(sc.team.maxPlayers) || sc.team.maxPlayers < 2) err(`${where}: team.maxPlayers deve ser 2 ou mais.`);
      }

      (sc.randomEvents || []).forEach(function (re) {
        var w = `${where}, imprevisto ${re.id}`;
        if (!re.id) err(`${where}: imprevisto sem id.`);
        if (eventIds.indexOf(re.id) !== -1) err(`${w}: id igual ao de um evento.`);
        if (!re.title) err(`${w}: falta "title".`);
        if (!re.text) err(`${w}: falta o texto "text".`);
        if (!isNum(re.chance) || re.chance < 0 || re.chance > 1) err(`${w}: "chance" deve ser um número de 0 a 1.`);
        if (re.after && eventIds.indexOf(re.after) === -1) err(`${w}: "after" aponta para evento "${re.after}" que não existe.`);
        if (!validEffect(re.effect)) err(`${w}: effect inválido.`);
        (re.appliesIf || []).concat(re.mitigatedBy || []).forEach(function (c) { checkCond(c, w); });
        if ((re.mitigatedBy || []).length && !re.mitigatedText) err(`${w}: falta o texto "mitigatedText".`);
        [re.text, re.mitigatedText].forEach(function (tx) { checkPlaceholders(tx, w); });
      });

      (sc.events || []).forEach(function (ev) {
        var w = `${where}, evento ${ev.id}`;
        if (!ev.title) err(`${w}: falta "title".`);
        (ev.conditions || []).forEach(function (c) { checkCond(c, w); });
        if (!validEffect(ev.onFail)) err(`${w}: onFail inválido.`);
        if ((ev.conditions || []).length && !ev.failure) err(`${w}: falta o texto "failure".`);
        [ev.success, ev.failure].forEach(function (tx) { checkPlaceholders(tx, w); });
      });
    });
    return errs;
  }

  // Métricas com rótulo traduzido (para requisitos/eventos e para a tela).
  function metricDefs() {
    var out = {};
    Object.keys(METRICS).forEach(function (k) {
      out[k] = { label: t('m.' + k), unit: unitOf(METRICS[k]), decimals: METRICS[k].decimals };
    });
    return out;
  }

  // ----------------------------------------------------------- Exportação
  MS.sim = {
    run: run,
    neverFlew: neverFlew,     // missão terminou antes da órbita (lançamento ou atraso)
    validate: validate,
    metricDefs: METRICS,      // métricas disponíveis para requisitos/eventos
    metricInfo: metricDefs,   // idem, com rótulo e unidade no idioma atual
    checkIds: CHECK_IDS,      // verificações disponíveis
    resourceDefs: RESOURCES,  // recursos do painel
    roleFields: ROLE_FIELDS,  // campos exigidos por papel de componente
    engineSlots: ENGINE_SLOTS,
    util: {
      fmt: fmt, withUnit: withUnit, pct: pct, byFF: byFF, worst: worst,
      orbitModel: orbitModel, contactModel: contactModel
    }
  };
})(globalThis);
