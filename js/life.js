/* =====================================================================
 * life.js — A MISSÃO NO TEMPO (puro, sem DOM, testável)
 *
 *   MS.life.simulate(input) → { series, log, pending, totals, summary }
 *
 * Roda a missão dia a dia, a partir da data de lançamento escolhida,
 * com o clima espacial REAL daquele período (js/data/spaceweather.js).
 * Quatro estoques mudam com o tempo:
 *   altitude   cai pelo arrasto; o ar fica mais denso quanto mais baixo
 *              (laço que se reforça) e quando o Sol está agitado
 *   painéis    envelhecem e perdem força com partículas solares
 *   bateria    só se gasta se o satélite consome mais do que gera
 *   memória    enche com as fotos e esvazia nas passagens pela estação
 *
 * Decisões do jogador (input.decisions) aparecem quando a missão chega
 * a um alerta ou a um limite. Sem a decisão, a simulação para ali e
 * devolve "pending": a interface pergunta e roda de novo. Cada decisão
 * vira uma regra para o resto da missão.
 *   storm:  safe | radiation | keep    (alertas de clima espacial)
 *   memory: pause | overwrite | compress (memória quase cheia)
 *   power:  reduce | keep               (painéis já não dão conta)
 *
 * Números simplificados para o jogo; a ordem de grandeza é realista.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  var DAY_MS = 864e5;
  var C = {
    scaleHeight_km: 55,      // a densidade do ar cai ~e vezes a cada 55 km
    fallBelow_km: 150,       // fim da missão: órbita 150 km abaixo da inicial
    stormDragPerKp: 0.8,     // tempestade Kp 9 → arrasto ×5 por 2 dias
    stormDays: 2,
    flareDrag: 1.15,         // erupção X aquece a alta atmosfera naquele dia
    alertKp: 7,              // tempestades a partir de Kp 7 geram alerta
    stormLead: 2,            // a nuvem solar leva ~2 dias para chegar
    sepLead: 1,              // alerta de partículas ~1 dia antes
    safeDays: 2,             // modo de segurança por alerta
    safeDrag: 0.6,           // de lado para o vento: menos arrasto
    panelAgingPerYear: 0.025,
    sepPanelLoss: 0.005,     // cada dia de partículas sem proteção
    resetDays: 3,            // computador reinicia: 3 dias sem fotos
    memoryTrigger: 0.8,      // decisão quando a memória passa de 80%
    batteryWearPerDay: 0.01, // déficit de energia sem reduzir as fotos
    batteryFloor: 0.6,       // abaixo disso a bateria não segura a sombra
    compressData: 0.5,
    compressQuality: 0.85
  };

  var OPTIONS = {
    storm: ['safe', 'radiation', 'keep'],
    memory: ['pause', 'overwrite', 'compress'],
    power: ['reduce', 'keep']
  };
  // Sem resposta a tempo (alerta com contagem no 3D): o satélite segue como está.
  var NO_ANSWER = { storm: 'keep', memory: 'overwrite', power: 'keep' };

  function day(s) { return Math.round(Date.parse(s + 'T00:00:00Z') / DAY_MS); }
  function iso(n) { return new Date(n * DAY_MS).toISOString().slice(0, 10); }
  function byDay(list, start, n, keep) {
    var out = {};
    (list || []).forEach(function (e) {
      if (keep && !keep(e)) return;
      var d = day(e[0]) - start;
      if (d >= 0 && d < n) (out[d] = out[d] || []).push(e);
    });
    return out;
  }

  // input: { periodId, period, decisions, h0, lifeYears, plannedDays,
  //          dataPerDay, downlinkPerDay, storage, powerGen, powerUse }
  function simulate(input) {
    var p = input.period, start = day(p.launch), N = Math.max(1, Math.round(input.plannedDays));
    var dec = input.decisions || {};
    var gst = byDay(p.gst, start, N);
    var sep = byDay(p.sep, start, N);
    var flrX = byDay(p.flr, start, N, function (f) { return /^X/.test(f[1]); });

    // Alertas: tempestade forte 2 dias antes; partículas 1 dia antes.
    var alerts = {};
    Object.keys(gst).forEach(function (k) {
      var d = Number(k);
      gst[k].forEach(function (g) {
        if (g[1] < C.alertKp) return;
        var a = Math.max(0, d - C.stormLead);
        if (!alerts[a] || alerts[a].kind !== 'storm') alerts[a] = { kind: 'storm', ev: g, on: d };
      });
    });
    Object.keys(sep).forEach(function (k) {
      var d = Number(k), a = Math.max(0, d - C.sepLead);
      if (!alerts[a]) alerts[a] = { kind: 'radiation', ev: sep[k][0], on: d };
    });

    var r0 = C.scaleHeight_km / (Math.max(0.05, input.lifeYears) * 365);
    var h = input.h0, hEnd = input.h0 - C.fallBelow_km;
    var panels = 1, battery = 1, mem = 0, S = Math.max(0, input.storage || 0);
    var generated = 0, delivered = 0, lost = 0, imaging = 0, quality = 1, compress = 1;
    var safeUntil = -1, safeKind = null, downUntil = -1, paused = false;
    var dragBoost = {};
    var log = [], series = [], pending = null, end = 'complete', opDays = N;
    var tally = { storms: 0, strongest: null, sepDays: 0, xFlares: 0, alerts: 0, safeDays: 0, resets: 0, protectedDays: 0, deficitDay: null, memoryDay: null };

    function ask(id, d, ctx) {
      if (dec[id] && OPTIONS[id].indexOf(dec[id]) !== -1) return false;
      pending = { id: id, day: d, date: iso(start + d), options: OPTIONS[id].slice(), ctx: ctx || {} };
      return true;
    }
    function note(d, type, extra) { log.push(Object.assign({ day: d, date: iso(start + d), type: type }, extra || {})); }

    note(0, 'launch', { period: input.periodId });
    var d;
    for (d = 0; d < N; d++) {
      // 1. Alerta de clima espacial → política do jogador
      var al = alerts[d];
      if (al) {
        if (ask('storm', d, { kind: al.kind, date: al.ev[0], kp: al.kind === 'storm' ? al.ev[1] : null, id: al.kind === 'storm' ? al.ev[2] : al.ev[1] })) break;
        tally.alerts++;
        var protect = dec.storm === 'safe' || (dec.storm === 'radiation' && al.kind === 'radiation');
        if (protect) {
          safeUntil = Math.max(safeUntil, d + C.safeDays - 1);
          safeKind = al.kind;
        }
        note(d, protect ? 'safe' : 'alertIgnored', { kind: al.kind, eventDate: al.ev[0], kp: al.kind === 'storm' ? al.ev[1] : null });
      }
      var safe = d <= safeUntil;
      if (safe) tally.safeDays++;

      // 2. Arrasto: tempestades e erupções aquecem e incham a alta atmosfera
      (gst[d] || []).forEach(function (g) {
        tally.storms++;
        if (!tally.strongest || g[1] > tally.strongest.kp) tally.strongest = { kp: g[1], date: g[0], id: g[2] };
        var m = 1 + Math.max(0, g[1] - 4) * C.stormDragPerKp;
        for (var k = 0; k < C.stormDays; k++) dragBoost[d + k] = Math.max(dragBoost[d + k] || 1, m);
      });
      if (flrX[d]) tally.xFlares += flrX[d].length;
      var act = p.activity * (dragBoost[d] || 1) * (flrX[d] ? C.flareDrag : 1);
      var dh = r0 * Math.exp((input.h0 - h) / C.scaleHeight_km) * act * (safe ? C.safeDrag : 1);
      h -= dh;
      (gst[d] || []).forEach(function (g) { if (g[1] >= C.alertKp) note(d, 'storm', { kp: g[1], id: g[2], drop: dh }); });
      if (h <= hEnd) { end = 'reentry'; opDays = d; note(d, 'reentry', { h: h }); break; }

      // 3. Partículas solares: painéis e computador
      if (sep[d]) {
        tally.sepDays++;
        if (safe) { tally.protectedDays++; note(d, 'sepProtected', { id: sep[d][0][1] }); }
        else {
          panels -= C.sepPanelLoss;
          tally.resets++;
          lost += mem; var wiped = mem; mem = 0;
          downUntil = Math.max(downUntil, d + C.resetDays - 1);
          note(d, 'reset', { id: sep[d][0][1], wiped: wiped });
        }
      }
      panels -= C.panelAgingPerYear / 365;

      // 4. Energia: com painéis gastos, a geração pode não bastar
      var gen = input.powerGen * panels, duty = 1;
      if (gen < input.powerUse) {
        if (tally.deficitDay == null) {
          if (ask('power', d, { gen: gen, use: input.powerUse })) break;
          tally.deficitDay = d;
          note(d, 'deficit', { gen: gen, use: input.powerUse, policy: dec.power });
        }
        if (dec.power === 'reduce') duty = Math.max(0, gen / input.powerUse);
        else {
          battery -= C.batteryWearPerDay;
          if (battery < C.batteryFloor) { end = 'battery'; opDays = d; note(d, 'batteryDead'); break; }
        }
      }

      // 5. Fotos e memória a bordo
      var img = (safe || d <= downUntil) ? 0 : duty;
      if (paused) { if (mem <= S * 0.5) paused = false; else img = 0; }
      var made = input.dataPerDay * img * compress;
      imaging += img;
      generated += made;
      mem += made;
      var down = Math.min(mem, input.downlinkPerDay);
      mem -= down; delivered += down;
      if (S > 0 && mem > S * C.memoryTrigger) {
        if (tally.memoryDay == null) {
          if (ask('memory', d, { fill: mem / S })) break;
          tally.memoryDay = d;
          note(d, 'memoryFull', { policy: dec.memory });
          if (dec.memory === 'compress') { compress = C.compressData; quality = C.compressQuality; }
        }
        if (dec.memory === 'pause') paused = true;
      }
      if (mem > S) { lost += mem - S; mem = S; }

      if (d % 7 === 0) {
        series.push({ d: d, date: iso(start + d), h: h, memory: S > 0 ? mem / S : 0, panels: panels,
          power: input.powerUse > 0 ? gen / input.powerUse : 1, battery: battery });
      }
    }
    var lastDay = pending ? pending.day : Math.min(d, N);
    if (!pending && end === 'complete') note(N - 1, 'end');
    if (pending) opDays = pending.day;

    var totals = {
      opDays: opDays, imagingDays: imaging, generated: generated, delivered: delivered, lost: lost,
      dataFraction: generated > 0 ? delivered / generated : 1,
      quality: quality, end: end, finalAltitude: h, altitudeLoss: input.h0 - h,
      panels: panels, battery: battery, lastDay: lastDay
    };
    return { periodId: input.periodId, launch: p.launch, days: N, series: series, log: log, pending: pending, totals: totals, tally: tally };
  }

  MS.life = { simulate: simulate, OPTIONS: OPTIONS, NO_ANSWER: NO_ANSWER, CONSTANTS: C, iso: iso, day: day };
})(globalThis);
