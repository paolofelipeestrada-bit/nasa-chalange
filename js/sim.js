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
 * Status usados em tudo: 'ok' | 'warn' | 'fail' | 'pending'.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  // ------------------------------------------------- Constantes físicas
  var R_EARTH_KM = 6371;         // raio médio da Terra
  var MU_KM3_S2 = 398600.4418;   // parâmetro gravitacional da Terra
  var EQUATOR_KM = 40075;        // circunferência no equador
  var MIN_PER_DAY = 1440;
  var DEG = Math.PI / 180;

  // ------------------------------------------------------------ Métricas
  // Tudo o que o motor calcula. Requisitos e eventos usam estas chaves.
  var METRICS = {
    altitude_km:          { label: 'Altitude',                    unit: 'km',       decimals: 0 },
    period_min:           { label: 'Período orbital',             unit: 'min',      decimals: 1 },
    orbitsPerDay:         { label: 'Órbitas por dia',             unit: '',         decimals: 1 },
    eclipse_pct:          { label: 'Tempo na sombra',             unit: '%',        decimals: 1 },
    lifetime_years:       { label: 'Vida orbital',                unit: 'anos',     decimals: 1 },
    gsd_m:                { label: 'Resolução no solo (GSD)',     unit: 'm',        decimals: 1 },
    swath_km:             { label: 'Largura da faixa',            unit: 'km',       decimals: 1 },
    revisit_days:         { label: 'Revisita da área',            unit: 'dias',     decimals: 1 },
    areaPerDay_km2:       { label: 'Área fotografada por dia',    unit: 'km²',      decimals: 0 },
    dataPerDay_Gbit:      { label: 'Dados gerados por dia',       unit: 'Gbit',     decimals: 2 },
    passesPerDay:         { label: 'Passagens pela estação',      unit: 'por dia',  decimals: 1 },
    contactMinPerDay:     { label: 'Tempo de contato',            unit: 'min/dia',  decimals: 0 },
    downlink_Gbit_day:    { label: 'Capacidade de envio ao solo', unit: 'Gbit/dia', decimals: 2 },
    powerGen_W:           { label: 'Geração média de energia',    unit: 'W',        decimals: 1 },
    powerUse_W:           { label: 'Consumo médio',               unit: 'W',        decimals: 1 },
    mass_kg:              { label: 'Massa (com contingência)',    unit: 'kg',       decimals: 2 },
    massLimit_kg:         { label: 'Massa máxima no lançador',    unit: 'kg',       decimals: 1 },
    volume_U:             { label: 'Volume ocupado',              unit: 'U',        decimals: 1 },
    volumeCapacity_U:     { label: 'Volume útil da estrutura',    unit: 'U',        decimals: 1 },
    storageNeed_Gbit:     { label: 'Memória necessária',          unit: 'Gbit',     decimals: 1 },
    storage_Gbit:         { label: 'Memória a bordo',             unit: 'Gbit',     decimals: 0 },
    pointingAccuracy_deg: { label: 'Precisão de apontamento',     unit: '°',        decimals: 2 },
    pointingRequired_deg: { label: 'Apontamento exigido',         unit: '°',        decimals: 2 },
    cost_k:               { label: 'Custo total',                 unit: 'k$',       decimals: 0 },
    budget_k:             { label: 'Orçamento',                   unit: 'k$',       decimals: 0 }
  };

  // Recursos do painel: demanda × capacidade (ambas métricas acima).
  var RESOURCES = [
    { id: 'mass',     label: 'Massa',          demand: 'mass_kg',          capacity: 'massLimit_kg' },
    { id: 'volume',   label: 'Volume',         demand: 'volume_U',         capacity: 'volumeCapacity_U' },
    { id: 'power',    label: 'Energia',        demand: 'powerUse_W',       capacity: 'powerGen_W' },
    { id: 'downlink', label: 'Envio de dados', demand: 'dataPerDay_Gbit',  capacity: 'downlink_Gbit_day' },
    { id: 'storage',  label: 'Memória',        demand: 'storageNeed_Gbit', capacity: 'storage_Gbit' },
    { id: 'cost',     label: 'Custo',          demand: 'cost_k',           capacity: 'budget_k' }
  ];

  // Verificações de projeto (checks): rótulo e dica para falha/alerta.
  var CHECKS = {
    mass:     { label: 'Massa dentro do limite do lançador',
                fail: 'Reduza a massa (componentes mais leves) ou use um lançador que aceite mais massa.',
                warn: 'Massa perto do limite: pouca reserva para imprevistos.' },
    volume:   { label: 'Componentes cabem na estrutura',
                fail: 'Os componentes não cabem: use uma estrutura maior ou componentes menores.',
                warn: 'Quase sem espaço livre na estrutura.' },
    power:    { label: 'Balanço de energia',
                fail: 'O satélite consome mais do que gera: use painéis abertos, uma estrutura maior ou componentes mais econômicos.',
                warn: 'Margem de energia abaixo da recomendada: com o envelhecimento dos painéis pode faltar energia.' },
    downlink: { label: 'Margem de envio de dados',
                fail: 'O satélite gera mais dados do que consegue enviar: rádio mais rápido, estação com mais passagens ou mais compressão a bordo.',
                warn: 'Envio de dados no limite: qualquer passagem perdida acumula imagens na memória.' },
    storage:  { label: 'Memória a bordo',
                fail: 'A memória não guarda os dias de dados exigidos: use um computador com mais memória ou mais compressão.',
                warn: 'Memória quase cheia.' },
    cost:     { label: 'Dentro do orçamento',
                fail: 'Acima do orçamento: procure escolhas caras que não ajudam a cumprir os requisitos.',
                warn: 'Orçamento quase todo usado: pouca reserva para imprevistos.' },
    pointing: { label: 'Apontamento do instrumento',
                fail: 'Este instrumento precisa de um controle de atitude mais preciso (rodas de reação).' },
    launch:   { label: 'Compatibilidade com o lançador',
                fail: 'Escolha um lançador que vá para a órbita escolhida e aceite o formato do satélite.' },
    contact:  { label: 'Contato com a estação em solo',
                fail: 'A estação nunca vê o satélite nesta órbita: troque a estação ou a órbita.' },
    band:     { label: 'Banda de rádio compatível',
                fail: 'Escolha um rádio numa banda que a estação opera.' }
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

  // Número no padrão brasileiro: 1234.5 → "1.234,5".
  function fmt(x, decimals) {
    if (!isNum(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '-∞';
    var a = Math.abs(x);
    var d = decimals == null ? (a >= 100 ? 0 : a >= 10 ? 1 : 2) : decimals;
    var parts = a.toFixed(d).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (x < 0 && Number(a.toFixed(d)) !== 0 ? '-' : '') + parts.join(',');
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
      sel[slot.id] = ok ? Object.assign({ id: id }, section[id]) : null;
      if (!ok) missing.push(slot.id);
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
        slot: slot.id, slotLabel: slot.label, id: c.id, name: c.name,
        maturity: c.maturity, maturityLabel: mat.label, contingency: k,
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
  // Cada métrica: valor, unidade e explicação (com a conta feita). Quando
  // faltam escolhas, o valor fica null e a explicação diz o que falta.
  // "partial" = soma parcial (alguns componentes ainda não escolhidos).
  function computeMetrics(ctx, mel) {
    var sel = ctx.sel, sc = ctx.scenario, p = sc.params || {};
    var m = {};

    function set(key, value, explanation, partial) {
      var def = METRICS[key];
      m[key] = {
        key: key, label: def.label, unit: def.unit, decimals: def.decimals,
        value: isNum(value) ? value : null, partial: !!partial, explanation: explanation
      };
    }
    function pend(keys, slots) {
      var miss = slots.filter(function (s) { return !sel[s]; })
        .map(function (s) { return ctx.slotLabel[s] || s; });
      keys.forEach(function (k) { set(k, null, 'Falta escolher: ' + miss.join(', ') + '.'); });
    }
    var soFar = mel.partial ? ' (até agora)' : '';

    // Órbita
    var o = sel.orbit, om = o ? orbitModel(o) : null;
    var ff = sel.structure ? sel.structure.formFactor : null;
    if (om) {
      set('altitude_km', o.altitude_km, `Altitude da órbita escolhida (${o.name}).`);
      set('period_min', om.period_min, `Período = 2π·√(a³/μ), com a = ${fmt(R_EARTH_KM, 0)} + ${fmt(o.altitude_km, 0)} = ${fmt(om.a_km, 0)} km → ${fmt(om.period_min, 1)} min.`);
      set('orbitsPerDay', om.orbitsPerDay, `${fmt(MIN_PER_DAY, 0)} min por dia ÷ ${fmt(om.period_min, 1)} min = ${fmt(om.orbitsPerDay, 1)} órbitas por dia.`);
      set('eclipse_pct', om.eclipseFraction * 100, `Pior caso: fração na sombra = arcsen(R ÷ a) ÷ 180° = ${pct(om.eclipseFraction, 1)} da órbita (${fmt(om.eclipseFraction * om.period_min, 0)} min sem sol por volta).`);
      set('lifetime_years', o.lifetime_years, `A ${fmt(o.altitude_km, 0)} km o arrasto da atmosfera derruba um CubeSat em cerca de ${fmt(o.lifetime_years, 1)} ano(s).`);
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
      set('gsd_m', gsd, `GSD = altitude × pixel ÷ focal = ${fmt(o.altitude_km, 0)} km × ${fmt(cam.pixel_um, 2)} µm ÷ ${fmt(cam.focal_mm, 0)} mm = ${fmt(gsd, 1)} m.`);
      set('swath_km', swath, `Faixa = GSD × pixels por linha = ${fmt(gsd, 1)} m × ${fmt(cam.pixelsAcross, 0)} = ${fmt(swath, 1)} km.`);
      set('revisit_days', revisit, reaches
        ? `Revisita = volta da Terra na latitude da área (${fmt(circ, 0)} km) ÷ (${fmt(om.orbitsPerDay, 1)} órbitas/dia × faixa de ${fmt(swath, 1)} km × ${pct(light)} das passagens com boa luz) = ${fmt(revisit, 1)} dias.`
        : `A órbita (inclinação ${fmt(o.inclination_deg, 1)}°) nunca passa sobre a latitude da área (${fmtLat(lat)}).`);
      set('areaPerDay_km2', area, reaches
        ? `Área por dia = ${fmt(sc.aoi.area_km2, 0)} km² ÷ ${fmt(revisit, 1)} dias = ${fmt(area, 0)} km²/dia.`
        : 'A área de interesse nunca fica sob o satélite.');
    } else {
      pend(['gsd_m', 'swath_km', 'revisit_days', 'areaPerDay_km2'], ['orbit', 'payload']);
    }

    // Dados gerados
    var obc = sel.obc, data = null;
    if (om && cam && obc) {
      var raw = (area * 1e6 / (gsd * gsd)) * cam.bands * cam.bitDepth / 1e9;
      data = raw / obc.compressionRatio;
      set('dataPerDay_Gbit', data, `Dados = área ÷ GSD² × ${cam.bands} bandas × ${cam.bitDepth} bits = ${fmt(raw, 2)} Gbit brutos; com compressão ${fmt(obc.compressionRatio, 0)}:1 no computador = ${fmt(data, 2)} Gbit/dia.`);
    } else {
      pend(['dataPerDay_Gbit'], ['orbit', 'payload', 'obc']);
    }

    // Contato e envio ao solo
    var gs = sel.groundStation, com = sel.comms;
    var cm = (om && gs) ? contactModel(om, gs) : null;
    if (cm) {
      set('passesPerDay', cm.passesPerDay, cm.passesPerDay > 0
        ? `A estação (${fmtLat(gs.latitude_deg)}) vê o satélite num círculo de ${fmt(cm.lambda_deg, 1)}° ao seu redor; ${pct(cm.perOrbit)} das ${fmt(om.orbitsPerDay, 1)} órbitas diárias passam por ele = ${fmt(cm.passesPerDay, 1)} passagens/dia.`
        : `A órbita só chega a ${fmt(om.maxLat_deg, 1)}° de latitude (+${fmt(cm.lambda_deg, 1)}° de visada): a estação a ${fmtLat(gs.latitude_deg)} nunca vê o satélite.`);
      set('contactMinPerDay', cm.contactMinPerDay, `${fmt(cm.passesPerDay, 1)} passagens × ${fmt(cm.avgPass_min, 1)} min em média (máx. ${fmt(cm.maxPass_min, 1)} min) = ${fmt(cm.contactMinPerDay, 0)} min/dia.`);
    } else {
      pend(['passesPerDay', 'contactMinPerDay'], ['orbit', 'groundStation']);
    }
    if (cm && com) {
      var bandOk = (gs.bands || []).indexOf(com.band) !== -1;
      var eff = isNum(p.contactEfficiency) ? p.contactEfficiency : 1;
      var cap = bandOk ? com.dataRate_kbps * 1000 * cm.contactMinPerDay * 60 * eff / 1e9 : 0;
      set('downlink_Gbit_day', cap, bandOk
        ? `Capacidade = ${fmtRate(com.dataRate_kbps)} × ${fmt(cm.contactMinPerDay, 0)} min × 60 s × ${pct(eff)} de aproveitamento = ${fmt(cap, 2)} Gbit/dia.`
        : `A estação não opera na banda ${com.band} do rádio: nada é recebido.`);
    } else {
      pend(['downlink_Gbit_day'], ['orbit', 'groundStation', 'comms']);
    }

    // Energia
    var useW = mel.totals.avgPowerTotal_W;
    set('powerUse_W', useW, `Soma da potência média da MEL (potência × tempo ligado + contingência) = ${fmt(useW, 2)} W${soFar}.`, mel.partial);
    var pw = sel.power;
    if (om && pw && ff) {
      var solar = byFF(pw.solarPower_W, ff);
      var sun = 1 - om.eclipseFraction;
      var eta = isNum(p.powerStorageEfficiency) ? p.powerStorageEfficiency : 1;
      var gen = isNum(solar) ? solar * sun * eta : null;
      set('powerGen_W', gen, isNum(solar)
        ? `Painéis: ${fmt(solar, 1)} W ao sol × ${pct(sun)} do tempo iluminado × ${pct(eta)} (perdas na bateria e conversão) = ${fmt(gen, 2)} W em média.`
        : `Estes painéis não existem para o formato ${ff}.`);
    } else {
      pend(['powerGen_W'], ['orbit', 'structure', 'power']);
    }

    // Massa e volume
    set('mass_kg', mel.totals.massTotal_kg, `Soma da MEL: ${fmt(mel.totals.mass_kg, 2)} kg + contingência por maturidade = ${fmt(mel.totals.massTotal_kg, 2)} kg${soFar}.`, mel.partial);
    var L = sel.launcher;
    if (L && ff) {
      var limit = byFF(L.maxMass_kg, ff);
      set('massLimit_kg', limit, isNum(limit)
        ? `O lançador "${L.name}" aceita até ${fmt(limit, 1)} kg para um satélite ${ff}.`
        : `O lançador "${L.name}" não aceita satélites ${ff}.`);
    } else {
      pend(['massLimit_kg'], ['launcher', 'structure']);
    }
    set('volume_U', mel.totals.volume_U, `Soma dos volumes da MEL = ${fmt(mel.totals.volume_U, 1)} U${soFar}.`, mel.partial);
    if (sel.structure) {
      set('volumeCapacity_U', sel.structure.capacity_U, `A estrutura ${ff} tem ${fmt(sel.structure.capacity_U, 1)} U úteis (o resto vai para trilhos e fixações).`);
    } else {
      pend(['volumeCapacity_U'], ['structure']);
    }

    // Memória
    var days = isNum(p.storageDays) ? p.storageDays : 1;
    if (obc) set('storage_Gbit', obc.storage_GB * 8, `${fmt(obc.storage_GB, 0)} GB × 8 bits = ${fmt(obc.storage_GB * 8, 0)} Gbit.`);
    else pend(['storage_Gbit'], ['obc']);
    if (isNum(data)) set('storageNeed_Gbit', data * days, `Guardar ${fmt(days, 0)} dia(s) de dados, caso passagens sejam perdidas: ${fmt(data, 2)} × ${fmt(days, 0)} = ${fmt(data * days, 1)} Gbit.`);
    else pend(['storageNeed_Gbit'], ['orbit', 'payload', 'obc']);

    // Apontamento
    if (sel.adcs) set('pointingAccuracy_deg', sel.adcs.accuracy_deg, `"${sel.adcs.name}" aponta com precisão de ${fmt(sel.adcs.accuracy_deg, 2)}°.`);
    else pend(['pointingAccuracy_deg'], ['adcs']);
    if (cam) set('pointingRequired_deg', cam.requiredPointing_deg, `"${cam.name}" precisa de apontamento melhor que ${fmt(cam.requiredPointing_deg, 2)}° para não borrar as imagens.`);
    else pend(['pointingRequired_deg'], ['payload']);

    // Custo
    var launchCost = (L && ff) ? byFF(L.cost_k, ff) : null;
    var gsCost = gs ? gs.cost_k : null;
    var cost = mel.totals.cost_k + (isNum(launchCost) ? launchCost : 0) + (isNum(gsCost) ? gsCost : 0);
    set('cost_k', cost, `Satélite (MEL) ${fmt(mel.totals.cost_k, 0)} k$ + lançamento ${isNum(launchCost) ? fmt(launchCost, 0) + ' k$' : '(a definir)'} + estação ${isNum(gsCost) ? fmt(gsCost, 0) + ' k$' : '(a definir)'} = ${fmt(cost, 0)} k$.`,
      mel.partial || !isNum(launchCost) || !isNum(gsCost));
    set('budget_k', sc.budget_k, 'Orçamento total definido pelo cliente.');

    return m;
  }

  // Troca {métrica} no texto pelo valor formatado (sem unidade).
  function fill(text, metrics) {
    return String(text || '').replace(/\{(\w+)\}/g, function (all, key) {
      var mt = metrics[key];
      return mt ? fmt(mt.value, mt.decimals) : all;
    });
  }

  // ------------------------------------------------------------- Recursos
  // Folga (margem) = (capacidade − demanda) ÷ capacidade.
  function evalResource(def, metrics, margins) {
    var d = metrics[def.demand], c = metrics[def.capacity];
    var rec = isNum(margins[def.id]) ? margins[def.id] : 0;
    var r = {
      id: def.id, label: def.label, unit: d.unit, decimals: d.decimals,
      demand: d.value, capacity: c.value, partial: d.partial || c.partial,
      usage: null, margin: null, recommendedMargin: rec, status: 'pending',
      details: [d.explanation, c.explanation]
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
      r.explanation = `${d.label}: ${u(r.demand)}, mas a capacidade é zero.`;
    } else if (r.status === 'fail') {
      var over = r.usage >= 2 ? `${fmt(r.usage, 1)} vezes a capacidade` : `${pct(r.usage - 1)} acima da capacidade`;
      r.explanation = `${d.label}: ${u(r.demand)} de ${withUnit(r.capacity, r.unit, c.decimals)} — ${over}.`;
    } else {
      r.explanation = `${d.label}: ${u(r.demand)} de ${withUnit(r.capacity, r.unit, c.decimals)} — folga de ${pct(r.margin)}` +
        (rec > 0 ? ` (recomendado ≥ ${pct(rec)}).` : '.') +
        (r.partial && r.status !== 'fail' ? ' Soma parcial: faltam escolhas.' : '');
    }
    return r;
  }

  // ------------------------------------------------- Verificações (checks)
  function computeChecks(ctx, metrics, resources) {
    var sel = ctx.sel, out = [];
    function add(id, status, explanation) {
      var def = CHECKS[id];
      out.push({
        id: id, label: def.label, status: status, explanation: explanation,
        hint: status === 'fail' ? def.fail : status === 'warn' ? (def.warn || null) : null
      });
    }
    function missing(slots) {
      return 'Falta escolher: ' + slots.filter(function (s) { return !sel[s]; })
        .map(function (s) { return ctx.slotLabel[s] || s; }).join(', ') + '.';
    }

    resources.forEach(function (r) { add(r.id, r.status, r.explanation); });

    var acc = metrics.pointingAccuracy_deg.value, req = metrics.pointingRequired_deg.value;
    if (isNum(acc) && isNum(req)) {
      var okP = acc <= req + tol(req);
      add('pointing', okP ? 'ok' : 'fail', `Controle de atitude: ${withUnit(acc, '°', 2)} ${okP ? '≤' : '>'} exigência do instrumento: ${withUnit(req, '°', 2)}.`);
    } else {
      add('pointing', 'pending', missing(['adcs', 'payload']));
    }

    var L = sel.launcher, o = sel.orbit, st = sel.structure;
    if (L && o) {
      if (L.orbits.indexOf(o.id) === -1) add('launch', 'fail', `O lançador "${L.name}" não vai para a órbita "${o.name}".`);
      else if (!st) add('launch', 'pending', `O lançador vai para a órbita escolhida. ${missing(['structure'])}`);
      else if (!isNum(byFF(L.maxMass_kg, st.formFactor))) add('launch', 'fail', `O lançador "${L.name}" não aceita satélites ${st.formFactor}.`);
      else add('launch', 'ok', `O lançador "${L.name}" leva satélites ${st.formFactor} até a órbita "${o.name}".`);
    } else {
      add('launch', 'pending', missing(['launcher', 'orbit']));
    }

    var passes = metrics.passesPerDay;
    add('contact', !isNum(passes.value) ? 'pending' : passes.value > 0 ? 'ok' : 'fail', passes.explanation);

    var gs = sel.groundStation, com = sel.comms;
    if (gs && com) {
      var okB = (gs.bands || []).indexOf(com.band) !== -1;
      add('band', okB ? 'ok' : 'fail', okB
        ? `A estação opera na banda ${com.band} do rádio.`
        : `O rádio usa a banda ${com.band}, mas a estação só opera em ${(gs.bands || []).join(', ')}.`);
    } else {
      add('band', 'pending', missing(['groundStation', 'comms']));
    }
    return out;
  }

  // ----------------------------------------------------------- Requisitos
  // Compara uma métrica com um valor fixo (value) ou com outra métrica (ref).
  function compareMetric(spec, metrics) {
    var mt = metrics[spec.metric];
    if (!mt) return { status: 'fail', value: null, threshold: null, explanation: `Métrica desconhecida: ${spec.metric}.` };
    var ref = spec.ref ? metrics[spec.ref] : null;
    if (spec.ref && !ref) return { status: 'fail', value: null, threshold: null, explanation: `Métrica desconhecida: ${spec.ref}.` };
    var threshold = ref ? ref.value : spec.value;
    if (!isNum(mt.value)) return { status: 'pending', value: null, threshold: threshold, unit: mt.unit, explanation: mt.explanation };
    if (!isNum(threshold)) return { status: 'pending', value: mt.value, threshold: null, unit: mt.unit, explanation: ref ? ref.explanation : 'Valor de referência ausente.' };
    var pass = OPS[spec.op] ? OPS[spec.op](mt.value, threshold) : false;
    var u = function (x) { return withUnit(x, mt.unit, mt.decimals); };
    var target = ref ? `${ref.label.toLowerCase()}: ${u(threshold)}` : u(threshold);
    return {
      status: pass ? 'ok' : 'fail', value: mt.value, threshold: threshold, unit: mt.unit,
      explanation: `${mt.label}: ${u(mt.value)} — ${pass ? 'atende' : 'não atende'} (precisa ${OP_TEXT[spec.op] || spec.op} ${target}). ${mt.explanation}` +
        (ref ? ' ' + ref.explanation : '')
    };
  }

  function evaluateRequirements(sc, metrics) {
    return (sc.requirements || []).map(function (rq) {
      var r = compareMetric(rq, metrics);
      return {
        id: rq.id, title: rq.title, text: rq.text, goal: rq.goal || null, rationale: rq.rationale || '',
        weight: isNum(rq.weight) ? rq.weight : 1, metric: rq.metric, op: rq.op,
        status: r.status, value: r.value, threshold: r.threshold, unit: r.unit || '',
        explanation: r.explanation, hint: r.status === 'fail' ? (rq.hint || null) : null
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
          : { kind: 'requirement', id: id, label: id, status: 'fail', explanation: 'Requisito desconhecido.' });
      });
      (v.checks || []).forEach(function (id) {
        var c = C[id];
        items.push(c
          ? { kind: 'check', id: id, label: c.label, status: c.status, explanation: c.explanation }
          : { kind: 'check', id: id, label: id, status: 'fail', explanation: 'Verificação desconhecida.' });
      });
      return {
        id: v.id, title: v.title, method: v.method || '', description: v.description || '',
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
      if (!k) return { status: 'fail', explanation: `Verificação desconhecida: ${c.check}.` };
      return { status: k.status === 'warn' ? 'ok' : k.status, explanation: `${k.label}: ${k.explanation}` };
    }
    if (c.requirement) {
      var r = env.R[c.requirement];
      if (!r) return { status: 'fail', explanation: `Requisito desconhecido: ${c.requirement}.` };
      return { status: r.status, explanation: `${r.id} ${r.title}: ${r.explanation}` };
    }
    if (c.metric) return compareMetric(c, env.metrics);
    if (c.slot) {
      var item = env.sel[c.slot], want = [].concat(c.is || []);
      var label = env.slotLabel[c.slot] || c.slot;
      if (!item) return { status: 'pending', explanation: `${label}: ainda não escolhido.` };
      var okSlot = want.indexOf(item.id) !== -1;
      return {
        status: okSlot ? 'ok' : 'fail',
        explanation: `${label}: "${item.name}"` + (okSlot ? '.' : ` — precisaria ser ${want.map(function (id) {
          return '"' + env.optionName(c.slot, id) + '"';
        }).join(' ou ')}.`)
      };
    }
    if (c.margin) {
      var res = env.res[c.margin];
      if (!res) return { status: 'fail', explanation: `Recurso desconhecido: ${c.margin}.` };
      if (!isNum(res.margin)) return { status: 'pending', explanation: res.explanation };
      var okM = OPS[c.op] ? OPS[c.op](res.margin, c.value) : false;
      return {
        status: okM ? 'ok' : 'fail',
        explanation: `Folga de ${res.label.toLowerCase()}: ${pct(res.margin)} (precisa ${OP_TEXT[c.op] || c.op} ${pct(c.value)}).`
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
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function effectText(eff) {
    if (eff === 'abort') return 'a missão termina';
    if (eff && typeof eff === 'object' && isNum(eff.degrade)) {
      return eff.degrade === 0 ? 'nenhum mapa útil' : `o resultado cai para ${pct(eff.degrade)}`;
    }
    return 'sem efeito no resultado';
  }

  // Registro de riscos: para cada imprevisto, se se aplica, se o projeto
  // está protegido e (com semente) se aconteceu nesta tentativa.
  function computeRisks(ctx, env, seed) {
    var hasSeed = isNum(seed);
    return (ctx.scenario.randomEvents || []).map(function (re) {
      var applies = (re.appliesIf || []).map(function (c) { return evalCondition(c, env); });
      var doesApply = applies.every(function (x) { return x.status === 'ok'; });
      var mit = (re.mitigatedBy || []).map(function (c) { return evalCondition(c, env); });
      var mitigated = mit.length > 0 && mit.every(function (x) { return x.status === 'ok'; });
      var r = hasSeed ? roll(seed, re.id) : null;
      var occurs = doesApply && hasSeed && r < re.chance;
      var status = !doesApply ? 'na' : mitigated ? 'ok' : 'warn';
      var why = !doesApply
        ? 'Não se aplica a este projeto: ' + applies.filter(function (x) { return x.status !== 'ok'; })
            .map(function (x) { return x.explanation; }).join(' ')
        : mitigated
          ? 'Projeto protegido: ' + mit.map(function (x) { return x.explanation; }).join(' ')
          : mit.length
            ? 'Projeto exposto: ' + mit.filter(function (x) { return x.status !== 'ok'; }).map(function (x) { return x.explanation; }).join(' ')
            : 'Não há como evitar: só dá para ter sorte ou absorver o impacto.';
      return {
        id: re.id, title: re.title, when: re.when || '', after: re.after || null,
        description: re.description || '', chance: re.chance,
        applies: doesApply, mitigated: mitigated, occurs: occurs, roll: r, status: status,
        impact: mitigated ? 'nenhum (mitigado)' : effectText(re.effect),
        explanation: why, def: re, mitigationResults: mit
      };
    });
  }

  function runMission(ctx, env, risks) {
    var sc = ctx.scenario, p = sc.params || {}, metrics = env.metrics;
    var events = sc.events || [];
    if (ctx.missing.length) {
      return {
        status: 'pending', aborted: null, outcome: null,
        explanation: 'Complete todas as escolhas para simular a missão.',
        events: events.map(function (ev) {
          return { id: ev.id, when: ev.when || '', title: ev.title, status: 'pending', text: '', causes: [], random: false };
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
      var base = { id: ev.id, when: ev.when || '', title: ev.title, random: !!risk };
      if (aborted) {
        log.push(Object.assign(base, { status: 'skipped', text: `Não aconteceu: a missão terminou em "${aborted.title}".`, causes: [] }));
        return;
      }
      var failed, success, failure, eff;
      if (risk) {
        failed = risk.mitigated ? [] : (risk.mitigationResults.filter(function (x) { return x.status !== 'ok'; }).length
          ? risk.mitigationResults.filter(function (x) { return x.status !== 'ok'; })
          : [{ explanation: 'Não havia como evitar este imprevisto.' }]);
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

    // Resultado: mapas úteis entregues no período de operação.
    var planned = isNum(p.plannedDuration_years) ? p.plannedDuration_years : 1;
    var days = Math.min(planned, metrics.lifetime_years.value) * 365;
    var revisit = metrics.revisit_days.value;
    var data = metrics.dataPerDay_Gbit.value, cap = metrics.downlink_Gbit_day.value;
    var dataFraction = data > 0 ? Math.min(1, cap / data) : 1;
    var possible = isFinite(revisit) && revisit > 0 ? days / revisit : 0;
    var maps = aborted ? 0 : possible * dataFraction * factor;
    var target = (isNum(p.targetMapsPerYear) ? p.targetMapsPerYear : 12) * planned;
    var value = target > 0 ? Math.min(1, maps / target) : 0;
    var outcome = {
      days: days, dataFraction: dataFraction, opsFactor: factor,
      maps: maps, target: target, value: value,
      explanation: aborted
        ? `A missão terminou em "${aborted.title}": nenhum mapa foi entregue.`
        : `Mapas úteis = ${fmt(days, 0)} dias de operação ÷ ${fmt(revisit, 1)} dias por mapa × ${pct(dataFraction)} dos dados entregues × ${pct(factor)} de aproveitamento = ${fmt(maps, 1)} de ${fmt(target, 0)} mapas previstos.`
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
    if (mission.status === 'pending') return { status: 'pending', total: null, max: null, parts: [], grade: null };
    var totalW = 0, okW = 0, okN = 0;
    reqs.forEach(function (r) { totalW += r.weight; if (r.status === 'ok') { okW += r.weight; okN++; } });
    var cost = resources.filter(function (r) { return r.id === 'cost'; })[0];
    var within = !!cost && cost.status !== 'fail';
    var okRes = resources.filter(function (r) { return r.status === 'ok'; }).length;
    var o = mission.outcome;
    var parts = [
      { id: 'requirements', label: 'Requisitos atendidos', max: w.requirements,
        points: totalW ? w.requirements * okW / totalW : 0,
        explanation: `${okN} de ${reqs.length} requisitos atendidos.` },
      { id: 'mission', label: 'Resultado da missão', max: w.mission,
        points: w.mission * (o ? o.value : 0),
        explanation: o ? o.explanation : '' },
      { id: 'budget', label: 'Orçamento', max: w.budget,
        points: within ? w.budget : 0,
        explanation: cost ? `Custo de ${fmt(cost.demand, 0)} k$ ${within ? 'dentro' : 'acima'} do orçamento de ${fmt(cost.capacity, 0)} k$.` : '' },
      { id: 'margins', label: 'Margens de projeto', max: w.margins,
        points: resources.length ? w.margins * okRes / resources.length : 0,
        explanation: `${okRes} de ${resources.length} recursos com a folga recomendada.` }
    ];
    var total = Math.round(parts.reduce(function (s, x) { return s + x.points; }, 0));
    var max = parts.reduce(function (s, x) { return s + x.max; }, 0);
    var grade = (sc.grades || []).slice()
      .sort(function (a, b) { return b.min - a.min; })
      .filter(function (g) { return total >= g.min; })[0];
    return { status: 'ok', total: total, max: max, parts: parts, grade: grade ? grade.label : null };
  }

  // Lições: dicas das falhas (requisitos, verificações, imprevistos sofridos).
  function collectLessons(reqs, checks, risks) {
    var out = [], seen = {};
    function add(source, text) {
      if (text && !seen[text]) { seen[text] = true; out.push({ source: source, text: text }); }
    }
    reqs.forEach(function (r) { if (r.status === 'fail') add(r.id, r.hint); });
    checks.forEach(function (c) { if (c.status === 'fail') add(c.id, c.hint); });
    (risks || []).forEach(function (r) { if (r.occurs && !r.mitigated) add(r.id, r.def.lesson); });
    checks.forEach(function (c) { if (c.status === 'warn') add(c.id, c.hint); });
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
    sc.slots.forEach(function (s) { slotLabel[s.id] = s.label; });
    var ctx = { scenario: sc, catalog: catalog, sel: r.sel, missing: r.missing, slotLabel: slotLabel };

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
        return item ? item.name : id;
      }
    };
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
      lessons: collectLessons(requirements, checks, risks)
    };
  }

  // ------------------------------------------------------------ Validação
  // Confere os dados de /js/data e devolve problemas legíveis ([] = ok).
  function validate(data) {
    var errs = [];
    function err(msg) { errs.push(msg); }
    function need(obj, fields, where) {
      fields.forEach(function (f) {
        if (obj[f] === undefined || obj[f] === null) err(`${where}: falta o campo "${f}".`);
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
        [re.text, re.mitigatedText].forEach(function (t) {
          String(t || '').replace(/\{(\w+)\}/g, function (all, key) {
            if (!METRICS[key]) err(`${w}: {${key}} não é uma métrica.`);
            return all;
          });
        });
      });

      (sc.events || []).forEach(function (ev) {
        var w = `${where}, evento ${ev.id}`;
        if (!ev.title) err(`${w}: falta "title".`);
        (ev.conditions || []).forEach(function (c) { checkCond(c, w); });
        if (!validEffect(ev.onFail)) err(`${w}: onFail inválido.`);
        if ((ev.conditions || []).length && !ev.failure) err(`${w}: falta o texto "failure".`);
        [ev.success, ev.failure].forEach(function (t) {
          String(t || '').replace(/\{(\w+)\}/g, function (all, key) {
            if (!METRICS[key]) err(`${w}: {${key}} não é uma métrica.`);
            return all;
          });
        });
      });
    });
    return errs;
  }

  // ----------------------------------------------------------- Exportação
  MS.sim = {
    run: run,
    validate: validate,
    metricDefs: METRICS,      // métricas disponíveis para requisitos/eventos
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
